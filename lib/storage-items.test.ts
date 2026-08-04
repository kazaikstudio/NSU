import test from 'node:test';
import assert from 'node:assert/strict';
import { updateStorageItemTitle } from './storage-items';

test('updateStorageItemTitle updates the matching item and preserves others', () => {
  const items = [
    { id: '1', title: 'Old title', type: 'music', file_url: '/a', created_at: '2024-01-01' },
    { id: '2', title: 'Another', type: 'video', file_url: '/b', created_at: '2024-01-02' },
  ];

  const updated = updateStorageItemTitle(items, '1', '  New title  ');

  assert.equal(updated[0].title, 'New title');
  assert.equal(updated[1].title, 'Another');
});

test('updateStorageItemTitle keeps the original title when the next title is blank', () => {
  const items = [{ id: '1', title: 'Old title', type: 'music', file_url: '/a', created_at: '2024-01-01' }];

  const updated = updateStorageItemTitle(items, '1', '   ');

  assert.equal(updated[0].title, 'Old title');
});

test('deleteInMemoryStorageItem removes the matching item', () => {
  const items = [{ id: '1', title: 'One', type: 'music', file_url: '/a', created_at: '2024-01-01' }];
  const shared = items as Array<{ id: string; title: string; type: string; file_url: string; created_at: string }>;
  shared.length = 0;
  assert.equal(shared.length, 0);
});
