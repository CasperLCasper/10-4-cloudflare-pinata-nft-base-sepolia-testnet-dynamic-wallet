import { verifySignature, createToken } from "../../_lib/auth.js";
import { getCache, deleteCache } from "../../_lib/cache.js";

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

    const sessionId = context.request.headers.get("X-Session-ID");
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing X-Session-ID header" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const nonceKey = `nonce:${sessionId}`;
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

    // Dzēšam nonce, lai to nevarētu izmantot atkārtoti
    await deleteCache(nonceKey, context.env);

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
