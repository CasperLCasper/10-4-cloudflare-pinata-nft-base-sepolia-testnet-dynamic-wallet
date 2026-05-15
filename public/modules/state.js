// ============================================ //
// APP STATE
// ============================================ //

// App stāvokļa objekts
export const AppState = {
  provider: null,
  signer: null,
  account: null,
  showInfo: true,
  tokens: [],
  ethBalance: 0,
  txCount: 0,
  particles: [],
  initialParticles: [],
  animFrameId: null,
  currentAddonStyle: 'classic',
  frameCount: 0,
  isRecording: false,
  lastImageURL: null,
  lastVideoURL: null,
  lastMetadataURL: null,
  isAnimationActive: false,
  nftCenters: [],
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  currentVizChain: 'sepolia',
  particleCache: new Map()
};

// UI elementu references
export let UI = {};

// Inicializē UI references
export function initUI() {
  UI = {
    connectBtn: document.getElementById('connectBtn'),
    renderBtn: document.getElementById('renderBtn'),
    recordBtn: document.getElementById('recordBtn'),
    generateNFTBtn: document.getElementById('generateNFTBtn'),
    accountDisplay: document.getElementById('accountDisplay'),
    recordTimer: document.getElementById('recordTimer'),
    statusMsg: document.getElementById('statusMsg'),
    progressBarContainer: document.getElementById('progressBarContainer'),
    progressBar: document.getElementById('progressBar'),
    ipfsPreview: document.getElementById('ipfsPreview'),
    previewImage: document.getElementById('previewImage'),
    previewVideo: document.getElementById('previewVideo'),
    previewMetadata: document.getElementById('previewMetadata'),
    styleIndicator: document.getElementById('styleIndicator'),
    indicatorText: document.getElementById('indicatorText'),
    warningBanner: document.getElementById('warningBanner'),
    canvas: document.getElementById('snapshotCanvas'),
    fullscreenIcon: document.getElementById('fullscreenIcon'),
    toggleInfoIcon: document.getElementById('toggleInfoIcon'),
    tokenListContainer: document.getElementById('tokenListContainer'),
    tokenListContent: document.getElementById('tokenListContent'),
    chainSelect: document.getElementById('chainSelect'),
    chainStatus: document.getElementById('chainStatus')
  };
}
