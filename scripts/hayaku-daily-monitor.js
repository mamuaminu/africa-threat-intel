#!/usr/bin/env node
// Hayaku Express - Daily Monitoring Script
// Monitors bot health, DB stats, WhatsApp activity, rider metrics, order analytics
// Run via cron: 0 9 * * *

const { execSync } = require('child_process');
const fs = require('fs');

const BOT_TOKEN = '8640102292:AAGQH0tQvMu6-lnHiUVzBH8MTriPxJzkrbI';
const CHAT_ID = '1842342246';
const SERVER = '3.65.177.198';
const SSH_KEY = '/home/ubuntu/.ssh/id_rsa_openclaw1';
const LOG = '/home/ubuntu/.openclaw/workspace/logs/hayaku-monitor.log';

function log(msg) {
  const ts = new Date().toISOString().split('T')[1].slice(0,8);
  console.log('[' + ts + '] ' + msg);
  fs.appendFileSync(LOG, '[' + ts + '] ' + msg + '\n');
}

function ssh(cmd) {
  return execSync(`ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@${SERVER} "${cmd.replace(/"/g, '\\"')}"`, { encoding: 'utf8', timeout: 30000 });
}

function sendTelegram(msg) {
  execSync(`curl -s -X POST https://api.telegram.org/bot${BOT_TOKEN}/sendMessage -d chat_id=${CHAT_ID} -d text="${msg.replace(/"/g, '\\"')}" -d parse_mode=HTML -d disable_web_page_preview=true`, { encoding: 'utf8', timeout: 10000 });
}

