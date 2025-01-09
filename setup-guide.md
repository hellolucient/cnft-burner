# cNFT Burner Setup Guide

## Overview
A Next.js web application that allows users to view and burn their compressed NFTs (cNFTs) on Solana.

## Tech Stack
- Next.js with TypeScript
- Tailwind CSS for styling
- Solana Web3.js
- Metaplex Bubblegum SDK for cNFT operations
- Helius RPC for reliable Solana network access

## Initial Setup

1. Create new Next.js project:

npx create-next-app@latest cnft-burner --typescript --tailwind --eslint

2. Install dependencies:

```bash
npm install @metaplex-foundation/mpl-bubblegum @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults @metaplex-foundation/umi-rpc-web3js @metaplex-foundation/umi-signer-wallet-adapters @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/web3.js @solana/wallet-adapter-base @solana/wallet-adapter-wallets @metaplex-foundation/digital-asset-standard-api
```

3. Create `.env.local` in project root:

```bash
NEXT_PUBLIC_RPC_ENDPOINT=https://rpc.helius.xyz/?api-key=YOUR_HELIUS_API_KEY
```

## File Structure

### 1. Types (`src/types/index.ts`)
typescript
export interface CNFT {
id: string;
name: string;
uri: string;
symbol: string;
collection?: string;
assetHash: string;
treeAddress: string;
leafIndex: number;
}
export interface BurnResult {
signature: string;
success: boolean;
error?: string;
}

### 2. Constants (`src/utils/constants.ts`)
```typescript
export const NETWORK = 'mainnet-beta';
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

export const ERROR_MESSAGES = {
  NO_WALLET: 'No wallet connected',
  BURN_FAILED: 'Failed to burn cNFT',
  FETCH_FAILED: 'Failed to fetch cNFTs',
};
```

### 3. Umi Setup (`src/utils/umi.ts`)

typescript
import { createUmi } from '@metaplex-foundation/umi';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { web3JsRpc } from '@metaplex-foundation/umi-rpc-web3js';
import { RPC_ENDPOINT } from './constants';
export const createUmiInstance = () => {
return createUmi()
.use(web3JsRpc(RPC_ENDPOINT))
.use(mplBubblegum());
};

### 4. Components

#### CNFTCard (`src/components/CNFTCard.tsx`)
```typescript
import { CNFT } from '@/types';
import { useState } from 'react';

interface CNFTCardProps {
  cnft: CNFT;
  onBurn: (cnft: CNFT) => Promise<void>;
  isLoading?: boolean;
}

export const CNFTCard: React.FC<CNFTCardProps> = ({ cnft, onBurn, isLoading }) => {
  const [isBurning, setIsBurning] = useState(false);

  const handleBurn = async () => {
    try {
      setIsBurning(true);
      await onBurn(cnft);
    } finally {
      setIsBurning(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-bold text-lg mb-2">{cnft.name}</h3>
      {cnft.collection && (
        <p className="text-sm text-gray-600 mb-2">Collection: {cnft.collection}</p>
      )}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={handleBurn}
          disabled={isBurning || isLoading}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isBurning ? 'Burning...' : 'Burn NFT'}
        </button>
      </div>
    </div>
  );
};
```

#### CNFTList (`src/components/CNFTList.tsx`)
```typescript:setup-guide.md
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { CNFT } from '@/types';
import { CNFTCard } from '@/components/CNFTCard';
import { useBurnCNFT } from '@/hooks/useBurnCNFT';
import { ERROR_MESSAGES } from '@/utils/constants';

export const CNFTList: React.FC = () => {
  const { connected, publicKey } = useWallet();
  const [cnfts, setCnfts] = useState<CNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { burnCNFT, isProcessing } = useBurnCNFT();

  const fetchCNFTs = async () => {
    if (!publicKey) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/cnfts?owner=${publicKey.toString()}`);
      if (!response.ok) throw new Error(ERROR_MESSAGES.FETCH_FAILED);
      const data = await response.json();
      setCnfts(data);
    } catch (err) {
      setError(ERROR_MESSAGES.FETCH_FAILED);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      fetchCNFTs();
    }
  }, [connected, publicKey]);

  const handleBurn = async (cnft: CNFT) => {
    try {
      await burnCNFT(cnft);
      // Refresh the list after successful burn
      fetchCNFTs();
    } catch (err) {
      console.error(err);
    }
  };

  if (!connected) {
    return <p className="text-center">Please connect your wallet to view your cNFTs</p>;
  }

  if (isLoading) {
    return <p className="text-center">Loading your cNFTs...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cnfts.map((cnft) => (
        <CNFTCard
          key={cnft.id}
          cnft={cnft}
          onBurn={handleBurn}
          isLoading={isProcessing}
        />
      ))}
      {cnfts.length === 0 && (
        <p className="text-center col-span-full">No cNFTs found</p>
      )}
    </div>
  );
};
```

### 5. Hooks

#### useBurnCNFT (`src/hooks/useBurnCNFT.ts`)
```typescript
import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { CNFT, BurnResult } from '@/types';
import { ERROR_MESSAGES } from '@/utils/constants';
import { getAssetWithProof, burn } from '@metaplex-foundation/mpl-bubblegum';
import { createUmiInstance } from '@/utils/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { publicKey } from '@metaplex-foundation/umi';

