#!/usr/bin/env node
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || 'http://localhost';

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running this script.');
  process.exit(1);
}

const scopes = ['https://www.googleapis.com/auth/drive.file'];
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('scope', scopes.join(' '));

console.log('Open this URL in your browser and authorize the app:');
console.log(authUrl.toString());
console.log('');
console.log('After Google redirects you, copy the authorization code from the URL and paste it below.');

const rl = createInterface({ input, output });
const code = (await rl.question('Authorization code: ')).trim();
rl.close();

if (!code) {
  console.error('No code was provided.');
  process.exit(1);
}

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  }),
});

const tokenData = await tokenResponse.json();

if (!tokenResponse.ok) {
  console.error('Token exchange failed.');
  console.error(tokenData);
  process.exit(1);
}

if (!tokenData.refresh_token) {
  console.warn('Google did not return a refresh token.');
  console.warn('If you already authorized this app before, revoke the previous consent and run this again.');
}

console.log('');
console.log('Use this in your server environment:');
console.log(`GOOGLE_REFRESH_TOKEN='${tokenData.refresh_token || ''}'`);
console.log('');
console.log('If you want to test the upload immediately, restart the app after updating the environment variable.');
