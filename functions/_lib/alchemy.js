export function getAlchemyNFTUrl({ apiKey, owner, contract, pageKey }) {
  let url = `https://eth-sepolia.g.alchemy.com/nft/v2/${apiKey}/getNFTsForOwner`;
  url += `?owner=${owner}&withMetadata=true`;

  if (contract) {
    url += `&contractAddresses[]=${contract}`;
  }

  if (pageKey) {
    url += `&pageKey=${pageKey}`;
  }

  return url;
}
