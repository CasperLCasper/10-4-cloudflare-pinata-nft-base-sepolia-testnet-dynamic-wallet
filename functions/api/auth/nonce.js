// functions/api/auth/nonce.js
import { setCache, getCache, deleteCache } from "../../_lib/cache.js";

/**
 * Ģenerē nejaušu nonce, izmantojot Web Crypto API.
 */
function generateNonce() {
  return crypto.randomUUID();
}

/**
 * GET /api/auth/nonce
 * Izsniedz unikālu nonce, kas derīgs 5 minūtes un piesaistīts klienta IP.
 */
export async function onRequestGet(context) {
  const { request, env } = context;

  // Izmantojam IP, lai piesaistītu nonce konkrētam lietotājam (pirms autentifikācijas)
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const nonce = generateNonce();
  const key = `nonce:${ip}`;

  // Saglabājam kešā ar 5 minūšu TTL
  setCache(key, nonce, env, 5 * 60 * 1000);

  return new Response(JSON.stringify({ nonce }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
