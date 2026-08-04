import test from 'node:test';
import assert from 'node:assert/strict';
import { getTalkShowGoogleConfig } from './google-drive';

test('returns a Talk Show config when Talk Show credentials are configured', () => {
  process.env.TALK_SHOW_CLIENT_ID = 'talk-client-id';
  process.env.TALK_SHOW_CLIENT_SECRET = 'talk-client-secret';
  process.env.TALK_SHOW_REFRESH_TOKEN = 'talk-refresh-token';
  process.env.TALK_SHOW_REDIRECT_URI = 'https://developers.google.com/oauthplayground';

  const config = getTalkShowGoogleConfig();

  assert.equal(config.clientId, 'talk-client-id');
  assert.equal(config.clientSecret, 'talk-client-secret');
  assert.equal(config.refreshToken, 'talk-refresh-token');
  assert.equal(config.redirectUri, 'https://developers.google.com/oauthplayground');
});

test('uses Talk Show credentials for upload configuration', () => {
  process.env.TALK_SHOW_CLIENT_ID = 'talk-upload-client-id';
  process.env.TALK_SHOW_CLIENT_SECRET = 'talk-upload-client-secret';
  process.env.TALK_SHOW_REFRESH_TOKEN = 'talk-upload-refresh-token';
  process.env.TALK_SHOW_REDIRECT_URI = 'https://developers.google.com/oauthplayground';

  const config = getTalkShowGoogleConfig();

  assert.equal(config.clientId, 'talk-upload-client-id');
  assert.equal(config.clientSecret, 'talk-upload-client-secret');
  assert.equal(config.refreshToken, 'talk-upload-refresh-token');
  assert.equal(config.redirectUri, 'https://developers.google.com/oauthplayground');
});
