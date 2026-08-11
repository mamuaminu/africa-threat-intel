# 🌍 Africa Threat Intelligence Aggregator

> Automated daily threat briefings for African infrastructure — CVEs, active threat pulses, ransomware advisories, and actionable recommendations.

## Overview

This repo is auto-updated daily with threat intelligence relevant to African organizations. It scrapes and aggregates:
- **CISA Known Exploited Vulnerabilities (KEV) Catalog**
- **AlienVault Open Threat Exchange (OTX) pulses**
- **NIST National Vulnerability Database (NVD)**
- **CISA Ransomware Advisories**

Coverage: Nigeria, Kenya, South Africa, Ghana, Egypt, Morocco, Tanzania, Uganda, Algeria, Ethiopia

## Automated Build

Runs nightly at midnight UTC via Sakamoto cron job. Generates `threat-briefing-YYYY-MM-DD.md` in the `briefings/` directory.

## Briefings Structure

Each briefing contains:
- **Critical CVEs** from CISA KEV catalog affecting African infrastructure
- **Active Threat Pulses** from AlienVault OTX
- **Top CVEs by Severity** from NVD
- **Recommended Actions** — immediate, short-term, and medium-term
- **Ransomware Advisories** from CISA
- **Data Sources** and freshness timestamps

## Sample Use

```bash
# Pull latest briefing
git pull

# Read today's briefing
cat briefings/threat-briefing-$(date +%Y-%m-%d).md

# Search for a specific country
grep -i "nigeria\|kenya\|south africa" briefings/*.md

# Check for critical CVEs
grep -i "CRITICAL\|CVE-2024" briefings/*.md
```

## Country Coverage

| Country | Status |
|---------|--------|
| 🇳🇬 Nigeria | Active |
| 🇰🇪 Kenya | Active |
| 🇿🇦 South Africa | Active |
| 🇬🇭 Ghana | Active |
| 🇪🇬 Egypt | Active |
| 🇲🇦 Morocco | Active |
| 🇹🇿 Tanzania | Active |
| 🇺🇬 Uganda | Active |
| 🇩🇿 Algeria | Active |
| 🇪🇹 Ethiopia | Active |

## Contributing

Found a threat intel source for African infrastructure? Open an issue or PR.

## Disclaimer

This is an automated aggregation of publicly available threat intelligence. Verify all indicators before acting on them.
