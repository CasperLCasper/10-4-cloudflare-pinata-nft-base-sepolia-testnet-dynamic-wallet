import { Redis } from "@upstash/redis";

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return new Response(JSON.stringify({ error: "Redis env vars missing" }), { status: 500 });
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    // Mēģina ierakstīt un nolasīt testa vērtību
    await redis.set("test-key", "hello-from-cloudflare");
    const value = await redis.get("test-key");
    return new Response(JSON.stringify({ success: true, value }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
