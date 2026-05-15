import { ethers } from "ethers";
import { getOptionalUser } from "../lib/auth.js";
import { checkRateLimit } from "../lib/rateLimit.js";

// Chain konfigurācija
const getChainConfig = (chain, apiKey) => {
  const configs = {
    sepolia: {
      type: 'alchemy',
      url: `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`,
      method: 'alchemy_getTokenBalances'
    },
    mumbai: {
      type: 'alchemy',
      url: `https://polygon-mumbai.g.alchemy.com/v2/${apiKey}`,
      method: 'alchemy_getTokenBalances'
    },
    bscTestnet: {
      type: 'bscscan',
      url: `https://api-testnet.bscscan.com/api`,
      method: 'bscscan'
    },
    arbitrumSepolia: {
      type: 'alchemy',
      url: `https://arb-sepolia.g.alchemy.com/v2/${apiKey}`,
      method: 'alchemy_getTokenBalances'
    },
    optimismSepolia: {
      type: 'alchemy',
      url: `https://opt-sepolia.g.alchemy.com/v2/${apiKey}`,
      method: 'alchemy_getTokenBalances'
    },
    baseSepolia: {
      type: 'alchemy',
      url: `https://base-sepolia.g.alchemy.com/v2/${apiKey}`,
      method: 'alchemy_getTokenBalances'
    },
    avalancheFuji: {
      type: 'alchemy',
      url: `https://avalanche-fuji.g.alchemy.com/v2/${apiKey}`,
      method: 'alchemy_getTokenBalances'
    }
  };
  return configs[chain] || configs.sepolia;
};

export default async function handler(req, res) {
  try {
    const user = getOptionalUser(req);
    
    let account = req.query.account || (user ? user.address : null);
    const chain = req.query.chain || 'sepolia';

    if (!account) {
      return res.status(400).json({ error: "Missing account" });
    }

    let safeAccount;
    try {
      safeAccount = ethers.getAddress(account);
    } catch {
      return res.status(400).json({ error: "Invalid address" });
    }

    // Rate limiting
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const key = user ? `user_${user.address}_tokens_${chain}` : `ip_${ip}_tokens_${chain}`;

    if (!checkRateLimit({ key })) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const API_KEY = process.env.ALCHEMY_API_KEY;
    const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
    
    const chainConfig = getChainConfig(chain, API_KEY);
    
    let tokens = [];
    
    if (chainConfig.type === 'bscscan') {
      // BSCScan API
      const url = `${chainConfig.url}?module=account&action=tokenbalance&address=${safeAccount}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        // BSCScan atgriež tikai tokenu balansus vienā pieprasījumā
        // Lai iegūtu tokenu sarakstu ar simboliem, vajag atsevišķu pieprasījumu
        const txUrl = `https://api-testnet.bscscan.com/api?module=account&action=tokentx&address=${safeAccount}&sort=desc&apikey=${BSCSCAN_API_KEY}`;
        const txResponse = await fetch(txUrl);
        const txData = await txResponse.json();
        
        if (txData.status === '1' && txData.result) {
          const tokenMap = new Map();
          txData.result.forEach(tx => {
            if (!tokenMap.has(tx.contractAddress)) {
              tokenMap.set(tx.contractAddress, {
                contract: tx.contractAddress,
                symbol: tx.tokenSymbol,
                decimals: parseInt(tx.tokenDecimal),
                balance: "0x0"
              });
            }
          });
          
          // Pievieno balansus
          if (data.result && typeof data.result === 'object') {
            for (const [address, balance] of Object.entries(data.result)) {
              if (tokenMap.has(address)) {
                tokenMap.get(address).balance = balance;
              }
            }
          }
          
          tokens = Array.from(tokenMap.values());
        }
      }
    } else {
      // Alchemy
      const response = await fetch(chainConfig.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: chainConfig.method,
          params: [safeAccount],
          id: 42
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const balances = data?.result?.tokenBalances || [];
      
      tokens = balances.map(t => ({
        contract: t.contractAddress,
        balance: t.tokenBalance,
        decimalBalance: BigInt(t.tokenBalance).toString()
      }));
    }

    return res.status(200).json({
      tokens: tokens,
      chain: chain
    });

  } catch (err) {
    console.error("TOKEN ERROR for chain:", req.query.chain, err);
    return res.status(500).json({ 
      error: "Failed to fetch tokens", 
      details: err.message,
      tokens: [] 
    });
  }
}
