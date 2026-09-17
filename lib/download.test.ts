import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAudioDownloadName, getAudioDownloadThumbnailUrl } from './download';
import { getStoredThumbnailUrl } from './media-url';

test('audio download names use the title and artist, never the source file name', () => {
  assert.equal(
    buildAudioDownloadName('Abiri', 'SUZZ'),
    'Abiri By artist = SUZZ (Nollstudios.org).mp3',
  );
});

test('audio download names keep only title when no artist is given', () => {
  assert.equal(
    buildAudioDownloadName('My Song'),
    'My Song (Nollstudios.org).mp3',
  );
});

test('audio download names ignore prefixes like Noll Music', () => {
  assert.equal(
    buildAudioDownloadName('Noll Music - My Song', 'Example Artist'),
    'My Song By artist = Example Artist (Nollstudios.org).mp3',
  );
});

test('audio download names always normalize to mp3 output', () => {
  assert.equal(
    buildAudioDownloadName('Abiri', 'SUZZ', 'm4a'),
    'Abiri By artist = SUZZ (Nollstudios.org).mp3',
  );
});

test('audio downloads prefer an actual track thumbnail when present', () => {
  assert.equal(
    getAudioDownloadThumbnailUrl('https://cdn.example.com/cover.jpg'),
    'https://cdn.example.com/cover.jpg',
  );
});

test('stored media thumbnails honour the real thumbnail before the fallback cover', () => {
  assert.equal(
    getStoredThumbnailUrl('/api/dashboard/media/abc123', 'https://cdn.example.com/cover.jpg'),
    'https://cdn.example.com/cover.jpg',
  );
});

test('audio downloads use the site origin for the default cover fallback', () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://nollstudios.org';

  try {
    assert.equal(getAudioDownloadThumbnailUrl(), 'https://nollstudios.org/noll.jpg');
    assert.equal(getAudioDownloadThumbnailUrl('/noll.jpg'), 'https://nollstudios.org/noll.jpg');
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  }
});