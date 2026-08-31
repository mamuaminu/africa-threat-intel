# 🛡️ Africa Threat Intel Aggregator

Automated OSINT threat intelligence briefing for African infrastructure.

## Coverage

**Countries:** Nigeria, Kenya, South Africa, Ghana, Egypt, Morocco, Tanzania, Uganda, Algeria, Ethiopia

## Data Sources

| Source | Status | Description |
|--------|--------|-------------|
| NVD / NIST | ✅ Active | National Vulnerability Database CVE feed |
| Blocklist.de | ✅ Active | Malicious IP blocklist |
| Emerging Threats | ✅ Active | IDS/blocking rules |
| Ransomware Tracker | 🔴 Offline | Abuse.ch ransomware tracking |
| AlienVault OTX | 🔴 Requires API key | Pulse subscriptions |

## Output

- `briefings/threat-briefing-YYYY-MM-DD.md` — Daily markdown briefings
- `latest-briefing.md` — Most recent briefing
- `data/latest-data.json` — Raw JSON data

## Automated Run

```bash
node /home/ubuntu/.openclaw/workspace/scripts/sakamoto-build.js
```

## Notes

- NVD API rate-limits bulk queries; some CVE IDs may fail to fetch
- OTX public pulses require authentication; limited data without API key
- Ransomware Tracker feed was unreachable at last check

---

*🤖 Sakamoto Build System*
