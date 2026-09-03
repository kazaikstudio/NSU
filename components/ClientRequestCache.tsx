'use client';

import { useLayoutEffect } from 'react';

const cache = new Map<string, Promise<{ body: ArrayBuffer; headers: [string, string][]; status: number; statusText: string }>>();
let originalFetch: typeof window.fetch | null = null;

function installFetchCache() {
  if (originalFetch || typeof window === 'undefined') return;

  originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url, window.location.href);
    const isSameOrigin = url.origin === window.location.origin;
    const isCacheable = request.method === 'GET'
      && isSameOrigin
      && request.cache !== 'no-store'
      && !url.pathname.startsWith('/api/dashboard/media/');

    if (!isCacheable) {
      if (request.method !== 'GET') cache.clear();
      return originalFetch!(input, init);
    }

    const key = `${request.method}:${url.href}`;
    let cachedResponse = cache.get(key);
    if (!cachedResponse) {
      cachedResponse = originalFetch!(request).then(async (response) => ({
        body: await response.arrayBuffer(),
        headers: Array.from(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
      }));
      cache.set(key, cachedResponse);
      cachedResponse.catch(() => cache.delete(key));
    }

    const result = await cachedResponse;
    return new Response(result.body.slice(0), {
      headers: result.headers,
      status: result.status,
      statusText: result.statusText,
    });
  };
}

export default function ClientRequestCache() {
  useLayoutEffect(() => {
    installFetchCache();
  }, []);

  return null;
}
