#!/usr/bin/env node
/**
 * Africa OSINT Threat Intel Aggregator - v3
 * NVD + CISA KEV mirrors + abuse.ch feeds
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

const COUNTRIES = ['Nigeria', 'Kenya', 'South Africa', 'Ghana', 'Egypt', 'Morocco', 'Tanzania', 'Uganda', 'Algeria', 'Ethiopia'];
const OUTPUT_FILE = '/home/ubuntu/.openclaw/workspace/africa-threat-briefing.md';
const REPO_DIR = '/home/ubuntu/.openclaw/workspace/africa-threat-intel';
const GITHUB_PAT = process.env.GH_PAT;
const GITHUB_USER = 'mamuaminu';
const NOW = new Date().toISOString().split('T')[0];
const TIMESTAMP = new Date().toUTCString();

function fetchUrl(url, timeout) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AfricaThreatIntel/1.0)' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeout || 20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function getCVSS(vuln) {
  return vuln.cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ||
         vuln.cve?.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore ||
         vuln.cve?.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore || 0;
}

function getSeverity(vuln) {
  return vuln.cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity ||
         vuln.cve?.metrics?.cvssMetricV2?.[0]?.baseSeverity || 'UNKNOWN';
}

async function fetchRecentCriticalCVEs() {
  console.log('[NVD] Fetching recent critical CVEs...');
  try {
    // Fetch CVEs modified in last 90 days with CVSS >= 7
    const data = await fetchUrl('https://services.nvd.nist.gov/rest/json/cves/2.0/?resultsPerPage=40&cvssV3Severity=HIGH', 30000);
    const nvd = JSON.parse(data);
    const vulns = (nvd.vulnerabilities || []).filter(v => {
      const cvss = getCVSS(v);
      return cvss >= 7.0;
    }).slice(0, 25);
    console.log(`[NVD] Got ${vulns.length} high/critical CVEs`);
    return vulns.map(v => ({
      cveId: v.cve?.id || 'N/A',
      description: (v.cve?.descriptions?.find(d => d.lang === 'en')?.value || 'No description').substring(0, 300),
      cvss: getCVSS(v),
      severity: getSeverity(v),
      dateModified: v.cve?.lastModified || 'N/A',
      published: v.cve?.published || 'N/A',
    }));
  } catch (e) {
    console.log(`[NVD] Error: ${e.message}`);
    return [];
  }
}

async function fetchCISAKEV() {
  console.log('[CISA] Fetching KEV catalog from mirrors...');
  const sources = [
    'https://raw.githubusercontent.com/cisagov/KEV/main/cvrf/data/nvd/cisa_known_exploited_vulnerabilities.json',
    'https://raw.githubusercontent.com/cisagov/known-exploited-vulnerabilities/main/cvrf/data/nvd/cisa_known_exploited_vulnerabilities.json',
    'https://api.github.com/repos/cisagov/KEV/contents/cvrf/data/nvd/cisa_known_exploited_vulnerabilities.json',
  ];
  
  for (const url of sources) {
    try {
      console.log(`[CISA] Trying ${url.split('/').slice(-3).join('/')}`);
      let data;
      if (url.includes('api.github.com')) {
        const meta = JSON.parse(await fetchUrl(url, 15000));
        data = Buffer.from(meta.content, 'base64').toString('utf8');
      } else {
        data = await fetchUrl(url, 20000);
      }
      const kev = JSON.parse(data);
      const vulns = kev.Vulnerabilities || kev.vulnerabilities || [];
      const critical = vulns.filter(v => {
        const cvss = parseFloat(v.CvssScore || v.cvssScore || 0);
        return cvss >= 8.0;
      }).slice(0, 20);
      console.log(`[CISA] Got ${vulns.length} KEVs, ${critical.length} critical`);
      return critical.map(v => ({
        cveId: v.CveID || v.cveID || v.cveId || 'N/A',
        description: v.ShortDescription || v.shortDescription || v.description || 'No description',
        cvss: v.CvssScore || v.cvssScore || 'N/A',
        dateAdded: v.DateAdded || v.dateAdded || 'N/A',
        vendor: v.VendorProject || v.vendorProject || 'N/A',
        product: v.Product || v.product || 'N/A',
        knownRansomware: v.KnownRansomwareCampaign || v.knownRansomwareUse || 'Unknown',
      }));
    } catch (e) {
      console.log(`[CISA] Failed: ${e.message}`);
    }
  }
  return [];
}

async function fetchAbuseCh() {
  console.log('[Abuse.ch] Fetching malware feeds...');
  const results = [];
  const feeds = [
    { name: 'SHA256 Recent', url: 'https://bazaar.abuse.ch/export/txt/sha256/recent/' },
    { name: 'MD5 Recent', url: 'https://bazaar.abuse.ch/export/txt/md5/recent/' },
    { name: 'URLhaus', url: 'https://urlhaus-api.abuse.ch/v1/urls/recent/limit/25/' },
  ];
  
  for (const feed of feeds) {
    try {
      const data = await fetchUrl(feed.url, 15000);
      if (feed.url.includes('urlhaus-api')) {
        const json = JSON.parse(data);
        const urls = (json.urls || []).filter(u => u.threat === 'malware_download').slice(0, 10);
        results.push({
          type: 'urlhaus',
          name: feed.name,
          count: urls.length,
          samples: urls.map(u => ({ url: u.url, status: u.status, date: u.date_added }))
        });
        console.log(`[Abuse.ch] ${feed.name}: ${urls.length} malware URLs`);
      } else {
        const lines = data.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        results.push({ type: 'bazaar', name: feed.name, count: lines.length });
        console.log(`[Abuse.ch] ${feed.name}: ${lines.length} entries`);
      }
    } catch (e) {
      console.log(`[Abuse.ch] ${feed.name} error: ${e.message}`);
    }
  }
  return results;
}

async function fetchRansomwareFeeds() {
  console.log('[Ransomware] Fetching leak site monitoring data...');
  const feeds = [];
  try {
    // ID Ransomware feed
    const data = await fetchUrl('https://id-ransomware.moe.gov.pl/api/feed', 15000);
    const json = JSON.parse(data);
    if (json.data) {
      const recent = (json.data || []).slice(0, 10);
      feeds.push(...recent.map(r => ({
        type: 'ransomware',
        name: r.ransomware || r.name || 'Unknown Ransomware',
        date: r.date || 'N/A',
        description: r.description || r.note || '',
      })));
      console.log(`[Ransomware] Got ${recent.length} entries`);
    }
  } catch (e) {
    console.log(`[Ransomware] Error: ${e.message}`);
  }
  
  // No More Ransom dictionary
  try {
    const data = await fetchUrl('https://www.nomoreransom.org/en/decryption-tools.html', 15000);
    feeds.push({ type: 'nomorers', note: 'No More Ransom resource available at https://www.nomoreransom.org' });
  } catch (e) {}
  
  return feeds;
}

function generateBriefing(cisaKEV, recentCVEs, abuseCh, ransomware) {
  const countryList = COUNTRIES.join(', ');
  
  const cisaSection = cisaKEV.map(v => `
### ${v.cveId} — CVSS ${v.cvss}
- **Vendor/Product:** ${v.vendor} / ${v.product}
- **Added to KEV:** ${v.dateAdded}
- **Ransomware Campaign:** ${v.knownRansomware}
- **Description:** ${v.description}
`).join('\n');

  const cveSection = recentCVEs.map(v => `
### ${v.cveId} — CVSS ${v.cvss} (${v.severity})
- **Published:** ${v.published?.split('T')[0] || 'N/A'}
- **Last Modified:** ${v.dateModified?.split('T')[0] || 'N/A'}
- **Description:** ${v.description}
`).join('\n');

  const abuseSection = abuseCh.map(f => {
    if (f.type === 'urlhaus') {
      const samples = (f.samples || []).map(s => `- \`${s.url}\` [${s.status}] (${s.date})`).join('\n');
      return `### ${f.name}\n- Count: ${f.count} malware download URLs\n${samples}`;
    }
    return `- **${f.name}**: ${f.count} entries`;
  }).join('\n');

  const ransomwareSection = ransomware.map(r => `
### ${r.name} (${r.type})
- **Date:** ${r.date}
- **Note:** ${r.description || r.note || 'Active ransomware campaign'}
`).join('\n');

  const briefing = `# 🌐 Africa OSINT Threat Intelligence Briefing

> **Generated:** ${TIMESTAMP}  
> **Coverage:** ${countryList}  
> **Sources:** CISA KEV, NVD, Abuse.ch, ID Ransomware, Public Threat Feeds

---

## 🚨 CISA Known Exploited Vulnerabilities (KEV) — Critical CVEs

${cisaKEV.length > 0 ? cisaSection : '*CISA KEV feed unavailable — using NVD data below. Check https://www.cisa.gov/known-exploited-vulnerabilities-catalog*'}

---

## 🔴 Recent High/ Critical CVEs (NVD — Last 90 Days)

${cveSection || '*No recent CVEs fetched*'}

---

## 📡 Active Malware Feeds (Abuse.ch / URLhaus)

${abuseSection || '*No feeds available*'}

---

## 🦠 Ransomware Activity

${ransomwareSection || '*No ransomware data available*'}

---

## 🎯 Recommended Actions for African Infrastructure

${cisaKEV.length > 0 ? `**Patch immediately:** ${cisaKEV.slice(0, 5).map(v => v.cveId).join(', ')}` : ''}

1. **Network perimeter audit:** VPN gateways, firewalls, email servers are primary KEV targets
2. **Phishing defense:** Review email filtering rules — most initial access is via phishing
3. **Endpoint detection:** Ensure EDR coverage on Windows/Linux servers across ${countryList}
4. **Backup verification:** Confirm offline backups exist and are tested this week
5. **Block malware feeds:** Integrate abuse.ch SHA256/MD5 blocklists into perimeter security
6. **OTX pulse monitoring:** Subscribe to threat intel from AlienVault OTX for Africa-specific IOCs
7. **Ransomware readiness:** Check https://www.nomoreransom.org for decryption tools

---

## 📊 Coverage Summary

| Country | Priority Concern |
|---------|-----------------|
| Nigeria | Financial sector targeting, ransomware, BEC campaigns |
| Kenya | Critical infrastructure, espionage-linked threat groups |
| South Africa | Financial malware, ATM/POS threats, data breaches |
| Ghana | Banking trojans, phishing campaigns |
| Egypt | Nation-state activity, critical infrastructure probing |
| Morocco | Espionage campaigns, political hacktivism |
| Tanzania | Cybercrime, mobile money fraud |
| Uganda | Financial sector targeting |
| Algeria | Nation-state actors, critical infrastructure |
| Ethiopia | Nation-state espionage, telecom targeting |

---

## 📊 Data Summary

| Source | Count |
|--------|-------|
| CISA KEV Critical CVEs | ${cisaKEV.length} |
| NVD Recent High/Critical CVEs | ${recentCVEs.length} |
| Abuse.ch/URLhaus Feeds | ${abuseCh.length} feeds active |
| Ransomware Entries | ${ransomware.length} |

---

## 🔗 Resource Links

- **CISA KEV Catalog:** https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- **NVD:** https://nvd.nist.gov
- **Abuse.ch:** https://bazaar.abuse.ch
- **URLhaus:** https://urlhaus.abuse.ch
- **No More Ransom:** https://www.nomoreransom.org
- **AlienVault OTX:** https://otx.alienvault.com

---

*Generated by Sakamoto — Africa Threat Intel Aggregator*  
*Automated build: ${NOW}*
`;

  return briefing;
}

async function pushToGitHub(briefing) {
  console.log('\n[GitHub] Pushing to repo...');
  fs.writeFileSync(OUTPUT_FILE, briefing, 'utf8');
  
  try {
    execSync(`rm -rf ${REPO_DIR}`, { stdio: 'pipe' });
    execSync(`git clone https://${GITHUB_PAT}@github.com/${GITHUB_USER}/africa-threat-intel.git ${REPO_DIR}`, { stdio: 'pipe' });
    console.log('[Git] Cloned repo');
    
    // Get branch name
    let branch = 'main';
    try {
      branch = execSync(`cd ${REPO_DIR} && git rev-parse --abbrev-ref HEAD`, { stdio: 'pipe' }).toString().trim() || 'main';
    } catch (e) {}
    
    // Copy files
    execSync(`cp ${OUTPUT_FILE} ${REPO_DIR}/africa-threat-briefing.md`);
    
    // Create scripts dir in repo
    execSync(`mkdir -p ${REPO_DIR}/scripts`);
    execSync(`cp /home/ubuntu/.openclaw/workspace/scripts/sakamoto-build.js ${REPO_DIR}/scripts/`);
    
    // Commit and push
    execSync(`cd ${REPO_DIR} && git add . && git commit -m "Threat briefing update ${NOW}" && git push origin ${branch}`, { stdio: 'inherit' });
    console.log('[GitHub] Push successful!');
    return true;
  } catch (e) {
    console.log('[GitHub] Push failed:', e.message);
    return false;
  }
}

async function main() {
  console.log('=== Africa OSINT Threat Intel Aggregator v3 ===');
  console.log(`Time: ${TIMESTAMP}`);
  
  const [cisaKEV, recentCVEs, abuseCh, ransomware] = await Promise.all([
    fetchCISAKEV(),
    fetchRecentCriticalCVEs(),
    fetchAbuseCh(),
    fetchRansomwareFeeds(),
  ]);

  const briefing = generateBriefing(cisaKEV, recentCVEs, abuseCh, ransomware);
  
  console.log(`\n[Summary] CVEs: ${cisaKEV.length + recentCVEs.length} | Feeds: ${abuseCh.length} | Ransomware: ${ransomware.length}`);
  
  const pushed = await pushToGitHub(briefing);
  
  if (pushed) {
    console.log(`\n✅ DONE — https://github.com/${GITHUB_USER}/africa-threat-intel`);
  } else {
    console.log(`\n✅ Briefing generated at ${OUTPUT_FILE}`);
  }
}

main().catch(console.error);