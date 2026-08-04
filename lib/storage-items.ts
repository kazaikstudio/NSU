export interface StorageItemLike {
  id: string;
  title: string;
  type: string;
  file_url?: string;
  fileUrl?: string;
  created_at?: string;
  createdAt?: string;
}

export const inMemoryStorageItems: StorageItemLike[] = [];

export function getInMemoryStorageItems() {
  return inMemoryStorageItems.slice();
}

export function pushInMemoryStorageItem(item: StorageItemLike) {
  inMemoryStorageItems.unshift({ ...item });
  return item;
}

export function updateStorageItemTitle<T extends StorageItemLike>(items: T[], id: string, nextTitle: string) {
  const sanitizedTitle = nextTitle.trim();

  return items.map((item) => (
    item.id === id ? { ...item, title: sanitizedTitle || item.title } : item
  ));
}

export function deleteInMemoryStorageItem(id: string) {
  const itemIndex = inMemoryStorageItems.findIndex((item) => item.id === id);

  if (itemIndex === -1) {
    return null;
  }

  const [removedItem] = inMemoryStorageItems.splice(itemIndex, 1);
  return removedItem;
}

export function updateInMemoryStorageItemTitle(id: string, nextTitle: string) {
  const sanitizedTitle = nextTitle.trim();
  const itemIndex = inMemoryStorageItems.findIndex((item) => item.id === id);

  if (itemIndex === -1) {
    return null;
  }

  inMemoryStorageItems[itemIndex] = {
    ...inMemoryStorageItems[itemIndex],
    title: sanitizedTitle || inMemoryStorageItems[itemIndex].title,
  };

  return inMemoryStorageItems[itemIndex];
}
