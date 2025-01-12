import { Connection, PublicKey } from '@solana/web3.js';

export async function computeOptimalCanopyDepth(
  treeAddress: string,
  connection: Connection
): Promise<number> {
  try {
    const account = await connection.getAccountInfo(new PublicKey(treeAddress));
    if (!account) return 3; // fallback to minimal depth

    // Compute optimal depth based on tree size
    // This is a simplified version - we can make it more sophisticated
    const maxDepth = Math.floor(Math.log2(account.data.length));
    return Math.min(maxDepth, 14); // Cap at 14 as per Metaplex docs
  } catch (error) {
    console.warn('Failed to compute canopy depth:', error);
    return 3; // fallback to minimal depth
  }
} 