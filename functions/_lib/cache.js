const cache = new Map();

export function getCache(key, env) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

export function setCache(key, value, env, ttlMs = 60000) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function deleteCache(key) {
  cache.delete(key);
}
