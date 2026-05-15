import { verifyToken } from "../_lib/auth.js";

// Izmantojam onRequest, kas apstrādās jebkuru metodi, bet, ja frontend sūta tikai GET vai POST, 
// vari droši nomainīt uz onRequestGet vai onRequestPost.
export async function onRequest(context) {
  try {
    const { request, env } = context;

    // 1. Iegūstam Authorization headeri Cloudflare veidā
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Izgūstam tokenu
    const token = authHeader.replace("Bearer ", "");
    
    // 3. Validējam tokenu, nododot env mainīgos (piem. JWT_SECRET) uz _lib/auth.js
    const user = verifyToken(token, env);

    if (!user || !user.address) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Tokenis ir derīgs
    return new Response(JSON.stringify({
      valid: true,
      address: user.address
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    // Jebkādas kļūdas gadījumā atgriežam valid: false, kā tavā oriģinālajā kodā
    return new Response(JSON.stringify({ valid: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
