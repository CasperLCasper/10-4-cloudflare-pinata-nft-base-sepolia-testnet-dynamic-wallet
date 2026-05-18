import { verifySignature, createToken } from "../../_lib/auth.js";
import { setCache, getCache, deleteCache } from "../../_lib/cache.js";

const NONCE_TTL_MS = 5 * 60 * 1000;

function generateNonce() {
  return crypto.randomUUID();
}

// GET /api/auth/nonce – izsniedz nonce
export async function onRequestGet(context) {
  const nonce = generateNonce();
  const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `nonce:${ip}`;
  
  // ✅ Asinhronais izsaukums ar await
  await setCache(key, nonce, context.env, NONCE_TTL_MS);
  
  return new Response(JSON.stringify({ nonce }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/auth/login – pārbauda nonce un izsniedz JWT
export async function onRequestPost(context) {
  try {
    let body;
    try {
      body = await context.request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { address, message, signature } = body;
    if (!address || !message || !signature) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
    const nonceKey = `nonce:${ip}`;
    
    // ✅ Asinhronais izsaukums ar await
    const storedNonce = await getCache(nonceKey, context.env);
    
    if (!storedNonce) {
      return new Response(JSON.stringify({ error: "Nonce expired or missing. Request a new one." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!message.startsWith(storedNonce)) {
      return new Response(JSON.stringify({ error: "Invalid nonce in message" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ✅ Dzēšam nonce, lai to nevarētu izmantot atkārtoti
    await deleteCache(nonceKey, context.env);

    // Verificējam parakstu (bez env parametra, kā mūsu atjauninātajā auth.js)
    const isValid = verifySignature(address, message, signature);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = await createToken(address, context.env);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Login error:", err.message);
    return new Response(JSON.stringify({ error: "Login failed: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
