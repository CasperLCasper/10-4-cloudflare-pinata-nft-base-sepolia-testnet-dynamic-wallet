import { PinataSDK } from 'pinata';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

// Validācijas noteikumi
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/webm'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default async function handler(req, res) {
  // Tikai POST pieprasījumi
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Faila apstrāde no form-data
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    
    await new Promise((resolve) => {
      req.on('end', () => resolve());
    });
    
    const buffer = Buffer.concat(chunks);
    
    const boundary = req.headers['content-type'].split('boundary=')[1];
    if (!boundary) throw new Error('No boundary found');
    
    const parts = buffer.toString('binary').split(`--${boundary}`);
    
    let fileBuffer = null;
    let filename = null;
    let contentType = 'image/jpeg';
    
    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data; name="file"')) {
        const match = part.match(/filename="(.+)"/);
        if (match) filename = match[1];
        
        const ctMatch = part.match(/Content-Type: (.+)/);
        if (ctMatch) contentType = ctMatch[1].trim();
        
        const start = part.indexOf('\r\n\r\n') + 4;
        let end = part.lastIndexOf('\r\n--');
        if (end === -1) end = part.length;
        
        const binaryData = part.substring(start, end);
        fileBuffer = Buffer.from(binaryData, 'binary');
        break;
      }
    }
    
    if (!fileBuffer) throw new Error('No file found');
    
    // VALIDĀCIJA
    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ 
        error: `File type not allowed: ${contentType}. Allowed: ${ALLOWED_TYPES.join(', ')}` 
      });
    }
    
    if (fileBuffer.length > MAX_SIZE) {
      return res.status(400).json({ 
        error: `File too large: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB. Max: 50MB` 
      });
    }
    
    // Augšupielādē uz Pinata
    const file = new File([fileBuffer], filename || 'file.jpg', { type: contentType });
    const result = await pinata.upload.public.file(file);
    
    console.log(`✅ Uploaded: ${filename}, type: ${contentType}, size: ${(fileBuffer.length / 1024).toFixed(1)}KB, cid: ${result.cid}`);
    
    res.json({
      ipfs: `ipfs://${result.cid}`,
      http: `https://gateway.pinata.cloud/ipfs/${result.cid}`,
      cid: result.cid
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
}
