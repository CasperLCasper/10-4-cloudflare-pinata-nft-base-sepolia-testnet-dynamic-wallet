// functions/_lib/cache.js

// Saglabājam lokālo Map, bet tajā glabāsim arī objekta derīguma termiņu
const cache = new Map();

export function getCache(key, env) {
  const cachedItem = cache.get(key);
  
  if (!cachedItem) return null;

  // Pārbaudām, vai kešatmiņas termiņš nav beidzies
  if (Date.now() > cachedItem.expiresAt) {
    cache.delete(key); // Dzēšam vecos datus
    return null;
  }

  return cachedItem.value;
}

export function setCache(key, value, env, ttlMs = 60000) {
  // Tā kā setTimeout serverless vidē pēc Response atgriešanas var netikt izpildīts,
  // mēs vienkārši saglabājam laika zīmogu, kad šim ierakstam ir jābeidzas.
  cache.set(key, {
    value: value,
    expiresAt: Date.now() + ttlMs
  });
}
