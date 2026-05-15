import { ethers } from "ethers";
import { getOptionalUser } from "../lib/auth.js";
import { getCache, setCache } from "../lib/cache.js";
import { checkRateLimit } from "../lib/rateLimit.js";

// Chain konfigurācija
const getChainConfig = (chain, apiKey) => {
  const configs = {
    sepolia: {
      type: 'alchemy',
      network: 'eth-sepolia'
    },
    mumbai: {
      type: 'alchemy',
      network: 'polygon-mumbai'
    },
    bscTestnet: {
      type: 'bscscan',
      network: 'bsc-testnet'
    },
    arbitrumSepolia: {
      type: 'alchemy',
      network: 'arb-sepolia'
    },
    optimismSepolia: {
      type: 'alchemy',
      network: 'opt-sepolia'
    },
    baseSepolia: {
      type: 'alchemy',
      network: 'base-sepolia'
    },
    avalancheFuji: {
      type: 'alchemy',
      network: 'avalanche-fuji'
    }
  };
  return configs[chain] || configs.sepolia;
};

const getAlchemyNFTUrl = ({ apiKey, network, owner, contract, pageKey }) => {
  let url = `https://${network}.g.alchemy.com/nft/v2/${apiKey}/getNFTs?owner=${owner}`;
  if (contract) url += `&contractAddresses[]=${contract}`;
  if (pageKey) url += `&pageKey=${pageKey}`;
  return url;
};

const getBSCScanNFTs = async (owner, apiKey) => {
  const url = `https://api-testnet.bscscan.com/api?module=account&action=tokennfttx&address=${owner}&sort=desc&apikey=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== '1' || !data.result) return [];
  
  // Unikāli NFT pēc contract + tokenId
  const uniqueNFTs = new Map();
  data.result.forEach(tx => {
    const key = `${tx.contractAddress}_${tx.tokenID}`;
    if (!uniqueNFTs.has(key)) {
      uniqueNFTs.set(key, {
        contract: { address: tx.contractAddress, symbol: tx.tokenSymbol || 'NFT' },
        id: { tokenId: tx.tokenID },
        balance: 1
      });
    }
  });
  
  return Array.from(uniqueNFTs.values());
};

const MAX_PAGES = 5;

export default async function handler(req, res) {
  try {
    const user = getOptionalUser(req);

    let account = req.query.account || (user ? user.address : null); 
    const { contract, chain = 'sepolia' } = req.query;

    if (!account) {
      return res.status(400).json({ error: "Missing account. Please provide it in query or log in." });
    }

    let safeAccount;
    try {
      safeAccount = ethers.getAddress(account);
    } catch {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    let safeContract = null;
    if (contract) {
      try {
        safeContract = ethers.getAddress(contract);
      } catch {
        return res.status(400).json({ error: "Invalid contract address" });
      }
    }

    // Rate limit
    const ipRaw = req.headers["x-forwarded-for"];
    const ip = ipRaw ? ipRaw.split(",")[0].trim() : req.socket.remoteAddress || "unknown";
    const rateKey = user ? `user_${user.address}_nfts_${chain}` : `ip_${ip}_nfts_${chain}`;

    if (!checkRateLimit({ key: rateKey })) {
      return res.status(429).json({ error: "Too many requests" });
    }

    // Cache
    const cacheKey = safeContract
      ? `nfts_${safeAccount}_${safeContract}_${chain}`
      : `nfts_${safeAccount}_${chain}`;

    const cached = getCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const API_KEY = process.env.ALCHEMY_API_KEY;
    const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
    
    const chainConfig = getChainConfig(chain, API_KEY);
    let allNFTs = [];

    if (chainConfig.type === 'bscscan') {
      // BSCScan API
      allNFTs = await getBSCScanNFTs(safeAccount, BSCSCAN_API_KEY);
    } else {
      // Alchemy
      let pageKey = null;
      for (let i = 0; i < MAX_PAGES; i++) {
        const url = getAlchemyNFTUrl({
          apiKey: API_KEY,
          network: chainConfig.network,
          owner: safeAccount,
          contract: safeContract,
          pageKey
        });

        const response = await fetch(url);
        if (!response.ok) break;
        
        const data = await response.json();
        const nfts = data?.ownedNfts || [];
        allNFTs.push(...nfts);
        
        if (!data?.pageKey) break;
        pageKey = data.pageKey;
      }
    }

    // Format
    const formatted = allNFTs.map(nft => ({
      contract: {
        address: nft.contract?.address || "",
        symbol: nft.contract?.symbol || "NFT"
      },
      id: {
        tokenId: nft.id?.tokenId || ""
      },
      balance: 1,
      chain: chain
    }));

    const result = { result: { nfts: formatted }, chain: chain };
    setCache(cacheKey, result);

    return res.status(200).json(result);

  } catch (err) {
    console.error("NFT ERROR for chain:", req.query.chain, err);
    return res.status(500).json({
      error: "Failed to fetch NFTs",
      result: { nfts: [] }
    });
  }
}
