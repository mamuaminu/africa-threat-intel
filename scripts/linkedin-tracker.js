#!/usr/bin/env node
/**
 * LinkedIn Post Performance Tracker
 * Run via cron to remind user to log engagement metrics
 *
 * Cron: every 3 days
 *
 * Usage: node linkedin-tracker.js
 */

const ENGAGEMENT_LOG = "/home/ubuntu/.openclaw/workspace/linkedin/drafts/engagement-log.json";
const fs = require("fs");

function loadLog() {
  try {
    return JSON.parse(fs.readFileSync(ENGAGEMENT_LOG, "utf8"));
  } catch {
    return { posts: [], lastUpdated: null };
  }
}

function saveLog(data) {
  fs.writeFileSync(ENGAGEMENT_LOG, JSON.stringify(data, null, 2));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function main() {
  const log = loadLog();
  const posts = log.posts || [];

  console.log("📊 LinkedIn Post Performance Check\n");
  console.log("Your last 3 posts:");

  if (posts.length === 0) {
    console.log("\nNo posts tracked yet.");
    console.log("\nTo get started:");
    console.log("1. Share your LinkedIn profile or post URLs");
    console.log("2. I'll track them and remind you every 3 days to log engagement");
    process.exit(0);
  }

  const recent = posts.slice(-3).reverse();
  recent.forEach((post, i) => {
    const num = i + 1;
    const url = post.url || "No URL";
    const date = post.postedAt ? formatDate(post.postedAt) : "Unknown date";
    console.log(`${num}. ${url} — posted ${date}`);
  });

  console.log("\nReply with engagement numbers for each post:");
  console.log("  - Views");
  console.log("  - Reactions");
  console.log("  - Comments");
  console.log("  - Shares");
  console.log("\nI'll log them and track performance over time.");

  saveLog(log); // touch lastUpdated
}

main().catch(console.error);
