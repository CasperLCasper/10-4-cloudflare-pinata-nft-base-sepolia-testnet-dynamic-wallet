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
      return new Response(JSON.stringify({ error: "Missing fields", received: { address: !!address, message: !!message, signature: !!signature } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify signature with detailed error
    let isValid;
    try {
      isValid = verifySignature(address, message, signature, context.env);
    } catch (verifyError) {
      return new Response(JSON.stringify({ 
        error: "Signature verification failed",
        details: verifyError.message,
        stack: verifyError.stack?.split('\n')[0]
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Create token with detailed error
    let token;
    try {
      token = createToken(address, context.env);
    } catch (tokenError) {
      return new Response(JSON.stringify({ 
        error: "Token creation failed",
        details: tokenError.message,
        stack: tokenError.stack?.split('\n')[0]
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: "Login failed",
      details: err.message,
      stack: err.stack
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
