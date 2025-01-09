import { CNFT } from '@/types';
import { CNFTCard } from './CNFTCard';
import { useBurnCNFT } from '@/hooks/useBurnCNFT';
import { useCallback } from 'react';

interface CNFTListProps {
  cnfts: CNFT[];
  onRefresh: () => Promise<void>;
}

export const CNFTList: React.FC<CNFTListProps> = ({ cnfts, onRefresh }) => {
  const { burnCNFT, isProcessing } = useBurnCNFT();

  const handleBurn = useCallback(async (cnft: CNFT) => {
    console.log('Starting burn process for:', cnft.id);
    const result = await burnCNFT(cnft);
    if (result.success) {
      console.log('Burn successful, refreshing list...');
      await onRefresh();
      console.log('List refresh completed');
    } else {
      console.error('Burn failed:', result.error);
    }
  }, [burnCNFT, onRefresh]);

  console.log('Current cNFTs:', cnfts);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {cnfts.map((cnft) => (
        <CNFTCard
          key={cnft.id}
          cnft={cnft}
          onBurn={handleBurn}
          isLoading={isProcessing}
        />
      ))}
    </div>
  );
}; 