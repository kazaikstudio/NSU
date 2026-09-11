import test from 'node:test';
import assert from 'node:assert/strict';

import { getAudioDownloadThumbnailUrl, getDownloadPath } from './download';

test('audio download names include the title, artist, and Nollstudios.org suffix', () => {
  assert.equal(
    getDownloadPath('My Song.mp3', 'audio', 'Example Artist'),
    'My Song, By Example Artist (Nollstudios.org).mp3',
  );
});

test('video downloads keep their original name without the audio suffix', () => {
  assert.equal(
    getDownloadPath('My Song.mp4', 'video'),
    'My Song.mp4',
  );
});

test('audio downloads point to the public noll cover image', () => {
  assert.equal(getAudioDownloadThumbnailUrl(), '/noll.jpg');
});
