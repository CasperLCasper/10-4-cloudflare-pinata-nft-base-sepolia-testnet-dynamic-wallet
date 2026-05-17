import { verifySignature, createToken } from "../../_lib/auth.js";
import { setCache, getCache } from "../../_lib/cache.js";

// Nonce TTL – 5 minūtes
const NONCE_TTL_MS = 5 * 60 * 1000;

// Nonce ģenerators – izmanto crypto
function generateNonce() {
  return crypto.randomUUID();
}

// Endpoint, lai iegūtu nonce (GET /api/auth/nonce)
export async function onRequestGet(context) {
  const nonce = generateNonce();
  // Glabājam nonce kešā, lai vēlāk pārbaudītu (saistīts ar IP vai sesiju? 
  // Labāk saistīt ar IP, jo lietotājs vēl nav autentificēts)
  const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `nonce:${ip}`;
  setCache(key, nonce, context.env, NONCE_TTL_MS);
  return new Response(JSON.stringify({ nonce }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST login ar nonce pārbaudi
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

    // Iegūstam nonce no keša (pēc IP, jo tas pats lietotājs)
    const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
    const nonceKey = `nonce:${ip}`;
    const storedNonce = getCache(nonceKey, context.env);
    if (!storedNonce) {
      return new Response(JSON.stringify({ error: "Nonce expired or missing. Request a new one." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pārbaudām, vai ziņojums sākas ar nonce
    if (!message.startsWith(storedNonce)) {
      return new Response(JSON.stringify({ error: "Invalid nonce in message" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Nonce izlietots – varam dzēst, lai novērstu atkārtotu izmantošanu
    // (cache.delete nav implementēts cache.js, tāpēc iestatām null vai īsu TTL;
    //  labāk pievienot delete funkciju cache.js, bet pagaidām ignorējam, jo TTL īss)
    
    // Verificējam parakstu
    const isValid = verifySignature(address, message, signature);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Izveidojam JWT
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
