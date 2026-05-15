import { verifySignature, createToken } from "../../_lib/auth.js";

// Cloudflare Pages izmanto eksportētas funkcijas. 
// Nosaukums "onRequestPost" automātiski nozīmē, ka šis kods apstrādās TIKAI POST pieprasījumus.
export async function onRequestPost(context) {
  try {
    // 1. Iegūstam datus no pieprasījuma body (Cloudflare vidē tas jādara asinhroni)
    let body;
    try {
      body = await context.request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Maldīgs JSON formāts" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { address, message, signature } = body;

    // 2. Validācija
    if (!address || !message || !signature) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Paraksta pārbaude
    // Piezīme: Nododam 'context.env' kā pēdējo argumentu gadījumam, ja verifySignature funkcijai vajag kādu env mainīgo.
    const isValid = verifySignature(address, message, signature, context.env);

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Tokena izveide
    // Piezīme: Nododam 'context.env', lai 'createToken' funkcija varētu piekļūt, piemēram, JWT_SECRET atslēgai.
    const token = createToken(address, context.env);

    // 5. Atgriežam veiksmīgu atbildi
    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Login error:", err);
    return new Response(JSON.stringify({ error: "Login failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
