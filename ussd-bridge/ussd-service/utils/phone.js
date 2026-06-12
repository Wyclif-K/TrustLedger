// =============================================================================
// TrustLedger USSD - Phone normalization (keep in sync with backend/utils/phone.js)
// =============================================================================

'use strict';

function digitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function normalizePhoneE164(raw) {
  const s = String(raw || '').trim().replace(/[\s\-().]/g, '');
  if (!s) return null;
  const d = digitsOnly(s);

  if (s.startsWith('+') && d.length >= 10) return `+${d}`;

  if (/^0[7-9]\d{8}$/.test(d)) return `+256${d.slice(1)}`;
  if (/^[7-9]\d{8}$/.test(d)) return `+256${d}`;
  if (/^256[7-9]\d{8}$/.test(d)) return `+${d}`;

  if (/^254\d{9}$/.test(d)) return `+${d}`;
  if (/^0[17]\d{8}$/.test(d)) return `+254${d.slice(1)}`;

  if (d.length >= 10) return `+${d}`;

  return null;
}

function phoneLookupVariants(raw) {
  const out = new Set();
  const s = String(raw || '').trim().replace(/[\s\-().]/g, '');
  if (!s) return [];

  const d = digitsOnly(s);
  const e164 = normalizePhoneE164(raw);

  out.add(s);
  if (s.startsWith('+')) out.add(s.slice(1));
  if (d) {
    out.add(d);
    out.add(`+${d}`);
  }
  if (e164) {
    out.add(e164);
    out.add(e164.slice(1));
    if (e164.startsWith('+256')) {
      const national = e164.slice(4);
      out.add(national);
      out.add(`0${national}`);
      out.add(`256${national}`);
    }
    if (e164.startsWith('+254')) {
      const national = e164.slice(4);
      out.add(national);
      out.add(`0${national}`);
      out.add(`254${national}`);
    }
  }

  return [...out].filter(Boolean);
}

module.exports = { digitsOnly, normalizePhoneE164, phoneLookupVariants };
