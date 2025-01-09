export const NETWORK = 'mainnet-beta';
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

export const ERROR_MESSAGES = {
  NO_WALLET: 'No wallet connected',
  BURN_FAILED: 'Failed to burn cNFT',
  FETCH_FAILED: 'Failed to fetch cNFTs',
}; 