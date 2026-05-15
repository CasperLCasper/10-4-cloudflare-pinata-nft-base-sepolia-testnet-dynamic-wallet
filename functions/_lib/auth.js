import jwt from "jsonwebtoken";
import { ethers } from "ethers";

// Verify wallet signature (Pielāgots, ja nu nākotnē šeit savajagas env)
export function verifySignature(address, message, signature, env) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

// Create JWT (Slepeno atslēgu lasām no nodotā env)
export function createToken(address, env) {
  const secret = env?.JWT_SECRET || "dev-secret-change-this";
  return jwt.sign({ address }, secret, { expiresIn: "1h" });
}

// Verify JWT (Slepeno atslēgu lasām no nodotā env)
export function verifyToken(token, env) {
  try {
    const secret = env?.JWT_SECRET || "dev-secret-change-this";
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

// Optional auth (Pielāgots Cloudflare 'request' un 'env' objektiem)
export function getOptionalUser(request, env) {
  try {
    // Cloudflare vidē headerus lasa ar .get() metodi
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return null;

    const token = authHeader.replace("Bearer ", "");
    return verifyToken(token, env);
  } catch {
    return null;
  }
}

// Strict auth (Gatavs Cloudflare Pages videi)
export function requireAuth(request, env) {
  const user = getOptionalUser(request, env);

  // Tā kā Cloudflare vidē nav 'res' objekta, kļūdas gadījumā 
  // mēs atgriežam gatavu Response objektu, kuru API galamērķis uzreiz pārsūtīs klientam.
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return user;
}
