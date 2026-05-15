import { PinataSDK } from "pinata";
import { requireAuth } from "../_lib/auth.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

// Izmantojam onRequestPost, lai automātiski atļautu TIKAI POST pieprasījumus
export async function onRequestPost(context) {
  const { request, env } = context;

  // =========================================
  // 1. AUTH CHECK (obligāts)
  // =========================================
  const user = requireAuth(request, env);
  
  // Ja requireAuth atgriež Response objektu (piemēram, 401 unauth), mēs to uzreiz atgriežam klientam
  if (user instanceof Response) {
    return user;
  }
  
  if (!user || !user.address) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // =========================================
  // 2. RATE LIMIT (5 metadati minūtē vienam lietotājam)
  // =========================================
  const rateKey = `upload-metadata:${user.address}`;
  if (!checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 }, env)) {
    return new Response(JSON.stringify({ 
      error: 'Too many metadata uploads. Try again later.' 
    }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // 3. Iegūstam datus no pieprasījuma body (Cloudflare asinhronā pieeja)
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Maldīgs JSON formāts' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let metadata = body;

    // Normalizējam payload, saglabājot tavu oriģinālo loģiku
    if (metadata.metadata && !metadata.name) {
      metadata = metadata.metadata;
    }

    if (!metadata) {
      return new Response(JSON.stringify({ error: 'Metadata required' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!metadata.name || !metadata.image) {
      return new Response(JSON.stringify({
        error: 'Metadata must contain name and image'
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Pinata SDK inicializācija ar Cloudflare vides mainīgajiem
    const pinata = new PinataSDK({
      pinataJwt: env.PINATA_JWT,
      pinataGateway: env.PINATA_GATEWAY,
    });

    // Augšupielādējam JSON uz Pinata
    const result = await pinata.upload.public.json(metadata);

    console.log(`✅ User ${user.address} uploaded metadata: ${metadata.name}, cid: ${result.cid}`);

    return new Response(JSON.stringify({
      ipfs: `ipfs://${result.cid}`,
      http: `https://gateway.pinata.cloud/ipfs/${result.cid}`,
      cid: result.cid
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Metadata upload error:', error);

    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
