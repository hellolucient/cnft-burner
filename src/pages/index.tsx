import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect, useCallback } from 'react';
import { CNFTList } from '@/components/CNFTList';
import { CNFT } from '@/types';
import { ERROR_MESSAGES } from '@/utils/constants';

export default function Home() {
  const { connected, publicKey } = useWallet();
  const [cnfts, setCnfts] = useState<CNFT[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCNFTs = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      console.log('Fetching cNFTs...');
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/cnfts?owner=${publicKey.toString()}`);
      if (!response.ok) throw new Error(ERROR_MESSAGES.FETCH_FAILED);
      const data = await response.json();
      console.log('Fetched cNFTs:', data);
      setCnfts(data);
    } catch (err) {
      console.error('Error fetching cNFTs:', err);
      setError(ERROR_MESSAGES.FETCH_FAILED);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchCNFTs();
    }
  }, [connected, publicKey, fetchCNFTs]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-3xl font-bold">cNFT Burner</h1>
        <WalletMultiButton />
        
        {!connected ? (
          <p className="text-center">Please connect your wallet to view your cNFTs</p>
        ) : isLoading ? (
          <p className="text-center">Loading your cNFTs...</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : cnfts.length === 0 ? (
          <p className="text-center">No cNFTs found</p>
        ) : (
          <CNFTList cnfts={cnfts} onRefresh={fetchCNFTs} />
        )}
      </div>
    </main>
  );
}
