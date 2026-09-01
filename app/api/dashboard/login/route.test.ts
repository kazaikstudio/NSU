import test from 'node:test';
import assert from 'node:assert/strict';

import { POST } from './route';

test('login route sets a dashboard session cookie for valid credentials', async () => {
  const response = await POST(
    new Request('http://localhost/api/dashboard/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nollstudio@gmail.com',
        password: '12345',
      }),
    }),
  );

  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie && setCookie.includes('nsu_dashboard_session='));
});
