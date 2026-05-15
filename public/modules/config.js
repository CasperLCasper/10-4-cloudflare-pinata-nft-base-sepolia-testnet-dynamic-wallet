// ============================================ //
// CONFIGURATION
// ============================================ //

import { getRpcUrl } from './chains.js';

export const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

// Contract ABI for mint price reading
export const CONTRACT_ABI = [
  "function mintPrice() view returns (uint256)"
];

// 🔥 Vizualizācijai - tikai īstas mobilās ierīces (vecais variants)
export const VIZ_LOW_POWER_MODE =
  typeof navigator !== 'undefined' &&
  /Mobi|Android/i.test(navigator.userAgent);

// 🔥 Pārējai aplikācijai - plašāks diapazons (jaunais variants)
export const LOW_POWER_MODE =
  typeof navigator !== 'undefined' &&
  (
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  );

// 🔥 Immutable particle config (no accidental mutations) - IZMANTO VIZ_LOW_POWER_MODE
const PARTICLE_CONFIG = VIZ_LOW_POWER_MODE
  ? {
      MAX_PARTICLES: 100,
      CONNECTION_DISTANCE: 80
    }
  : {
      MAX_PARTICLES: 250,
      CONNECTION_DISTANCE: 100
    };

export const MAX_PARTICLES = PARTICLE_CONFIG.MAX_PARTICLES;
export const CONNECTION_DISTANCE = PARTICLE_CONFIG.CONNECTION_DISTANCE;

// 🔥 Singleton provider for mint chain with dead RPC recovery and race condition protection
let _mintProvider = null;
let _providerPromise = null;

export async function getMintProvider() {
  try {
    if (_mintProvider) {
      // Check if provider is still alive
      await _mintProvider.getBlockNumber();
      return _mintProvider;
    }
  } catch {
    console.warn('Mint provider dead, recreating...');
    _mintProvider = null;
    _providerPromise = null;
  }

  if (_providerPromise) {
    return _providerPromise;
  }

  _providerPromise = (async () => {
    try {
      const provider = new ethers.JsonRpcProvider(
        getRpcUrl('baseSepolia')
      );
      
      // Healthcheck before saving singleton
      await provider.getBlockNumber();
      
      _mintProvider = provider;
      
      return provider;
    } finally {
      _providerPromise = null;
    }
  })();

  return _providerPromise;
}
