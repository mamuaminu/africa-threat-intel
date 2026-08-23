#!/usr/bin/env node
/**
 * LinkedIn Cookie Extractor
 * Run this ONCE on a machine with a browser where you're logged into LinkedIn.
 * 
 * Instructions:
 * 1. Open your browser and log into LinkedIn (https://www.linkedin.com)
 * 2. Open Developer Tools (F12) → Application tab → Cookies → linkedin.com
 * 3. Find the cookie named "li_at" and copy its value
 * 4. OR install "EditThisCookie" Chrome extension and export li_at
 * 
 * Alternative - run with Playwright on a machine with display:
 * 1. Install: npm install -g playwright && npx playwright install chromium
 * 2. Run: node linkedin-login.js
 * 3. Log in when browser opens
 * 4. Cookies auto-saved
 * 
 * Manual cookie setup:
 * 1. Log into LinkedIn on your computer
 * 2. Press F12 → Application → Cookies → linkedin.com
 * 3. Find li_at cookie → copy Value
 * 4. Send me that value and I'll configure Easy Apply
 */

const fs = require('fs');
const path = require('path');
const COOKIE_FILE = '/home/ubuntu/.openclaw/workspace/jobs/cookies/linkedin.json';

// Check if already configured
if (fs.existsSync(COOKIE_FILE)) {
  try {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'));
    const liAt = cookies.find(c => c.name === 'li_at');
    if (liAt && liAt.value) {
      console.log('✅ LinkedIn session already configured!');
      console.log('   Cookie expires:', liAt.expires);
      console.log('   Path:', COOKIE_FILE);
      process.exit(0);
    }
  } catch {}
}

console.log('📋 LinkedIn Cookie Setup');
console.log('========================');
console.log('');
console.log('To enable LinkedIn Easy Apply, I need your li_at session cookie.');
console.log('');
console.log('Quick way to get it:');
console.log('1. Go to linkedin.com in your browser (while logged in)');
console.log('2. Press F12 → Application tab → Cookies → linkedin.com');
console.log('3. Find "li_at" cookie → copy the Value column');
console.log('4. Send me that value like this:');
console.log('');
console.log('   My LinkedIn li_at cookie: [paste the long string here]');
console.log('');
console.log("I'll save it and LinkedIn Easy Apply will start working automatically.");
console.log('');
console.log('Alternative - one-time browser login:');
console.log('node linkedin-login.js');
