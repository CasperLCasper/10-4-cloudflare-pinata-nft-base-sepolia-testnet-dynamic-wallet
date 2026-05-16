# NFT Multichain Wallet Visualizer

Šis projekts ir pārnests no Vercel uz Cloudflare Pages.

## Cloudflare Pages būvēšanas iestatījumi

Ja izmantojat Cloudflare Pages, pārliecinieties, ka jūsu projekta būvēšanas iestatījumi ir konfigurēti šādi:

- **Framework preset:** `none`
- **Build command:** `npm install`
- **Build output directory:** `/public`

## Vides mainīgie (Environment Variables)

Projektam nepieciešami šādi vides mainīgie (iestatāmi Cloudflare Pages Dashboard):

- `ALCHEMY_API_KEY` - Alchemy API atslēga
- `CONTRACT_ADDRESS` - NFT līguma adrese
- `JWT_SECRET` - JWT slepenā atslēga
- `PINATA_JWT` - Pinata JWT tokens
- `PINATA_GATEWAY` - Pinata IPFS vārteja
- `SERVER_PRIVATE_KEY` - Servera maka privātā atslēga
- `ALCHEMY_RPC_URL` - Alchemy RPC URL (Base Sepolia tīklam)
- `BSCSCAN_API_KEY` - BscScan API atslēga (var atstāt tukšu vai viettura vērtību)
