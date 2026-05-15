import { SignJWT, jwtVerify } from "jose";
import { ethers } from "ethers";

// Verify wallet signature
export function verifySignature(address, message, signature, env) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

// Create JWT using jose
export async function createToken(address, env) {
  const secret = new TextEncoder().encode(env?.JWT_SECRET || "dev-secret-change-this");
  return await new SignJWT({ address })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);
}

// Verify JWT using jose
export async function verifyToken(token, env) {
  try {
    const secret = new TextEncoder().encode(env?.JWT_SECRET || "dev-secret-change-this");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// Optional auth
export async function getOptionalUser(request, env) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return null;

    const token = authHeader.replace("Bearer ", "");
    return await verifyToken(token, env);
  } catch {
    return null;
  }
}

// Strict auth
export async function requireAuth(request, env) {
  const user = await getOptionalUser(request, env);

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return user;
}
