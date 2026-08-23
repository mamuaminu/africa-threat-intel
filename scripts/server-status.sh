#!/bin/bash
# Daily server status check — Hayaku Express + Scan Server
# Sends results to Telegram

TOKEN="7810972488:AAG-TOKEN-MISSING"
CHAT_ID="1842342246"

check_hayaku() {
    local ip=$1 name=$2
    local status=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa_openclaw1 ubuntu@$ip 'pm2 list 2>/dev/null | grep -E "server|node|hayaku" | head -3; echo "---"; df -h / | tail -1; free -h | grep Mem' 2>&1)
    if [ $? -eq 0 ]; then
        echo "✅ $name ($ip): OK"
        echo "$status" | while read line; do echo "   $line"; done
    else
        echo "❌ $name ($ip): UNREACHABLE"
    fi
}

check_scan() {
    local ip="16.16.115.29"
    local status=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa_mac ubuntu@$ip 'nginx -t 2>&1; echo "---"; pm2 list 2>/dev/null | head -5; echo "---"; df -h / | tail -1' 2>&1)
    if [ $? -eq 0 ]; then
        echo "✅ Scan Server ($ip): OK"
        echo "$status" | head -10 | while read line; do echo "   $line"; done
    else
        echo "❌ Scan Server ($ip): UNREACHABLE"
    fi
}

MSG="📊 **Daily Server Status — $(date -u '+%Y-%m-%d %H:%M UTC')**%0A%0A"
MSG+="Checking Hayaku Express (3.65.177.198)...%0A"
HAYAKU_STATUS=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa_openclaw1 ubuntu@3.65.177.198 'pm2 list 2>/dev/null | head -5; echo "---"; df -h / | tail -1; free -h | grep Mem' 2>&1)
if [ $? -eq 0 ]; then
    MSG+="✅ Hayaku Express: UP%0A"
else
    MSG+="❌ Hayaku Express: DOWN%0A"
fi

MSG+="%0AChecking Scan Server (16.16.115.29)...%0A"
SCAN_STATUS=$(ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa_mac ubuntu@16.16.115.29 'nginx -t 2>&1; pm2 list 2>/dev/null | head -5; df -h / | tail -1' 2>&1)
if [ $? -eq 0 ]; then
    MSG+="✅ Scan Server: UP%0A"
else
    MSG+="❌ Scan Server: DOWN%0A"
fi

# Log it
echo "[$(date -u)] status check complete" >> /home/ubuntu/.openclaw/workspace/logs/server-status.log

# Send to Telegram
curl -s "https://api.telegram.org/bot$TOKEN/sendMessage?chat_id=$CHAT_ID&text=$MSG&parse_mode=Markdown" > /dev/null 2>&1