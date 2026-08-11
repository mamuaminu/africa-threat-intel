# 🛡️ Africa OSINT Threat Intel Aggregator

Automated threat intelligence briefings for African infrastructure.

## ⚡ Quick Start

```bash
node scripts/sakamoto-build.js
```

Output: `THREAT_BRIEF.md` - Full markdown briefing

## 📊 Coverage

**Countries:** Nigeria, Kenya, South Africa, Ghana, Egypt, Morocco, Tanzania, Uganda, Algeria, Ethiopia

**Sectors:** Banking & Finance, Telecom, Government, Energy/Utilities, Healthcare

**Data Sources:**
- NVD/NIST CVE Database (requires API key)
- AlienVault OTX pulses
- Emerging Threats blocklists
- Abuse.ch ThreatFox IOCs
- CISA KEV Catalog
- Curated static threat intelligence

## 🔧 Configuration

### NVD API Key (optional)
Get a free API key at https://nvd.nist.gov/developers/api-keys

```bash
export NVD_API_KEY="your-key-here"
```

## 📁 Structure

```
africa-threat-intel/
├── THREAT_BRIEF.md      # Latest briefing
├── threat-data.json     # Raw JSON data
├── scripts/
│   └── sakamoto-build.js
├── briefings/           # Historical briefings
└── README.md
```

## 🤖 Automation

Run via cron for daily briefings:

```cron
0 8 * * * cd /home/ubuntu/.openclaw/workspace/africa-threat-intel && node scripts/sakamoto-build.js && git add -A && git commit -m "Brief $(date +\%Y-\%m-\%d)" && git push
```

## ⚠️ Disclaimer

This tool is for **informational purposes only**. All data is sourced from public OSINT. 
No warranty expressed or implied. Verify independently before taking action.

---

*Built fast. Shipped tonight. ~ Sakamoto*
