import { ethers } from 'ethers';
import { requireAuth } from "../_lib/auth.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

const WALLET_NFT_ABI = [
  "function mint(address to, string memory jsonCID, bytes memory signature) external payable",
  "function mintPrice() public view returns (uint256)"
];

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 1. AUTH
    const user = await requireAuth(request, env);
    
    if (user instanceof Response) {
      return user;
    }
    
    if (!user || !user.address) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. RATE LIMIT
    const rateKey = `mint:${user.address}`;
    if (!checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 }, env)) {
      return new Response(JSON.stringify({ success: false, error: 'Too many requests' }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Body dati
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { wallet, metadataUri } = body;
    
    if (!wallet || !metadataUri) {
      return new Response(JSON.stringify({ success: false, error: 'Missing wallet or metadataUri' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!ethers.isAddress(wallet)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid wallet address' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (user.address.toLowerCase() !== wallet.toLowerCase()) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized wallet' }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Vides mainīgie
    const CONTRACT_ADDRESS = env.CONTRACT_ADDRESS;
    const SERVER_PRIVATE_KEY = env.SERVER_PRIVATE_KEY;
    const ALCHEMY_RPC_URL = env.ALCHEMY_RPC_URL;

    if (!CONTRACT_ADDRESS || !SERVER_PRIVATE_KEY || !ALCHEMY_RPC_URL) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Server configuration incomplete' 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5. Blockchain dati
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, WALLET_NFT_ABI, provider);
    
    let mintPrice;
    try {
      mintPrice = await contract.mintPrice();
    } catch (err) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Cannot read mintPrice. Is this the correct contract?' 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Normalizējam CID
    let cleanCID = metadataUri.replace("ipfs://", "").split("/")[0];
    if (cleanCID.includes('http')) {
      const parts = cleanCID.split('/');
      cleanCID = parts[parts.length - 1];
    }

    console.log('Clean CID:', cleanCID);

    // 6. SIGNATURE GENERATION (saderīga ar OpenZeppelin v5)
    const serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY);

    // Tieši tāpat kā Solidity: keccak256(abi.encodePacked(to, jsonCID))
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "string"],
      [wallet, cleanCID]
    );

    // Parakstām bināro hēšu ar signingKey (bez Ethereum prefiksa)
    const rawSignature = await serverWallet.signingKey.sign(ethers.getBytes(messageHash));
    
    // Serializējam parakstu
    const signature = ethers.Signature.from(rawSignature).serialized;

    console.log('Signature generated successfully');

    // 7. Sagatavojam transakciju
    const iface = new ethers.Interface(WALLET_NFT_ABI);
    const data = iface.encodeFunctionData('mint', [wallet, cleanCID, signature]);

    // 8. ESTIMATE GAS
    let estimatedGas;
    try {
      estimatedGas = await provider.estimateGas({
        from: wallet,
        to: CONTRACT_ADDRESS,
        data: data,
        value: mintPrice
      });
      estimatedGas = (estimatedGas * 115n) / 100n;
    } catch (err) {
      console.error('Gas estimation failed:', err.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Transaction simulation failed. You may not have enough funds or the contract conditions are not met.' 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      transaction: {
        to: CONTRACT_ADDRESS,
        data: data,
        value: mintPrice.toString(),
        gasLimit: estimatedGas.toString()
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Server error:", error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error: ' + error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
