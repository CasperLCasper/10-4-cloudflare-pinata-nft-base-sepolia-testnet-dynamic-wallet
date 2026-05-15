import { verifySignature, createToken } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  try {
    let body;
    try {
      body = await context.request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { address, message, signature } = body;

    if (!address || !message || !signature) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify signature
    const isValid = verifySignature(address, message, signature, context.env);

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create token (now async)
    const token = await createToken(address, context.env);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Login error:", err.message);
    return new Response(JSON.stringify({ 
      error: "Login failed: " + err.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
