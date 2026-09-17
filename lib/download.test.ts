import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAudioDownloadName, getAudioDownloadThumbnailUrl } from './download';
import { getStoredThumbnailUrl } from './media-url';

test('audio download names use the title and artist, never the source file name', () => {
  assert.equal(
    buildAudioDownloadName('My Song', 'Example Artist'),
    'My Song, By Example Artist, (Nollstudios.org).mp3',
  );
});

test('audio download names keep only title when no artist is given', () => {
  assert.equal(
    buildAudioDownloadName('My Song'),
    'My Song, (Nollstudios.org).mp3',
  );
});

test('audio download names ignore prefixes like Noll Music', () => {
  assert.equal(
    buildAudioDownloadName('Noll Music - My Song', 'Example Artist'),
    'My Song, By Example Artist, (Nollstudios.org).mp3',
  );
});

test('audio download names honour a provided extension', () => {
  assert.equal(
    buildAudioDownloadName('My Song', 'Example Artist', 'm4a'),
    'My Song, By Example Artist, (Nollstudios.org).m4a',
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

test('audio downloads point to the public noll cover image', () => {
  assert.equal(getAudioDownloadThumbnailUrl(), '/noll.jpg');
});