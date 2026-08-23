#!/usr/bin/env node
/**
 * LinkedIn Content Draft Generator
 * 
 * Generates varied LinkedIn post drafts across multiple pillars:
 * Cybersecurity, AI/Automation, Frontend, Opinion, Career, Product
 * 
 * Usage:
 *   node linkedin-draft.js                    # Random pillar + topic
 *   node linkedin-draft.js --topic=cybersecurity  # Specific pillar
 *   node linkedin-draft.js --quick           # Short-form post
 * 
 * Output: /home/ubuntu/.openclaw/workspace/linkedin/drafts/YYYY-MM-DD-[topic].md
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/home/ubuntu/.openclaw/workspace/linkedin/drafts';
const TODAY = new Date().toISOString().split('T')[0];

// Parse args
const args = process.argv.slice(2);
let mode = 'random';
let topic = null;

for (const arg of args) {
  if (arg === '--quick') mode = 'quick';
  else if (arg.startsWith('--topic=')) topic = arg.split('=')[1];
  else if (arg.startsWith('--')) topic = arg.replace('--', '');
}

// ── Helpers ────────────────────────────────────────────────────

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Pillar: Cybersecurity ───────────────────────────────────────

const CYBERSECURITY = {
  name: 'cybersecurity',
  hooks: [
    "Most security breaches don't happen because of sophisticated hacking — they happen because someone left an admin panel on port 8080.",
    "I audited a company's API last week. They had rate limiting on the login endpoint but nothing else. One enumerate endpoint gave me every user email in the system.",
    "The most dangerous assumption in security is thinking 'nobody will target us.' Automated scanners don't discriminate.",
    "Your application's security is only as good as your worst dependency. Log4Shell was a wake-up call. How many obscure packages do you import?",
    "Penetration testing once a year is not security. Continuous scanning is. Here's the difference and why it matters.",
  ],
  body: [
    "Most security tooling is built for enterprises with dedicated security teams and six-figure budgets. Small teams and solo developers get by with \"best practices\" and hope.",
    "The problem with hope: attackers don't care about your best intentions.",
    "SENTINAL runs 9 security tools against your domain, GitHub repos, and infrastructure — finds the gaps before someone else does. 30 seconds. Plain-English report.",
    "Starting at $8 per scan. No enterprise contract required.",
  ],
  cta: "Try a free scan → sentinal.ng/scan",
  hashtags: ['#Cybersecurity', '#InfoSec', '#AppSec', '#DevSecOps', '#CTO', '#StartupSecurity'],
};

const API_SECURITY = {
  name: 'api-security',
  hooks: [
    "Your REST API is probably leaking data right now. Not because of a bug — because of how you designed it.",
    "I found an IDOR vulnerability in a production API last week that gave me access to any user's account. The company had no clue.",
    "The difference between authentication and authorization is one of the most commonly misunderstood concepts in API development. Here's why it matters.",
  ],
  body: [
    "IDOR (Insecure Direct Object Reference) is one of the simplest vulnerabilities to find and one of the most damaging. You have a resource — a user ID, an order ID, a file ID — and you trust that if I can't guess it, I can't access it.",
    "The fix isn't hiding IDs. It's verifying that the person making the request actually owns or has permission to access that resource.",
    "SENTINAL's API security checks don't just scan for exposed keys — they analyze your API structure for authorization gaps. 30 seconds.",
  ],
  cta: "Scan your API → sentinal.ng/scan",
  hashtags: ['#APISecurity', '#RESTAPI', '#InfoSec', '#BackendDev', '#WebSecurity'],
};

// ── Pillar: AI / Automation ────────────────────────────────────

const AI_PROMPTS = {
  name: 'ai-automation',
  hooks: [
    "I stopped using ChatGPT for coding advice. Not because it's bad — because it's too helpful. It keeps me from actually learning.",
    "The best AI tool I use daily isn't a chatbot. It's a background process that summarizes my meeting notes and flags action items.",
    "Here's the thing about AI automation: most people use it to do what they were already doing, just faster. That's not transformation — that's compression.",
    "Building an AI agent that actually works is harder than building the demo. Here's why most AI agents fail in production.",
  ],
  body: [
    "The gap between \"AI-powered\" in the marketing copy and \"actually works in production\" is enormous.",
    "Most AI integrations fail because: they weren't designed for real-world edge cases, they have no feedback loop when they get things wrong, and nobody defined what \"good enough\" actually means.",
    "Before you add AI to your product, ask: what does failure look like? And is that acceptable?",
    "If you can't define the failure mode, you can't ship AI responsibly.",
  ],
  cta: "Building AI products? Let's talk → link in bio",
  hashtags: ['#AI', '#MachineLearning', '#AIAgents', '#ProductManagement', '#TechLeadership'],
};

const LLM_OBSERVABILITY = {
  name: 'llm-observability',
  hooks: [
    "You shipped an LLM feature. How do you know it's working correctly 3 months from now?",
    "Most teams have no idea what their LLM is doing in production. Hallucinations go undetected. Prompt drift accumulates. Costs spiral.",
    "LLM observability is the unsexy but critical part of AI products that nobody wants to think about until things go wrong.",
  ],
  body: [
    "Traditional software has logs, metrics, and alerts. LLM applications need the same — plus:",
    "→ Prompt version tracking (which prompt generated this output?)",
    "→ Output validation (is this response actually correct?)",
    "→ Cost attribution (which feature is burning through the API budget?)",
    "→ Drift detection (is the model getting worse at this task over time?)",
    "",
    "Without observability, you're flying blind. With it, you can actually improve your AI product over time.",
  ],
  cta: "Link in bio",
  hashtags: ['#LLMOps', '#AIOps', '#MLOps', '#AIEngineering', '#DeveloperTools'],
};

// ── Pillar: Frontend ───────────────────────────────────────────

const FRONTEND_PERF = {
  name: 'frontend',
  hooks: [
    "Your React app loads in 4 seconds. Here's why that number matters more than your framework benchmark scores.",
    "I deleted 200KB of JavaScript last week and the site got 40% faster. Here's exactly what I cut and why.",
    "Web performance is not about Lighthouse scores. It's about whether your users finish what they came to do.",
    "Three things that kill frontend performance in 2026: oversized JS bundles, unoptimized images, and render-blocking third-party scripts.",
  ],
  body: [
    "Core Web Vitals matter because Google says they do — but more importantly, they matter because slow sites lose users.",
    "Every second of load time costs you roughly 7% of conversions. That 4-second page isn't just annoying — it's expensive.",
    "The fix is usually not \"get a faster server.\" It's usually: audit your JavaScript, lazy-load everything you can, compress images, and kill the third-party scripts you added \"temporarily.\"",
  ],
  cta: "Test your site → pagespeed.web.dev",
  hashtags: ['#Frontend', '#WebPerformance', '#React', '#JavaScript', '#UX'],
};

const CSS_LAYOUTS = {
  name: 'css-layouts',
  hooks: [
    "I spent 2 hours fighting CSS Grid last week. Then I realized I was fighting the wrong battle.",
    "The flexbox-vs-grid debate is a false dichotomy. They solve different problems. Here's when to use which.",
    "Modern CSS has made layouts dramatically easier. If you're still fighting floats, it's time for a reset.",
  ],
  body: [
    "CSS Grid: when you need to control both rows AND columns, or when you want to create truly two-dimensional layouts that respond as a unit.",
    "Flexbox: when you're laying out items in a single direction — a nav bar, a card row, a form layout.",
    "Most layout problems I see in code reviews are people using the wrong tool, then fighting to make it work.",
  ],
  cta: "Link in bio",
  hashtags: ['#CSS', '#Frontend', '#WebDev', '#WebDesign', '#CSSGrid'],
};

// ── Pillar: Opinion ────────────────────────────────────────────

const OPINION_BOARD = {
  name: 'opinion',
  hooks: [
    "Hot take: most \"10x developers\" are just developers who say no to things.",
    "The best code is usually the code you don't write. Every abstraction has a cost.",
    "I've stopped doing estimates for features. Here's what I do instead and why clients actually prefer it.",
    "Shipping something imperfect today beats shipping something perfect in three months.",
  ],
  body: [
    "The perfectionist impulse in development is understandable but costly.",
    "Every day you spend \"making it perfect\" is a day your users are living without the thing you built.",
    "The goal is not perfect code. The goal is code that's good enough to solve the problem, shipped early enough to get real feedback.",
    "Real-world testing beats theoretical optimization every time.",
  ],
  cta: "Agree? Disagree? Let's talk.",
  hashtags: ['#SoftwareEngineering', '#DevLife', '#ProductDevelopment', '#StartupAdvice', '#EngineeringManagement'],
};

const TECH_INDUSTRY = {
  name: 'tech-industry',
  hooks: [
    "The AI coding assistant market is consolidating fast. A year from now, there will be 2-3 winners and a graveyard of also-rans.",
    "Remote work peaked in 2021. What's replacing it isn't hybrid — it's asynchronous-first companies that never set up an office to begin with.",
    "The tech job market in 2026 is not the tech job market of 2021. If you're job hunting with the same strategy, it's time to change.",
  ],
  body: [
    "Every market goes through the same cycle: hype → oversupply → consolidation → maturity.",
    "The AI coding assistant space is in the oversupply phase right now. Every week there's a new one.",
    "The winners will be the ones that: actually improve developer workflows (not just add friction), integrate deeply into existing toolchains, and find ways to be indispensable rather than optional.",
  ],
  cta: "Link in bio",
  hashtags: ['#TechIndustry', '#AI', '#FutureOfWork', '#SoftwareDevelopment', '#TechCareers'],
};

// ── Pillar: Career ─────────────────────────────────────────────

const CAREER_GROWTH = {
  name: 'career',
  hooks: [
    "The fastest way to level up as a developer is to write code that other developers will read. Code reviews are underrated as a learning tool.",
    "I got my biggest career jump not from learning a new framework — but from learning how to communicate technical decisions to non-technical stakeholders.",
    "The difference between a senior developer and a mid-level developer isn't knowing more syntax. It's knowing what NOT to build.",
  ],
  body: [
    "Technical skills compound. But only if you're deliberate about what you're learning and why.",
    "Most developers learn new things defensively — because the industry shifted, or because their job requires it. The ones who accelerate their careers learn new things strategically.",
    "Pick one hard problem. Go deep. Ship something with it. That's how you build expertise that stands out.",
  ],
  cta: "What's your deliberate learning goal for this quarter?",
  hashtags: ['#SoftwareEngineering', '#TechCareers', '#CareerAdvice', '#DeveloperLife', '#Learning'],
};

const FREELANCE = {
  name: 'freelance',
  hooks: [
    "I doubled my freelance rate last year. Here's exactly what changed in how I communicated value.",
    "The biggest mistake freelancers make: quoting a price instead of quoting a result.",
    "Your hourly rate is the wrong unit. Here's what to charge instead.",
  ],
  body: [
    "Clients don't pay for hours. They pay for outcomes. A developer who takes 2 hours to solve something is more valuable than one who takes 20.",
    "When you quote \"X hours at $Y rate,\" you're selling time. When you quote \"this problem solved for $Z,\" you're selling value.",
    "The shift is uncomfortable at first. But once you start thinking in terms of outcomes, your pricing, your client relationships, and your own confidence all transform.",
  ],
  cta: "Need help positioning your freelance business? Let's talk.",
  hashtags: ['#Freelancing', '#IndieDev', '#Entrepreneurship', '#RemoteWork', '#SideHustle'],
};

// ── Pillar: Security (General) ────────────────────────────────

const PASSWORD_MGMT = {
  name: 'password-security',
  hooks: [
    "The reason password rules like \"must include a number and special character\" don't work: humans just append a number and ! to the same base password they've used for 10 years.",
    "Every major data breach in the last 5 years has included password dumps. If you're not using a password manager, every breach is also your breach.",
    "The 2017 LinkedIn breach exposed 117 million accounts. If you haven't changed your LinkedIn password since 2017, do it now.",
  ],
  body: [
    "Password managers are not optional in 2026. They're as basic as having a bank account.",
    "The argument \"it's inconvenient\" doesn't hold. The inconvenience of remembering 50 passwords is nothing compared to the inconvenience of having your accounts compromised.",
    "1Password, Bitwarden, NordPass — pick one. Enable 2FA everywhere. Use passkeys where supported. That's the baseline.",
  ],
  cta: "sentinal.ng/scan — run a security scan on your domain",
  hashtags: ['#PasswordSecurity', '#2FA', '#InfoSec', '#Cybersecurity', '#Privacy'],
};

// ── All pillars ────────────────────────────────────────────────

const ALL_PILLARS = [
  CYBERSECURITY,
  API_SECURITY,
  AI_PROMPTS,
  LLM_OBSERVABILITY,
  FRONTEND_PERF,
  CSS_LAYOUTS,
  OPINION_BOARD,
  TECH_INDUSTRY,
  CAREER_GROWTH,
  FREELANCE,
  PASSWORD_MGMT,
];

// ── Quick short-form template ──────────────────────────────────

const QUICK_POSTS = [
  {
    hook: "Built something in a weekend that I shipped to 200 users. Here's what I learned.",
    body: [
      "Weekend projects are underrated. No committee, no sprint planning, no scope creep — just build and ship.",
      "The constraint of 48 hours forces decisions that would otherwise take weeks. What's the minimum viable version? What can I cut? What actually matters?",
      "Most of my best products started as weekend experiments. The difference between a side project and a real product is mostly just whether you shipped it.",
    ],
    cta: "What's your weekend project? Let's compare notes.",
    hashtags: ['#IndieHacking', '#BuildInPublic', '#SideProject', '#ProductDevelopment', '#Entrepreneurship'],
  },
  {
    hook: "The most underrated skill in software engineering is reading error messages carefully.",
    body: [
      "I was debugging a production issue for 45 minutes. The error was in the logs. I'd been skimming past it because it \"looked like boilerplate.\"",
      "It wasn't boilerplate. It was the exact line telling me what was wrong.",
      "Read the full error. Read it again. Then search. Then read it one more time.",
    ],
    cta: "Link in bio",
    hashtags: ['#SoftwareEngineering', '#Debugging', '#DevLife', '#LearnInPublic', '#WebDev'],
  },
  {
    hook: "Unpopular opinion: most \"best practices\" are just opinions from people who shipped less than you.",
    body: [
      "Best practices have context. A practice that works at Google doesn't automatically work at a 5-person startup.",
      "The question isn't \"is this a best practice?\" — it's \"does this practice fit my situation?\"",
      "Take best practices seriously, but verify before you adopt.",
    ],
    cta: "What's a 'best practice' you've questioned?",
    hashtags: ['#SoftwareEngineering', '#StartupAdvice', '#DevOps', '#EngineeringCulture'],
  },
  {
    hook: "Three lines of code that saved us from a production incident at 2am.",
    body: [
      "A health check endpoint. That's it. That's what caught the memory leak before it took down the service.",
      "If you don't have health checks, add them today. If you do have them, test them under load. They're only useful if they actually work when things break.",
    ],
    cta: "sentinal.ng/scan — check your infrastructure health",
    hashtags: ['#DevOps', '#SiteReliability', '#BackendDev', '#InfraSec', '#Production'],
  },
];

// ── Format a post ─────────────────────────────────────────────

function formatPost(data, pillar) {
  const lines = [];
  lines.push(`# LinkedIn Post Draft — ${TODAY}`);
  lines.push('');
  lines.push(`**Topic:** ${pillar}`);
  lines.push(`**Generated:** ${new Date().toUTCString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(data.hook);
  lines.push('');
  for (const para of data.body) {
    lines.push(para);
    lines.push('');
  }
  lines.push(data.cta);
  lines.push('');
  lines.push(data.hashtags.join(' '));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('**Notes:**');
  lines.push('- Adjust hook to match your audience/voice');
  lines.push('- Keep body paragraphs short (LinkedIn algorithm prefers it)');
  lines.push('- Best posting times: 7-9am local, 12-2pm local, 6-8pm local');
  lines.push('- Add a relevant image/screenshot for 2x engagement');
  lines.push('');
  lines.push(`**Character count:** ~${lines.join('\n').length}`);

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let selected;
  let pillar;

  if (mode === 'quick') {
    selected = pickRandom(QUICK_POSTS);
    pillar = 'quick';
  } else if (topic) {
    const topicMap = {
      'cybersecurity': CYBERSECURITY,
      'api-security': API_SECURITY,
      'ai': AI_PROMPTS,
      'llm': LLM_OBSERVABILITY,
      'frontend': FRONTEND_PERF,
      'css': CSS_LAYOUTS,
      'opinion': OPINION_BOARD,
      'industry': TECH_INDUSTRY,
      'career': CAREER_GROWTH,
      'freelance': FREELANCE,
      'passwords': PASSWORD_MGMT,
    };
    selected = topicMap[topic?.toLowerCase()] || pickRandom(ALL_PILLARS);
    pillar = selected.name;
  } else {
    selected = pickRandom(ALL_PILLARS);
    pillar = selected.name;
  }

  const post = formatPost(selected, pillar);
  const filename = `${OUTPUT_DIR}/${TODAY}-${pillar}.md`;
  fs.writeFileSync(filename, post, 'utf8');

  console.log(`✅ LinkedIn draft created: ${filename}`);
  console.log('');
  console.log(post);
}

main().catch(console.error);
