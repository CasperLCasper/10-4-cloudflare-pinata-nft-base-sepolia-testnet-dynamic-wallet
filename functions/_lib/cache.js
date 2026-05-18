// functions/_lib/cache.js
import { Redis } from "@upstash/redis";

let redis;

function getRedis(env) {
  if (!redis && env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export async function getCache(key, env) {
  const r = getRedis(env);
  if (!r) return null;
  try {
    const value = await r.get(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.error("Redis getCache error:", e);
    return null;
  }
}

export async function setCache(key, value, env, ttlMs = 60000) {
  const r = getRedis(env);
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), { ex: Math.ceil(ttlMs / 1000) });
  } catch (e) {
    console.error("Redis setCache error:", e);
  }
}

export async function deleteCache(key, env) {
  const r = getRedis(env);
  if (!r) return;
  try {
    await r.del(key);
  } catch (e) {
    console.error("Redis deleteCache error:", e);
  }
}
