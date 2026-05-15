import { PinataSDK } from 'pinata';

// Validācijas noteikumi paliek nemainīgi
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/webm'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

// Izmantojam onRequestPost, lai atļautu tikai POST pieprasījumus
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 1. Cloudflare iebūvētā FormData apstrāde (aizstāj visu manuālo bufferu skaldīšanu)
    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid form data or no data provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Iegūstam failu no form-data pēc nosaukuma "file"
    const fileEntry = formData.get('file');
    
    if (!fileEntry || !(fileEntry instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file found in form-data under key "file"' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const filename = fileEntry.name || 'file.jpg';
    const contentType = fileEntry.type;
    const fileSize = fileEntry.size;

    // 2. VALIDĀCIJA
    if (!ALLOWED_TYPES.includes(contentType)) {
      return new Response(JSON.stringify({ 
        error: `File type not allowed: ${contentType}. Allowed: ${ALLOWED_TYPES.join(', ')}` 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (fileSize > MAX_SIZE) {
      return new Response(JSON.stringify({ 
        error: `File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB. Max: 50MB` 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // 3. Pinata SDK inicializācija ar Cloudflare vides mainīgajiem
    const pinata = new PinataSDK({
      pinataJwt: env.PINATA_JWT,
      pinataGateway: env.PINATA_GATEWAY,
    });

    // 4. Augšupielāde uz Pinata
    // Izmantojam tieši to pašu File objektu, ko mums iedeva Cloudflare
    const result = await pinata.upload.public.file(fileEntry);
    
    console.log(`✅ Uploaded: ${filename}, type: ${contentType}, size: ${(fileSize / 1024).toFixed(1)}KB, cid: ${result.cid}`);
    
    return new Response(JSON.stringify({
      ipfs: `ipfs://${result.cid}`,
      http: `https://gateway.pinata.cloud/ipfs/${result.cid}`,
      cid: result.cid
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
