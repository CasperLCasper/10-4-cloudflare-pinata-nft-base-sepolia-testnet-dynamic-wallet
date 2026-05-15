// functions/_lib/rateLimit.js

const rateLimitMap = new Map();

export function checkRateLimit({ key, limit = 20, windowMs = 60000 }, env) {
  const now = Date.now();
  const data = rateLimitMap.get(key);

  // Pasīvā atmiņas tīrīšana: ja ieraksta laiks ir vecāks par loga (windowMs) ietvaru, dzēšam to
  if (data && now - data.timestamp >= windowMs) {
    rateLimitMap.delete(key);
  }

  // Atkārtoti nolasām datus pēc iespējamās tīrīšanas
  const freshData = rateLimitMap.get(key);

  if (freshData) {
    if (freshData.count >= limit) {
      return false; // Limits ir pārsniegts
    }
    freshData.count++;
  } else {
    // Ja ieraksta nebija vai tas tikko tika izdzēsts kā vecs, izveidojam jaunu
    rateLimitMap.set(key, { count: 1, timestamp: now });
  }

  return true;
}
