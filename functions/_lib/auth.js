import jwt from "jsonwebtoken";
import { ethers } from "ethers";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this";

// Verify wallet signature
export function verifySignature(address, message, signature) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

// Create JWT
export function createToken(address) {
  return jwt.sign({ address }, JWT_SECRET, { expiresIn: "1h" });
}

// Verify JWT
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Optional auth (NEKAD nemet error)
export function getOptionalUser(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.replace("Bearer ", "");
    return verifyToken(token);
  } catch {
    return null;
  }
}

// Strict auth (ja vajag nākotnē)
export function requireAuth(req, res) {
  const user = getOptionalUser(req);

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return user;
}
