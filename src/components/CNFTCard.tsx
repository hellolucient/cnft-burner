import { CNFT } from '@/types';
import { useState } from 'react';

interface CNFTCardProps {
  cnft: CNFT;
  onBurn: (cnft: CNFT) => Promise<void>;
  isLoading?: boolean;
}

export const CNFTCard: React.FC<CNFTCardProps> = ({ cnft, onBurn, isLoading }) => {
  const [isBurning, setIsBurning] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isBurnt, setIsBurnt] = useState(false);
  const fallbackImage = '/images/cnft-fail-whale.png';

  const handleBurn = async () => {
    if (window.confirm('Are you sure you want to burn this cNFT? This action cannot be undone.')) {
      try {
        setIsBurning(true);
        await onBurn(cnft);
        setIsBurnt(true);
      } finally {
        setIsBurning(false);
      }
    }
  };

  if (isBurnt) {
    return null; // Remove from UI when burnt
  }

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      {cnft.uri && (
        <div className="relative w-full aspect-square mb-4">
          <img 
            src={imageError ? fallbackImage : cnft.uri}
            alt={cnft.name}
            className="w-full h-full object-cover rounded-md"
            onError={() => setImageError(true)}
          />
        </div>
      )}
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
          {isBurning ? 'Burning...' : 'Burn cNFT'}
        </button>
      </div>
    </div>
  );
}; 