try {
  log('=== Hayaku daily monitoring started ===');

  const raw = ssh(`
    echo 'PM2_ROW:'; pm2 list 2>/dev/null | grep hayaku-express | head -1;
    echo 'WEBHOOK:'; curl -s --max-time 4 -o /dev/null -w '%{http_code}' -k https://127.0.0.1/webhook/whatsapp -X POST -H 'Content-Type: application/x-www-form-urlencoded' -d 'From=whatsapp:+2340000000000&Body=ping';
    echo 'NGINX:'; curl -sk --max-time 4 -o /dev/null -w '%{http_code}' https://127.0.0.1:443/;
    echo 'WS:'; curl -s --max-time 4 -o /dev/null -w '%{http_code}' -H 'Upgrade: websocket' -H 'Connection: Upgrade' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Sec-WebSocket-Version: 13' http://127.0.0.1:3000/ws;
    echo 'SSL:'; echo | openssl s_client -connect 127.0.0.1:443 -servername hayakuexpress.com </dev/null 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2;
    echo 'DISKINFO:'; python3 -c "import os; d=os.statvfs('/'); used=d.f_bavail*d.f_frsize; print(str(round(used/(1024**3),1))+'G|'+str(round(100-100*d.f_bfree/d.f_blocks))+'%')";
    echo 'RAMINFO:'; free | python3 -c "import sys; m=sys.stdin.readlines()[1].split(); print(str(int(int(m[2])/1024))+'Mi|'+str(int(int(m[6])/1024))+'Mi')";
    echo 'UPTIME:'; uptime | sed 's/.*up /up /' | sed 's/,.*load/ load/';
    cd /var/www/hayaku-express && node get-db-stats.js;
  `);

  // Twilio usage (fetched locally, not via SSH)
  let twilioSection = '';
  try {
    const fs2 = require('fs');
    const envContent = fs2.readFileSync('/home/ubuntu/hayaku-express/.env', 'utf8');
    const envMatch = (key) => envContent.match(new RegExp(key + '=(.+)'))?.[1]?.trim();
    const SID = envMatch('TWILIO_ACCOUNT_SID');
    const TOKEN = envMatch('TWILIO_AUTH_TOKEN');
    if (SID && TOKEN) {
      const auth = Buffer.from(`${SID}:${TOKEN}`).toString('base64');
      const usageRes = execSync(`curl -s -u "${auth}" "https://api.twilio.com/2010-04-01/Accounts/${SID}/Usage/Records/ThisMonth.json?PageSize=200"`, { encoding: 'utf8', timeout: 15000 });
      const balanceRes = execSync(`curl -s -u "${auth}" "https://api.twilio.com/2010-04-01/Accounts/${SID}/Balance.json"`, { encoding: 'utf8', timeout: 10000 });
      const usageData = JSON.parse(usageRes);
      const balanceData = JSON.parse(balanceRes);
      const balance = parseFloat(balanceData.balance || 0).toFixed(3);
      const thisMonth = usageData.usage_records || [];
      const relevant = thisMonth.filter(r => parseFloat(r.price || 0) > 0 || parseInt(r.count || 0) > 0);
      const whatsappInbound = thisMonth.find(r => r.category === 'channels-whatsapp-inbound');
      const whatsappOutbound = thisMonth.find(r => r.category === 'channels-whatsapp-template-marketing' || r.category === 'channels-messaging');
      const whatsappCount = parseInt(whatsappOutbound?.count || 0) + parseInt(whatsappInbound?.count || 0);
      const whatsappPrice = parseFloat(whatsappOutbound?.price || 0) + parseFloat(whatsappInbound?.price || 0);
      twilioSection = `
━━━━━━━━━━━━━━━
📱 <b>TWILIO USAGE</b> (May 2026)
WhatsApp msg: ${whatsappCount} ($${whatsappPrice.toFixed(3)})
Account balance: <b>$${balance} USD</b>`;
    }
  } catch (e) {
    twilioSection = '\n━━━━━━━━━━━━━━━\n📱 <b>TWILIO USAGE:</b> fetch failed';
  }

  fs.writeFileSync('/tmp/hayaku-raw.txt', raw);
  const lines = raw.split('\n').filter(l => l.trim());

  // Parse PM2 row
  const pm2RowMatch = raw.match(/PM2_ROW:\s*\n?(.*)/);
  let pm2Name = '', pm2Mode = '', pm2Uptime = '', pm2Status = 'unknown';
  if (pm2RowMatch) {
    const parts = pm2RowMatch[1].trim().split(/\s+/);
    pm2Name = parts[0] || '';
    pm2Mode = parts[1] || '';
    pm2Uptime = parts[2] || '';
    pm2Status = parts[3] || 'unknown';
  }

  // Parse codes
  const webhookCode = (raw.match(/WEBHOOK:\s*(\d{3})/)?.[1]) || '?';
  const nginxCode = (raw.match(/NGINX:\s*(\d{3})/)?.[1]) || '?';
  const wsCode = (raw.match(/WS:\s*(\d{3})/)?.[1]) || '?';
  const sslDate = (raw.match(/SSL:\s*([^\n]+)/)?.[1]) || 'unknown';
  const diskLine = (raw.match(/DISKINFO:\s*([^\n]+)/)?.[1]) || '?|?';
  const ramLine = (raw.match(/RAMINFO:\s*([^\n]+)/)?.[1]) || '?|?';
  const uptime = (raw.match(/UPTIME:\s*([^\n]+)/)?.[1]) || 'unknown';
  const [diskUsed, diskPct] = diskLine.split('|');
  const [ramUsed, ramTotal] = ramLine.split('|');

  // DB stats
  const customers = (raw.match(/customers:(\d+)/)?.[1]) || '0';
  const verified = (raw.match(/verified:(\d+)/)?.[1]) || '0';
  const riders = (raw.match(/riders:(\d+)/)?.[1]) || '0';
  const orders = (raw.match(/orders:(\d+)/)?.[1]) || '0';
  const pending = (raw.match(/pending:(\d+)/)?.[1]) || '0';
  const assigned = (raw.match(/assigned:(\d+)/)?.[1]) || '0';
  const inTransit = (raw.match(/in_transit:(\d+)/)?.[1]) || '0';
  const delivered = (raw.match(/delivered:(\d+)/)?.[1]) || '0';
  const cancelled = (raw.match(/cancelled:(\d+)/)?.[1]) || '0';
  const todayOrders = (raw.match(/today_orders:(\d+)/)?.[1]) || '0';
  const todayDelivered = (raw.match(/today_delivered:(\d+)/)?.[1]) || '0';
  const todayCancelled = (raw.match(/today_cancelled:(\d+)/)?.[1]) || '0';
  const todayMsgs = (raw.match(/today_msgs:(\d+)/)?.[1]) || '0';
  const todayIn = (raw.match(/today_inbound:(\d+)/)?.[1]) || '0';
  const todayOut = (raw.match(/today_outbound:(\d+)/)?.[1]) || '0';

  // Rider stats
  const riderLines = raw.split('\n').filter(l => l.startsWith('RIDER:'));
  const topRiders = riderLines.slice(0, 5).map(l => {
    const parts = l.replace('RIDER:', '').split('|');
    return { name: parts[0]||'Unknown', phone: parts[1]||'', completed: parseInt(parts[3])||0, cancelled: parseInt(parts[4])||0, active: parseInt(parts[5])||0 };
  });

  // Customer stats
  const customerLines = raw.split('\n').filter(l => l.startsWith('CUSTOMER:'));
  const topCustomers = customerLines.slice(0, 5).map(l => {
    const parts = l.replace('CUSTOMER:', '').split('|');
    return { name: parts[0]||'Unknown', phone: parts[1]||'', verified: parts[2]==='1', total: parseInt(parts[4])||0, completed: parseInt(parts[5])||0, cancelled: parseInt(parts[6])||0 };
  });

  // Icons
  const pm2Icon = pm2Status === 'online' ? '✅' : '❌';
  const whIcon = webhookCode === '200' ? '✅' : '⚠️ ' + webhookCode;
  const wsIcon = wsCode === '101' ? '✅' : '⚠️ ' + wsCode;
  const ngIcon = nginxCode === '200' ? '✅' : '⚠️ ' + nginxCode;

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  // Build rider stats text
  let riderSection = '';
  if (topRiders.length > 0) {
    const riderRows = topRiders.map(r =>
      `  ${r.name.padEnd(12)} | ✅${r.completed} | ❌${r.cancelled} | 🔄${r.active}`
    ).join('\n');
    riderSection = `
<b>Top Riders (by completed):</b>
${riderRows}`;
  } else {
    riderSection = '\n<b>Top Riders:</b> No rider data';
  }

  // Build customer stats text
  let customerSection = '';
  if (topCustomers.length > 0) {
    const customerRows = topCustomers.map(c =>
      `  ${c.name.padEnd(12)} | 📦${c.completed} | ❌${c.cancelled}`
    ).join('\n');
    customerSection = `
<b>Top Customers (by completed orders):</b>
${customerRows}`;
  } else {
    customerSection = '\n<b>Top Customers:</b> No customer data';
  }

  const msg = `📊 <b>Hayaku Daily Monitor</b> — ${now}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 <b>BOT HEALTH</b>
PM2: ${pm2Icon} ${pm2Status} | ${pm2Mode} | ${pm2Uptime}
Webhook: ${whIcon} | WebSocket: ${wsIcon} | Nginx: ${ngIcon}
Uptime: ${uptime} | RAM: ${ramUsed}/${ramTotal} | Disk: ${diskUsed} (${diskPct})

━━━━━━━━━━━━━━━
📦 <b>ORDER STATUS</b> (total: ${orders})
Pending: ${pending} | Assigned: ${assigned} | In Transit: ${inTransit}
✅ Completed: ${delivered} | ❌ Cancelled: ${cancelled}
📅 Today: ${todayOrders} orders | ✅${todayDelivered} done | ❌${todayCancelled} cancelled

━━━━━━━━━━━━━━━
👥 <b>WHATSAPP DB</b>
Customers: ${customers} (${verified} verified)
Today msgs: ${todayMsgs} (📥${todayIn} / 📤${todayOut})${customerSection}

━━━━━━━━━━━━━━━
🛵 <b>RIDER DB</b> (total: ${riders} registered)
Total orders: ${orders} | Pending: ${pending}
✅ Completed: ${delivered} | ❌ Cancelled: ${cancelled}${riderSection}

━━━━━━━━━━━━━━━
🔒 SSL expiry: <b>${sslDate}</b>${twilioSection}`;

  sendTelegram(msg);
  log('Daily monitor sent successfully');

} catch (err) {
  log('ERROR: ' + err.message);
  try { sendTelegram('⚠️ Hayaku monitor failed: ' + err.message); } catch (e) {}
  process.exit(1);
}