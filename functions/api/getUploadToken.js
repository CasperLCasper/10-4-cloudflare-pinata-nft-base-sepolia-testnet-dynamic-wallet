import { PinataSDK } from "pinata";
// Pievienoti .js paplašinājumi, lai Node.js (ESM) varētu atrast moduļus
import { requireAuth } from "../lib/auth.js";
import { checkRateLimit } from "../lib/rateLimit.js";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 🔐 AUTH (obligāts)
  const user = requireAuth(req, res);
  if (!user) return; // requireAuth jau nosūtījis 401

  // 🚫 RATE LIMIT (pēc autentifikācijas)
  const rateKey = `upload-token:${user.address}`;
  if (!checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 })) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  try {
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

    return res.status(200).json({
      token: keyData.JWT
    });

  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({
      error: error.message
    });
  }
}
