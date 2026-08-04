import test from 'node:test';
import assert from 'node:assert/strict';
import { clampUploadProgress, formatUploadStatusMessage, shouldAutoUploadOnSelection } from './talk-show-upload';

test('auto uploads when a file, title, and idle state are present', () => {
  const file = new File(['demo'], 'demo.mp4', { type: 'video/mp4' });
  assert.equal(shouldAutoUploadOnSelection(file, 'Talk Show Clip', false), true);
});

test('does not auto upload when title is missing', () => {
  const file = new File(['demo'], 'demo.mp4', { type: 'video/mp4' });
  assert.equal(shouldAutoUploadOnSelection(file, '   ', false), false);
});

test('does not auto upload while already uploading', () => {
  const file = new File(['demo'], 'demo.mp4', { type: 'video/mp4' });
  assert.equal(shouldAutoUploadOnSelection(file, 'Talk Show Clip', true), false);
});

test('clamps upload progress to a valid percentage range', () => {
  assert.equal(clampUploadProgress(120), 100);
  assert.equal(clampUploadProgress(-10), 0);
  assert.equal(clampUploadProgress(42.6), 43);
});

test('formats the fallback message without exposing raw Google Drive errors', () => {
  assert.equal(
    formatUploadStatusMessage('Unable to reach Google Drive: fetch failed'),
    'Uploaded locally because Google Drive was unavailable. The file is saved and ready in storage.'
  );
  assert.equal(
    formatUploadStatusMessage('Some other issue'),
    'Uploaded locally because Google Drive was unavailable. Some other issue'
  );
});
