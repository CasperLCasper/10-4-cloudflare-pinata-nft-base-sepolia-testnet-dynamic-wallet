const cache = new Map();

export function getCache(key) {
  return cache.get(key);
}

export function setCache(key, value, ttlMs = 60000) {
  cache.set(key, value);

  setTimeout(() => {
    cache.delete(key);
  }, ttlMs);
}
