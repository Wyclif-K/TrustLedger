'use strict';

const { normalizePhoneE164, phoneLookupVariants } = require('../utils/phone');

describe('phone utils', () => {
  test('normalizes Uganda local 07… to +256…', () => {
    expect(normalizePhoneE164('0784398905')).toBe('+256784398905');
    expect(normalizePhoneE164('+256784398905')).toBe('+256784398905');
    expect(normalizePhoneE164('256784398905')).toBe('+256784398905');
    expect(normalizePhoneE164('784398905')).toBe('+256784398905');
  });

  test('variants include stored E.164 and local forms', () => {
    const v = phoneLookupVariants('0784398905');
    expect(v).toContain('+256784398905');
    expect(v).toContain('0784398905');
    expect(v).toContain('784398905');
  });

  test('does not produce invalid +078… prefix', () => {
    expect(normalizePhoneE164('0784398905')).not.toBe('+0784398905');
    const v = phoneLookupVariants('0784398905');
    expect(v).not.toContain('+0784398905');
  });
});
