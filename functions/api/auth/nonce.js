import { setCache } from "../../_lib/cache.js";

const NONCE_TTL_MS = 5 * 60 * 1000;

export async function onRequestGet(context) {
  const { request, env } = context;

  const sessionId = request.headers.get("X-Session-ID");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing X-Session-ID header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const nonce = crypto.randomUUID();
  const key = `nonce:${sessionId}`;

  await setCache(key, nonce, env, NONCE_TTL_MS);

  return new Response(JSON.stringify({ nonce }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
