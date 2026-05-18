// functions/api/auth/nonce.js
import { setCache } from "../../_lib/cache.js";

function generateNonce() {
  return crypto.randomUUID();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const nonce = generateNonce();
  const key = `nonce:${ip}`;

  // ✅ Pievienots await, lai izmantotu asinhrono Redis versiju
  await setCache(key, nonce, env, 5 * 60 * 1000);

  return new Response(JSON.stringify({ nonce }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
