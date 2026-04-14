#!/usr/bin/env node
// =============================================================================
// TrustLedger USSD Service - Interactive CLI Simulator
//
// Simulates a USSD session from your terminal so you can test all menu flows
// without a real handset or Africa's Talking sandbox.
//
// Usage:
//   node scripts/simulate.js
//   node scripts/simulate.js --phone=+256700999999
//   node scripts/simulate.js --url=http://localhost:4000
// =============================================================================

'use strict';

const readline = require('readline');
const axios    = require('axios');

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('='))
);

const BASE_URL  = args.url   || 'http://localhost:4000';
const PHONE     = args.phone || '+256700123456';
const SHORTCODE = '*234#';

const SESSION_ID = `sim-${Date.now()}`;
let inputHistory = [];

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

function q(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function banner() {
  console.log('\n' + '═'.repeat(50));
  console.log('  TrustLedger USSD Simulator');
  console.log('  Phone:    ' + PHONE);
  console.log('  Endpoint: ' + BASE_URL + '/ussd');
  console.log('  Session:  ' + SESSION_ID);
  console.log('═'.repeat(50) + '\n');
}

function printScreen(text) {
  console.log('\n┌' + '─'.repeat(28) + '┐');
  const lines = text.replace(/^(CON|END)\s?/, '').split('\n');
  lines.forEach(line => {
    const padded = line.slice(0, 26).padEnd(26, ' ');
    console.log(`│ ${padded} │`);
  });
  console.log('└' + '─'.repeat(28) + '┘');

  const isEnd = text.startsWith('END');
  if (isEnd) {
    console.log('\n  [ Session ended ]\n');
  }
  return isEnd;
}

async function sendUssd(text) {
  try {
    const res = await axios.post(
      `${BASE_URL}/ussd`,
      new URLSearchParams({
        sessionId:   SESSION_ID,
        serviceCode: SHORTCODE,
        phoneNumber: PHONE,
        text:        text,
        networkCode: '63902',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return res.data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(`\n  ✗ Cannot connect to ${BASE_URL}`);
      console.error('  Make sure the USSD service is running: npm run dev\n');
      process.exit(1);
    }
    throw err;
  }
}

async function main() {
  banner();

  // ── Initial dial ───────────────────────────────────────────────────────────
  console.log(`Dialling ${SHORTCODE}...\n`);
  let response = await sendUssd('');
  let isEnd    = printScreen(response);

  // ── Interactive loop ───────────────────────────────────────────────────────
  while (!isEnd) {
    const input = await q('  Enter option: ');

    if (input.toLowerCase() === 'q' || input.toLowerCase() === 'quit') {
      console.log('\n  [ Simulator exited ]\n');
      break;
    }

    inputHistory.push(input);
    const cumulativeText = inputHistory.join('*');

    response = await sendUssd(cumulativeText);
    isEnd    = printScreen(response);
  }

  // ── Ask to restart ─────────────────────────────────────────────────────────
  const again = await q('  Dial again? (y/n): ');
  if (again.toLowerCase() === 'y') {
    inputHistory = [];
    rl.close();
    // Re-run in a fresh Node process to get a new session
    const { execSync } = require('child_process');
    try {
      execSync(`node ${__filename} --phone=${PHONE} --url=${BASE_URL}`, { stdio: 'inherit' });
    } catch {}
  } else {
    rl.close();
    console.log('\n  Thank you for using TrustLedger USSD Simulator.\n');
  }
}

main().catch(err => {
  console.error('Simulator error:', err.message);
  rl.close();
  process.exit(1);
});
