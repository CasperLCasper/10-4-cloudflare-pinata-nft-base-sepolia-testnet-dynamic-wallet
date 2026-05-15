import { PinataSDK } from "pinata";
import { requireAuth } from "../_lib/auth.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

// Izmantojam onRequestPost, lai automātiski atļautu TIKAI POST pieprasījumus
export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. 🔐 AUTH (obligāts)
  // Nododam request un env. requireAuth funkcijai ir jāatgriež lietotājs VAI jāizmet Response
  const user = requireAuth(request, env);
  
  // Ja requireAuth atgriež Response objektu (piemēram, 401 unauth), mēs to uzreiz nosūtām klientam
  if (user instanceof Response) {
    return user;
  }
  
  if (!user || !user.address) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 2. 🚫 RATE LIMIT (pēc autentifikācijas)
  const rateKey = `upload-token:${user.address}`;
  if (!checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 }, env)) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // 3. Pinata SDK inicializācija ar Cloudflare vides mainīgajiem
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
