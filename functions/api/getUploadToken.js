import { PinataSDK } from "pinata";
import { requireAuth } from "../_lib/auth.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 1. 🔐 AUTH (obligāts) - ar await, jo requireAuth tagad ir asinhrona
    const user = await requireAuth(request, env);
    
    // Ja requireAuth atgriež Response objektu (401), uzreiz to atgriežam
    if (user instanceof Response) {
      return user;
    }
    
    if (!user || !user.address) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 🚫 RATE LIMIT
    const rateKey = `upload-token:${user.address}`;
    if (!checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 }, env)) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Pinata SDK inicializācija
    const pinata = new PinataSDK({
      pinataJwt: env.PINATA_JWT,
      pinataGateway: env.PINATA_GATEWAY,
    });

    // 4. Pagaidu atslēgas izveide
    const keyData = await pinata.keys.create({
      keyName: `Upload-${user.address}-${Date.now()}`,
      permissions: {
        endpoints: {
          data: {
            pinList: false,
            userPinnedDataTotal: false
          },
          pinning: {
            pinFileToIPFS: true,
            pinJSONToIPFS: true
          }
        }
      },
      maxUses: 1
    });

    return new Response(JSON.stringify({ token: keyData.JWT }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Error generating token:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
