import { ethers } from "ethers";
import { getOptionalUser } from "../_lib/auth.js";
import { checkRateLimit } from "../_lib/rateLimit.js";

// Chain konfigurācija pielāgota, lai API_KEY tiktu nodots dinamiski
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

// Izmantojam onRequestGet tikai GET pieprasījumiem
export async function onRequestGet(context) {
  let chain = 'sepolia'; // Inicializējam mainīgo kļūdu žurnālam (catch blokam)

  try {
    const { request, env } = context;

    // 1. URL parametru nolasīšana no Cloudflare request
    const url = new URL(request.url);
    const accountParam = url.searchParams.get("account");
    chain = url.searchParams.get("chain") || 'sepolia';

    // 2. Lietotāja sesijas noteikšana
    const user = getOptionalUser(request, env);
    let account = accountParam || (user ? user.address : null);

    if (!account) {
      return new Response(JSON.stringify({ error: "Missing account" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let safeAccount;
    try {
      safeAccount = ethers.getAddress(account);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Rate limiting ar Cloudflare IP noteikšanu
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const key = user ? `user_${user.address}_tokens_${chain}` : `ip_${ip}_tokens_${chain}`;

    if (!checkRateLimit({ key }, env)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Vides mainīgo nolasīšana no context.env
    const API_KEY = env.ALCHEMY_API_KEY;
    const BSCSCAN_API_KEY = env.BSCSCAN_API_KEY;
    
    const chainConfig = getChainConfig(chain, API_KEY);
    
    let tokens = [];
    
    if (chainConfig.type === 'bscscan') {
      // BSCScan API pieprasījums
      const bscUrl = `${chainConfig.url}?module=account&action=tokenbalance&address=${safeAccount}&tag=latest&apikey=${BSCSCAN_API_KEY}`;
      const response = await fetch(bscUrl);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
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
      // Alchemy POST RPC pieprasījums
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

    return new Response(JSON.stringify({
      tokens: tokens,
      chain: chain
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("TOKEN ERROR for chain:", chain, err);
    return new Response(JSON.stringify({ 
      error: "Failed to fetch tokens", 
      details: err.message,
      tokens: [] 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
