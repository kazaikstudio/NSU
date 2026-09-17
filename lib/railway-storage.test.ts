import test from 'node:test';
import assert from 'node:assert/strict';

import { generateBucketKey, isBucketKey, resolveBucketFolderName } from './railway-storage';

test('resolveBucketFolderName groups artist media into the correct folders', () => {
  assert.equal(resolveBucketFolderName({ mimeType: 'audio/mpeg', type: 'music' }), 'music');
  assert.equal(resolveBucketFolderName({ mimeType: 'image/png', kind: 'profile' }), 'images');
  assert.equal(resolveBucketFolderName({ mimeType: 'image/jpeg', kind: 'banner' }), 'images');
  assert.equal(resolveBucketFolderName({ mimeType: 'image/png', kind: 'member' }), 'members');
  assert.equal(resolveBucketFolderName({ mimeType: 'video/mp4', type: 'video' }), 'videos');
});

test('generateBucketKey includes folder prefixes and remains bucket-compatible', () => {
  const musicKey = generateBucketKey('song.mp3', 'music');
  const imageKey = generateBucketKey('cover.png', 'images');
  const memberKey = generateBucketKey('Members Pic.png', 'members');
  const videoKey = generateBucketKey('clip.mp4', 'videos');

  assert.match(musicKey, /^music\//);
  assert.match(imageKey, /^images\//);
  assert.match(memberKey, /^members\//);
  assert.match(videoKey, /^videos\//);
  assert.equal(isBucketKey(musicKey), true);
  assert.equal(isBucketKey(imageKey), true);
  assert.equal(isBucketKey(memberKey), true);
  assert.equal(isBucketKey(videoKey), true);
});
