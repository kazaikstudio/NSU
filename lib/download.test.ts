import test from 'node:test';
import assert from 'node:assert/strict';

import { getDownloadPath } from './download';

test('mp3 download names end with Noll Music suffix', () => {
  assert.equal(
    getDownloadPath('My Song.mp3', 'audio'),
    'Noll-Music/Audio/My Song - Noll Music.mp3',
  );
});

test('video downloads keep their original name without Noll Music prefixing', () => {
  assert.equal(
    getDownloadPath('My Song.mp4', 'video'),
    'Noll-Music/Video/My Song.mp4',
  );
});
