import test from 'node:test';
import assert from 'node:assert/strict';

import { getAllowedOrigins, resolveAllowedOrigin } from './request-origin';

test('accepts both the apex and www nollstudios.org origins', () => {
  const allowed = getAllowedOrigins();

  assert.ok(allowed.includes('https://nollstudios.org'));
  assert.ok(allowed.includes('https://www.nollstudios.org'));
  assert.equal(resolveAllowedOrigin('https://www.nollstudios.org'), 'https://www.nollstudios.org');
});

test('keeps the configured site origin when the Railway domain is present', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://nollstudios.org';

  try {
    const allowed = getAllowedOrigins();
    assert.ok(allowed.includes('https://nollstudios.org'));
    assert.ok(allowed.includes('https://www.nollstudios.org'));
    assert.equal(resolveAllowedOrigin('https://nollstudios.org'), 'https://nollstudios.org');
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  }
});
