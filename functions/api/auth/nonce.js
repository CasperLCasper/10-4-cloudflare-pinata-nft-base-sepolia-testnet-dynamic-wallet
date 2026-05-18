import { setCache } from "../../_lib/cache.js";

const NONCE_TTL_MS = 5 * 60 * 1000;

function generateNonce() {
  return crypto.randomUUID();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  // 1. Iegūstam vai izveidojam sesijas ID no sīkfaila
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map(c => c.split("="))
  );
  let sessionId = cookies.session_id;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  // 2. Ģenerējam nonce
  const nonce = generateNonce();
  const key = `nonce:${sessionId}`;

  // 3. Saglabājam Redis (asinhrons)
  await setCache(key, nonce, env, NONCE_TTL_MS);

  // 4. Iestatām sīkfailu ar sesijas ID (HttpOnly, SameSite)
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set(
    "Set-Cookie",
    `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300`
  );

  return new Response(JSON.stringify({ nonce }), {
    status: 200,
    headers,
  });
}
