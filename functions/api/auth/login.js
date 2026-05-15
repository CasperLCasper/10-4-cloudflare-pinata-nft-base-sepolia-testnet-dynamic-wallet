import { verifySignature, createToken } from "../../lib/auth.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { address, message, signature } = req.body;

    if (!address || !message || !signature) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const isValid = verifySignature(address, message, signature);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const token = createToken(address);

    return res.status(200).json({ token });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
}
