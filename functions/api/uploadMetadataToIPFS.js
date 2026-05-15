import { PinataSDK } from "pinata";
import { requireAuth } from "../_lib/auth.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // =========================================
    // 1. AUTH CHECK (obligāts) - ar await
    // =========================================
    const user = await requireAuth(request, env);
    
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
    // 2. RATE LIMIT
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

    // 3. Iegūstam datus no pieprasījuma body
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

    // 4. Pinata SDK inicializācija
    const pinata = new PinataSDK({
      pinataJwt: env.PINATA_JWT,
      pinataGateway: env.PINATA_GATEWAY,
    });

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
