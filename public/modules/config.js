// ============================================ //
// CONFIGURATION
// ============================================ //

import { getRpcUrl } from './chains.js';

export const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

// Contract ABI for mint price reading
export const CONTRACT_ABI = [
  "function mintPrice() view returns (uint256)"
];

// 🔥 Gudra mobilā noteikšana — NEieslēdzas uz datora, tikai uz patiešām vājām mobilajām ierīcēm
const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const hasLowMemory = typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4;
const hasFewCores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency < 2;

export const VIZ_LOW_POWER_MODE = isMobile && (hasLowMemory || hasFewCores);
export const LOW_POWER_MODE = VIZ_LOW_POWER_MODE;

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
