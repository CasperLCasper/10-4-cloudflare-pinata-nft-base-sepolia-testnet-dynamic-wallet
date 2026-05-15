import { ethers } from 'ethers';
import { requireAuth } from "../lib/auth.js";
import { checkRateLimit } from "../lib/rateLimit.js";

const WALLET_NFT_ABI = [
  "function mint(address to, string memory jsonCID, bytes memory signature) external payable",
  "function mintPrice() public view returns (uint256)"
];

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const SERVER_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY; // 🗝️ Servera slepenā atslēga

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = requireAuth(req, res);
  if (!user) return;

  const rateKey = `mint:${user.address}`;
  if (!checkRateLimit({ key: rateKey, limit: 5, windowMs: 60000 })) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }

  const { wallet, metadataUri } = req.body;
  if (!wallet || !metadataUri || !ethers.isAddress(wallet)) {
    return res.status(400).json({ success: false, error: 'Invalid input' });
  }

  if (user.address.toLowerCase() !== wallet.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Unauthorized wallet' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, WALLET_NFT_ABI, provider);
    const mintPrice = await contract.mintPrice();

    // 1. Normalizējam CID
    let cleanCID = metadataUri.replace("ipfs://", "").split("/").pop();

    // 2. 🔐 SIGNATURE GENERATION
    const serverWallet = new ethers.Wallet(SERVER_PRIVATE_KEY);
    
    // Izveidojam identisku hēšu tam, kas ir Solidity (abi.encodePacked)
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "string"],
      [wallet, cleanCID]
    );
    
    // Parakstām hēšu
    const signature = await serverWallet.signMessage(ethers.getBytes(messageHash));

    // 3. Sagatavojam datus ar parakstu
    const iface = new ethers.Interface(WALLET_NFT_ABI);
    const data = iface.encodeFunctionData('mint', [wallet, cleanCID, signature]);

    // 4. 🔥 ESTIMATE GAS
    let estimatedGas;
    try {
      estimatedGas = await provider.estimateGas({
        from: wallet,
        to: CONTRACT_ADDRESS,
        data: data,
        value: mintPrice
      });
      estimatedGas = (estimatedGas * 115n) / 100n; // 15% rezerve drošībai
    } catch (err) {
      return res.status(400).json({ success: false, error: 'Simulation failed. Check contract conditions.' });
    }

    return res.status(200).json({
      success: true,
      transaction: {
        to: CONTRACT_ADDRESS,
        data: data,
        value: mintPrice.toString(),
        gasLimit: estimatedGas.toString()
      }
    });

  } catch (error) {
    console.error("🔥 Server error:", error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
