import { verifyToken } from "../lib/auth.js";

export default function handler(req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(200).json({ valid: false });
    }

    const token = authHeader.replace("Bearer ", "");
    const user = verifyToken(token);

    if (!user) {
      return res.status(200).json({ valid: false });
    }

    return res.status(200).json({
      valid: true,
      address: user.address
    });

  } catch {
    return res.status(200).json({ valid: false });
  }
}
