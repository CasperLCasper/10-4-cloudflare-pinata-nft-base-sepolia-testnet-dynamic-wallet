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
    // 1. 🔐 AUTH (obligāts) - ar await
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

    // 2. 🚫 RATE LIMIT
    const rateKey = `mint:${user.address}`;
    if (!checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 }, env)) {
      return new Response(JSON.stringify({ success: false, error: 'Too many requests' }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Iegūstam datus no pieprasījuma body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Maldīgs JSON formāts' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { wallet, metadataUri } = body;
    if (!wallet || !metadataUri || !ethers.isAddress(wallet)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid input' }), {
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

    // Vides mainīgie
    const CONTRACT_ADDRESS = env.CONTRACT_ADDRESS;
    const SERVER_PRIVATE_KEY = env.SERVER_PRIVATE_KEY;
    const ALCHEMY_RPC_URL = env.ALCHEMY_RPC_URL;

    if (!CONTRACT_ADDRESS || !SERVER_PRIVATE_KEY || !ALCHEMY_RPC_URL) {
      return new Response(JSON.stringify({ success: false, error: 'Server variables not configured' }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Inicializējam provideri un kontraktu
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, WALLET_NFT_ABI, provider);
    const mintPrice = await contract.mintPrice();

    // Normalizējam CID
    let cleanCID = metadataUri.replace("ipfs://", "").split("/").pop();

    // 🔐 SIGNATURE GENERATION
    const serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY);
    
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "string"],
      [wallet, cleanCID]
    );
    
    const signature = await serverWallet.signMessage(ethers.getBytes(messageHash));

    // Sagatavojam datus ar parakstu
    const iface = new ethers.Interface(WALLET_NFT_ABI);
    const data = iface.encodeFunctionData('mint', [wallet, cleanCID, signature]);

    // 🔥 ESTIMATE GAS
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
      return new Response(JSON.stringify({ success: false, error: 'Simulation failed. Check contract conditions.' }), {
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
    console.error("🔥 Server error:", error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
