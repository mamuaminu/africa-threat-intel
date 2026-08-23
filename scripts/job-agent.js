#!/usr/bin/env node
/**
 * Job Agent v8 — Find fresh jobs, apply one per run, send digest
 * Greenhouse API (correct endpoint) + LinkedIn search
 * Cookie banner handling for forms
 * Apply ONE job per run to avoid OOM
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const RESUME_PATH = '/home/ubuntu/.openclaw/workspace/seclab-nigeria/public/resume.pdf';
const OUT_DIR = '/home/ubuntu/.openclaw/workspace/jobs';
const TRACKER_FILE = path.join(OUT_DIR, 'applied.json');
const FRESH_FILE = path.join(OUT_DIR, 'fresh_jobs.json');
const LOG_FILE = path.join(OUT_DIR, `job-agent-${new Date().toISOString().slice(0,10)}.log`);
const COOKIE_FILE = path.join(OUT_DIR, 'cookies', 'linkedin.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(path.join(OUT_DIR, 'cookies'))) fs.mkdirSync(path.join(OUT_DIR, 'cookies'), { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.error(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function loadTracker() {
  try { return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8')); }
  catch { return { applied: [], appliedUrls: [] }; }
}
function saveTracker(t) { fs.writeFileSync(TRACKER_FILE, JSON.stringify(t, null, 2)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function dismissBanner(page) {
  // Try multiple ways to dismiss cookie banners
  return page.evaluate(() => {
    const selectors = [
      '.iubenda-cs-close-btn',
      '.iubenda-cs-accept-btn',
      '#iubenda-cs-accept-cookie-policy',
      '[aria-label="Close"]',
      '.cookie-banner button',
      '#cookie-notice button'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { el.click(); return 'dismissed: ' + sel; }
    }
    return 'no-banner';
  });
}

function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
    )
  ]);
}

async function tryApplyOne(url, title) {
  const tracker = loadTracker();
  const norm = url.split('?')[0];
  if (tracker.appliedUrls.includes(norm)) {
    log(`Already applied to: ${title.slice(0, 50)}`);
    return null;
  }

  let browser;
  try {
    browser = await withTimeout(
      chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--disable-accelerated-2d-canvas']
      }),
      30000,
      'chromium.launch'
    );
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' });
    const page = await ctx.newPage();

    await withTimeout(page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }), 25000, 'page.goto');
    await withTimeout(new Promise(r => page.waitForTimeout(2500).then(r).catch(r)), 5000, 'wait1');
    await dismissBanner(page);
    await withTimeout(new Promise(r => page.waitForTimeout(500).then(r).catch(r)), 3000, 'wait2');

    // Check for Greenhouse iframe form
    const frames = page.frames();
    let applied = false;

    for (const frame of frames) {
      try {
        const frameUrl = frame.url();
        if (frameUrl.includes('greenhouse') || frameUrl.includes('apply')) {
          const hasEmail = await frame.locator('input[type="email"]').isVisible().catch(() => false);
          if (hasEmail) {
            await frame.locator('input[type="email"]').fill('muhammadaminu.dev@gmail.com');
            await frame.locator('input[name="name"], input[placeholder*="name"]').first().fill('Muhammad Aminu Musa').catch(() => {});
            const fi = frame.locator('input[type="file"]').first();
            if (await fi.isVisible().catch(() => false)) {
              await fi.setInputFiles(RESUME_PATH);
              await withTimeout(new Promise(r => page.waitForTimeout(1000).then(r).catch(r)), 5000, 'upload');
            }
            const sub = frame.locator('button[type="submit"]').first();
            if (await sub.isVisible().catch(() => false)) {
              await sub.click();
              await withTimeout(new Promise(r => page.waitForTimeout(2000).then(r).catch(r)), 5000, 'submit');
              tracker.applied.push({ title, url: norm, date: new Date().toISOString() });
              tracker.appliedUrls.push(norm);
              saveTracker(tracker);
              log(`  ✅ Applied via iframe: ${title.slice(0, 50)}`);
              applied = true;
            }
          }
        }
      } catch {}
    }

    // Try main page if not applied via iframe
    if (!applied) {
      await dismissBanner(page);
      await withTimeout(new Promise(r => page.waitForTimeout(500).then(r).catch(r)), 3000, 'wait2');

      // Look for Apply button on main page
      const applyBtn = page.locator('text=Apply Now, text=Apply for this job, text=Apply').first();
      if (await applyBtn.isVisible().catch(() => false)) {
        await applyBtn.click().catch(() => {});
        await withTimeout(new Promise(r => page.waitForTimeout(3000).then(r).catch(r)), 8000, 'clickWait');

        const hasEmail = await page.locator('input[type="email"]').isVisible().catch(() => false);
        if (hasEmail) {
          await page.locator('input[type="email"]').fill('muhammadaminu.dev@gmail.com');
          await page.locator('input[name="name"], input[placeholder*="name"]').first().fill('Muhammad Aminu Musa').catch(() => {});
          const fi = page.locator('input[type="file"]').first();
          if (await fi.isVisible().catch(() => false)) {
            await fi.setInputFiles(RESUME_PATH);
            await withTimeout(new Promise(r => page.waitForTimeout(1000).then(r).catch(r)), 5000, 'upload');
          }
          const sub = page.locator('button[type="submit"], text=Submit Application').first();
          if (await sub.isVisible().catch(() => false)) {
            await sub.click();
            await withTimeout(new Promise(r => page.waitForTimeout(2000).then(r).catch(r)), 5000, 'submit');
            tracker.applied.push({ title, url: norm, date: new Date().toISOString() });
            tracker.appliedUrls.push(norm);
            saveTracker(tracker);
            log(`  ✅ Applied: ${title.slice(0, 50)}`);
            applied = true;
          }
        }
      }
    }

    await ctx.close();
    await browser.close();
    return applied ? { title, url: norm } : null;

  } catch (e) {
    try { if (browser) await browser.close().catch(() => {}); } catch {}
    log(`  Error applying to ${title.slice(0, 40)}: ${e.message.split('\n')[0]}`);
    return null;
  }
}

async function fetchGreenhouseJobs() {
  const boards = [
    // Big tech / AI-forward companies
    'openai', 'anthropic', 'google', 'meta', 'microsoft', 'apple',
    'nvidia', 'amd', 'intel', 'qualcomm', 'ibm', 'amazon',
    // AI-native / ML platforms
    'huggingface', 'weightsandbiases', 'wandb', 'cohere', 'azure-openai',
    'replicate', 'assemblyai', 'deepgram', 'elevenlabs',
    // Cloud / Infra
    'vercel', 'shopify', 'notion', 'linear', 'gitlab', 'mongodb',
    'atlassian', 'coinbase', 'airbnb', 'stripe', 'elastic', 'twilio',
    'datadog', 'cloudflare', 'hashicorp', 'automattic', 'confluent',
    'snowflake', 'discord', 'spotify', 'twitch', 'snap', 'pinterest',
    // Security
    'crowdstrike', 'paloaltonetworks', 'mandiant', 'sentinelone',
    // Data / Analytics
    'databricks', 'snowflake', 'fivetran', 'alteryx'
  ];

  const keywords = [
    // Core AI/ML — his primary focus
    'ai engineer', 'machine learning', 'ml engineer', 'deep learning',
    'nlp', 'natural language', 'llm', 'prompt engineer', 'ai automation',
    'computer vision', 'data scientist', 'ai researcher',
    // Python / Backend
    'python', 'backend', 'fullstack', 'full-stack', 'software', 'developer',
    'engineer', 'node', 'api', 'automation', 'scripting',
    // DevOps / SRE / Cloud
    'devops', 'sre', 'site reliability', 'platform', 'cloud', 'aws', 'azure', 'gcp',
    'infrastructure', 'security', 'cybersecurity', 'pentest', 'penetration',
    // Frontend
    'frontend', 'react', 'typescript', 'javascript',
    // Data / Infra
    'data engineer', 'etl', 'etl engineer', 'database', 'network', 'systems'
  ];

  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const jobs = [];

  for (const board of boards) {
    try {
      const data = await httpGet(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
      const parsed = JSON.parse(data);
      for (const j of parsed.jobs || []) {
        const updated = new Date(j.updated_at).getTime();
        if (updated >= cutoff) {
          const t = (j.title || '').toLowerCase();
          if (keywords.some(k => t.includes(k))) {
            jobs.push({
              title: j.title,
              company: board,
              url: j.absolute_url,
              source: 'Greenhouse',
              updated: j.updated_at.slice(0, 10)
            });
          }
        }
      }
    } catch {}
    await withTimeout(new Promise(r => setTimeout(r, 500)), 3000, 'ghDelay');
  }

  return jobs;
}

async function fetchLinkedInJobs(tracker, existingUrls) {
  let browser;
  try {
    browser = await withTimeout(
      chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'] }),
      30000,
      'chromium.launch'
    );
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 }
    });
    const page = await ctx.newPage();

    const queries = [
      // AI / ML / Automation — his core focus
      'AI engineer remote jobs',
      'machine learning engineer remote jobs',
      'AI automation engineer remote jobs',
      'NLP engineer remote jobs',
      'LLM prompt engineer remote jobs',
      // Python / Backend
      'python developer remote jobs',
      'backend engineer remote jobs',
      'python automation engineer remote jobs',
      // DevOps / SRE / Cloud
      'devops engineer remote jobs',
      'site reliability engineer remote jobs',
      'platform engineer remote jobs',
      'cloud engineer AWS remote jobs',
      // Security
      'cybersecurity analyst remote jobs',
      'security engineer remote jobs',
      'pentester remote jobs',
      // Frontend / Fullstack
      'react frontend remote jobs',
      'fullstack engineer remote jobs',
      'typescript developer remote jobs',
      // Data / Analytics
      'data engineer remote jobs',
      'ETL engineer remote jobs',
      // Network / Infra
      'network engineer remote jobs',
      'systems administrator remote jobs',
      // Automation / Scripting
      'automation engineer remote jobs',
      'robotics software engineer remote jobs',
    ];
    const jobs = [];

    for (const q of queries) {
      try {
        await withTimeout(page.goto(`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Remote&f_TPR=r259200&sortBy=DD&distance=25`, { waitUntil: 'domcontentloaded', timeout: 20000 }), 25000, 'linkedin.goto');
        await withTimeout(new Promise(r => page.waitForTimeout(4000).then(r).catch(r)), 10000, 'liLoad');
        const found = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="/jobs/"]'))
            .filter(a => a.href.includes('/jobs/view') && !a.href.includes('/jobs/search'))
            .map(a => ({ url: a.href.split('?')[0], title: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) }))
            .filter(j => j.title.length > 10)
            .slice(0, 8);
        });
        found.forEach(j => {
          const norm = j.url.split('?')[0];
          if (!existingUrls.has(norm) && !tracker.appliedUrls.includes(norm)) {
            jobs.push({ ...j, source: 'LinkedIn' });
            existingUrls.add(norm);
          }
        });
        log(`LinkedIn "${q}": +${found.length}`);
      } catch (e) { log(`LinkedIn error: ${e.message.split('\n')[0]}`); }
      await withTimeout(new Promise(r => setTimeout(r, 3000)), 8000, 'liDelay');
    }

    await ctx.close();
    return jobs;
  } catch (e) {
    log(`LinkedIn fetch error: ${e.message.split('\n')[0]}`);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function main() {
  log('=== Job Agent v8 started ===');
  const tracker = loadTracker();
  log(`Already applied: ${tracker.applied.length}`);

  // Load fresh jobs from last run (don't refetch if < 3 hours old)
  let freshJobs = [];
  try {
    const freshData = JSON.parse(fs.readFileSync(FRESH_FILE, 'utf8'));
    const age = Date.now() - freshData.fetched;
    if (age < 3 * 60 * 60 * 1000) {
      freshJobs = freshData.jobs;
      log(`Using cached fresh jobs (${freshJobs.length}), fetched ${Math.round(age / 60000)}min ago`);
    }
  } catch {}

  if (freshJobs.length === 0) {
    log('Fetching fresh Greenhouse jobs...');
    const ghJobs = await fetchGreenhouseJobs();
    log(`Found ${ghJobs.length} fresh Greenhouse jobs`);
    freshJobs.push(...ghJobs);
    fs.writeFileSync(FRESH_FILE, JSON.stringify({ jobs: freshJobs, fetched: Date.now() }, null, 2));
  }

  // Dedupe
  const seen = new Set(tracker.appliedUrls);
  const unapplied = freshJobs.filter(j => !seen.has(j.url.split('?')[0]));
  log(`${unapplied.length} unapplied`);

  // Try to apply to ONE job
  const target = unapplied[0];
  let appliedNow = null;
  if (target) {
    log(`Applying to: ${target.title.slice(0, 60)}`);
    const result = await tryApplyOne(target.url, target.title);
    if (result) appliedNow = result;
  }

  // Fetch fresh LinkedIn jobs
  const liJobs = await fetchLinkedInJobs(tracker, new Set(unapplied.map(j => j.url.split('?')[0])));
  // Shuffle so digest shows variety, not all one company
  const shuffled = [...unapplied, ...liJobs].sort(() => Math.random() - 0.5);
  const allFresh = shuffled.slice(0, 25);

  const tracker2 = loadTracker();
  const total = tracker2.applied.length;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  let msg = `🛠 *Job Agent — ${today}*\n`;
  msg += `🔍 *${freshJobs.length} Greenhouse + ${liJobs.length} LinkedIn* = *${freshJobs.length + liJobs.length} fresh jobs* | 📊 *${total} total applied*\n\n`;

  if (appliedNow) {
    msg += `✅ *Applied today:* ${appliedNow.title.slice(0, 60)}\n\n`;
  }

  if (allFresh.length > 0) {
    msg += `📋 *Fresh — tap to apply:*\n`;
    allFresh.forEach((j, i) => {
      const t = j.title.length > 55 ? j.title.slice(0, 52) + '...' : j.title;
      const src = j.company ? `[@${j.company}]` : `[${j.source}]`;
      msg += `${i + 1}. ${t} ${src}\n   ${j.url}\n`;
    });
  }

  msg += `\n⚠️ *Greenhouse auto-apply blocked by reCAPTCHA on most boards.*\n`;
  msg += `Tap the links above to apply manually. Target 3-5 daily.`;

  console.log('=== TG_MSG_START ===\n' + msg + '\n=== TG_MSG_END ===');
  log(`=== Done — applied: ${appliedNow ? 1 : 0}, total: ${total} ===`);

  console.log('=== TG_MSG_START ===\n' + msg + '\n=== TG_MSG_END ===');
  log(`=== Done — applied: ${appliedNow ? 1 : 0}, total: ${total} ===`);
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
