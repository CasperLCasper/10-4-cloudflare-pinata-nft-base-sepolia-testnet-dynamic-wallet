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

    // 1. Nolasām sesijas ID no sīkfaila
    const cookieHeader = context.request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split("; ").map(c => c.split("="))
    );
    const sessionId = cookies.session_id;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Session not found. Request a new nonce." }), {
        status: 401,
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

    // 2. Pārbaudām, vai ziņojums sākas ar nonce
    if (!message.startsWith(storedNonce)) {
      return new Response(JSON.stringify({ error: "Invalid nonce in message" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Dzēšam nonce, lai nevarētu izmantot atkārtoti
    await deleteCache(nonceKey, context.env);

    // 4. Verificējam parakstu
    const isValid = verifySignature(address, message, signature);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Izveidojam JWT
    const token = await createToken(address, context.env);

    // 6. Pēc veiksmīgas pieslēgšanās varam izdzēst sesijas sīkfailu (vai atstāt)
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set(
      "Set-Cookie",
      `session_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    );

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return new Response(JSON.stringify({ error: "Login failed: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
