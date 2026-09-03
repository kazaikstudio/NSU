const pendingClientRequests = new Map<string, Promise<unknown>>();
const completedClientRequests = new Set<string>();

export function getClientCachedData<T>(key: string, loader: () => Promise<T>) {
  const existingRequest = pendingClientRequests.get(key);
  if (existingRequest) return existingRequest as Promise<T>;

  const request = loader()
    .then((data) => {
      completedClientRequests.add(key);
      return data;
    })
    .catch((error: unknown) => {
      pendingClientRequests.delete(key);
      completedClientRequests.delete(key);
      throw error;
    });

  pendingClientRequests.set(key, request);
  return request;
}

export function hasClientCachedData(key: string) {
  return completedClientRequests.has(key);
}
