// =============================================================================
// TrustLedger - Phone normalization (USSD / member lookup)
// Africa's Talking may send +256…, 256…, 078…, or 9-digit national numbers.
// =============================================================================

'use strict';

function digitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/**
 * Normalize caller ID to E.164 (+256… Uganda, +254… Kenya sandbox).
 */
function normalizePhoneE164(raw) {
  const s = String(raw || '').trim().replace(/[\s\-().]/g, '');
  if (!s) return null;
  const d = digitsOnly(s);

  if (s.startsWith('+') && d.length >= 10) return `+${d}`;

  // Uganda local 07XXXXXXXX
  if (/^0[7-9]\d{8}$/.test(d)) return `+256${d.slice(1)}`;

  // Uganda national 7XXXXXXXX (9 digits)
  if (/^[7-9]\d{8}$/.test(d)) return `+256${d}`;

  // Uganda 256XXXXXXXXX
  if (/^256[7-9]\d{8}$/.test(d)) return `+${d}`;

  // Kenya (Africa's Talking sandbox often uses +254…)
  if (/^254\d{9}$/.test(d)) return `+${d}`;
  if (/^0[17]\d{8}$/.test(d)) return `+254${d.slice(1)}`;

  if (d.length >= 10) return `+${d}`;

  return null;
}

/** All plausible stored / transmitted forms for PostgreSQL `phone IN (…)`. */
function phoneLookupVariants(raw) {
  const out = new Set();
  const e164 = normalizePhoneE164(raw);

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
    return [...out].filter(Boolean);
  }

  const s = String(raw || '').trim().replace(/[\s\-().]/g, '');
  const d = digitsOnly(raw);
  if (s) out.add(s);
  if (d) out.add(d);
  return [...out].filter(Boolean);
}

module.exports = { digitsOnly, normalizePhoneE164, phoneLookupVariants };