export const useBurnCNFT = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);

  const burnCNFT = async (cnft: CNFT): Promise<BurnResult> => {
    if (!wallet.publicKey) {
      throw new Error(ERROR_MESSAGES.NO_WALLET);
    }

    setIsProcessing(true);
    try {
      const umi = createUmiInstance().use(walletAdapterIdentity(wallet));
      
      const assetWithProof = await getAssetWithProof(umi, publicKey(cnft.id));

      const burnResult = await burn(umi, {
        ...assetWithProof,
        leafOwner: publicKey(wallet.publicKey.toBase58())
      }).sendAndConfirm(umi);

      return {
        signature: Buffer.from(burnResult.signature).toString('base64'),
        success: true
      };
    } catch (error) {
      console.error('Burn error:', error);
      return {
        signature: '',
        success: false,
        error: ERROR_MESSAGES.BURN_FAILED
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return { burnCNFT, isProcessing };
};
```

### 6. API Routes

#### cNFTs Endpoint (`src/pages/api/cnfts.ts`)
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { CNFT } from '@/types';
import { createUmiInstance } from '@/utils/umi';
import { publicKey } from '@metaplex-foundation/umi';
import { DasApiAsset, DasApiAssetGrouping } from '@metaplex-foundation/digital-asset-standard-api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { owner } = req.query;

  if (!owner || typeof owner !== 'string') {
    return res.status(400).json({ message: 'Owner address is required' });
  }

  try {
    const umi = createUmiInstance();
    
    const assets = await umi.rpc.getAssetsByOwner({ 
      owner: publicKey(owner)
    });

    const cnfts: CNFT[] = assets.items.map((asset: DasApiAsset) => ({
      id: asset.id,
      name: asset.content.metadata.name,
      uri: asset.content.json_uri,
      symbol: asset.content.metadata.symbol,
      collection: asset.grouping.find((g: DasApiAssetGrouping) => g.group_key === 'collection')?.group_value || undefined,
      assetHash: asset.compression.asset_hash,
      treeAddress: asset.compression.tree,
      leafIndex: asset.compression.leaf_id
    }));

    return res.status(200).json(cnfts);
  } catch (error) {
    console.error('Error fetching cNFTs:', error);
    return res.status(500).json({ message: 'Error fetching cNFTs' });
  }
}
```

## Features
1. Wallet Connection
   - Supports Phantom Wallet
   - Shows connection status
   - Auto-fetches cNFTs on connection

2. cNFT Display
   - Grid layout of cNFTs
   - Shows name and collection
   - Loading states
   - Error handling

3. Burn Functionality
   - Individual burn buttons per cNFT
   - Transaction confirmation
   - Auto-refresh after burn
   - Error handling

## Next Steps
1. Add success/error notifications
2. Add loading animations
3. Add cNFT preview images
4. Add confirmation dialog before burning
5. Add pagination for large collections
6. Add filtering/sorting options

## Deployment
1. Set up project on Railway
2. Configure environment variables:
   - NEXT_PUBLIC_RPC_ENDPOINT

## Notes
- All cNFT operations use Metaplex's Bubblegum SDK
- DAS API is used for fetching cNFT data
- Wallet adapter configuration is required in `_app.tsx`
- Error handling is implemented throughout
```

Would you like me to help you start implementing this in a fresh Next.js project?