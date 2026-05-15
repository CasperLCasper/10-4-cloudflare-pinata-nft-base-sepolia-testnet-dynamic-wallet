import { PinataSDK } from "pinata";
// Pievienoti .js paplašinājumi ESM saderībai
import { requireAuth } from "../lib/auth.js";
import { checkRateLimit } from "../lib/rateLimit.js";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

export default async function handler(req, res) {
  // =========================================
  // 1. METHOD CHECK
  // =========================================
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // =========================================
  // 2. AUTH CHECK (obligāts)
  // =========================================
  const user = requireAuth(req, res);
  if (!user) return; // requireAuth jau nosūtījis 401

  // =========================================
  // 3. RATE LIMIT (5 metadati minūtē vienam lietotājam)
  // =========================================
  const rateKey = `upload-metadata:${user.address}`;
  if (!checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 })) {
    return res.status(429).json({ 
      error: 'Too many metadata uploads. Try again later.' 
    });
  }

  try {
    let metadata = req.body;

    // normalize payload
    if (metadata.metadata && !metadata.name) {
      metadata = metadata.metadata;
    }

    if (!metadata) {
      return res.status(400).json({ error: 'Metadata required' });
    }

    if (!metadata.name || !metadata.image) {
      return res.status(400).json({
        error: 'Metadata must contain name and image'
      });
    }

    const result = await pinata.upload.public.json(metadata);

    console.log(`✅ User ${user.address} uploaded metadata: ${metadata.name}, cid: ${result.cid}`);

    return res.json({
      ipfs: `ipfs://${result.cid}`,
      http: `https://gateway.pinata.cloud/ipfs/${result.cid}`,
      cid: result.cid
    });

  } catch (error) {
    console.error('Metadata upload error:', error);

    return res.status(500).json({
      error: error.message
    });
  }
}
