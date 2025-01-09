import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { CNFT, BurnResult } from '@/types';
import { ERROR_MESSAGES } from '@/utils/constants';
import { burn } from '@metaplex-foundation/mpl-bubblegum';
import { createUmiInstance } from '@/utils/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { publicKey } from '@metaplex-foundation/umi';
import bs58 from 'bs58';

interface AssetResponse {
  result: {
    compression: {
      data_hash: string;
      creator_hash: string;
      leaf_id: number;
    };
  };
}

interface ProofResponse {
  jsonrpc: string;
  result: {
    root: string;
    proof: string[];
    node_index: number;
    leaf: string;
    tree_id: string;
  };
  id: string;
}

// Create a separate type for the extended response
interface BurnResponse extends BurnResult {
  logs?: string[];
}

export const useBurnCNFT = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);

  const burnCNFT = async (cnft: CNFT): Promise<BurnResult> => {
    if (!wallet.publicKey) {
      throw new Error(ERROR_MESSAGES.NO_WALLET);
    }

    setIsProcessing(true);
    const logs: string[] = [];
    
    const log = (message: string, data?: any) => {
      const logMessage = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;
      logs.push(logMessage);
      console.log(logMessage);
    };

    try {
      const umi = createUmiInstance().use(walletAdapterIdentity(wallet));
      
      log('Getting asset data for:', cnft.id);
      const assetResponse = await fetch(
        process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getAsset',
            params: {
              id: cnft.id
            }
          })
        }
      );

      const assetData = await assetResponse.json();
      log('Full asset response:', assetData);
      const { result: asset } = assetData as AssetResponse;
      log('Asset data:', asset);

      const proofResponse = await fetch(
        process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'my-id',
            method: 'getAssetProof',
            params: {
              id: cnft.id
            }
          })
        }
      );

      const proofData = await proofResponse.json();
      log('Full proof response:', proofData);
      
      if (!proofData.result || !proofData.result.root) {
        throw new Error('Invalid proof data received');
      }

      const { result: proof } = proofData as ProofResponse;
      log('Proof data:', proof);

      console.log('Burning cNFT...');
      const burnResult = await burn(umi, {
        leafOwner: publicKey(wallet.publicKey.toBase58()),
        merkleTree: publicKey(cnft.treeAddress),
        root: bs58.decode(proof.root),
        dataHash: bs58.decode(asset.compression.data_hash),
        creatorHash: bs58.decode(asset.compression.creator_hash),
        nonce: asset.compression.leaf_id,
        index: asset.compression.leaf_id,
        proof: proof.proof.map((node) => publicKey(node))
      }).sendAndConfirm(umi);
      log('Burn result:', burnResult);
      log('Transaction link:', `https://solscan.io/tx/${burnResult.signature}`);

      // Wait for confirmation
      log('Waiting for confirmation...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify burn
      const verifyResponse = await fetch(
        process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'verify',
            method: 'getAsset',
            params: { id: cnft.id }
          })
        }
      );

      const verifyData = await verifyResponse.json();
      log('Verification response:', verifyData);

      // Create response without logs first
      const response: BurnResult = {
        signature: Buffer.from(burnResult.signature).toString('base64'),
        success: true
      };

      // Log the response separately
      console.log('Full logs:', logs);

      return response;
    } catch (error) {
      console.error('Burn error:', error);
      return {
        signature: '',
        success: false,
        error: typeof error === 'string' ? error : ERROR_MESSAGES.BURN_FAILED
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return { burnCNFT, isProcessing };
}; 