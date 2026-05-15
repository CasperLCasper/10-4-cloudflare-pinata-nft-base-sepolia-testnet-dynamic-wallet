const rateLimitMap = new Map();

export function checkRateLimit({ key, limit = 20, windowMs = 60000 }) {
  const now = Date.now();
  const data = rateLimitMap.get(key);

  if (data && now - data.timestamp < windowMs) {
    if (data.count >= limit) {
      return false;
    }
    data.count++;
  } else {
    rateLimitMap.set(key, { count: 1, timestamp: now });
  }

  return true;
}
