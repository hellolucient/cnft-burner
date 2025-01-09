import { CNFT } from '@/types';
import { useState } from 'react';

interface CNFTCardProps {
  cnft: CNFT;
  onBurn: (cnft: CNFT) => Promise<void>;
  isLoading?: boolean;
  size?: 'normal' | 'small';
  isSelected?: boolean;
  onSelect?: () => void;
}

export const CNFTCard: React.FC<CNFTCardProps> = ({ cnft, onBurn, isLoading, size = 'normal', isSelected = false, onSelect }) => {
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

  if (isBurnt) return null;

  const sizeClasses = size === 'small' ? 'w-3/4 mx-auto' : 'w-full';

  return (
    <div className={`relative border rounded-lg p-2 bg-white shadow-sm hover:shadow-md transition-shadow ${sizeClasses}`}>
      {onSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`absolute top-1 right-1 z-10 w-6 h-6 rounded-full flex items-center justify-center ${
            isSelected ? 'bg-[#14F195] text-white' : 'bg-gray-200 text-gray-600'
          }`}
        >
          ✓
        </button>
      )}
      {cnft.uri && (
        <div className="relative w-full aspect-square mb-2">
          <img 
            src={imageError ? fallbackImage : cnft.uri}
            alt={cnft.name}
            className="w-full h-full object-cover rounded-md"
            onError={() => setImageError(true)}
          />
        </div>
      )}
      <div className="flex flex-col space-y-1">
        <h3 className="text-sm font-medium truncate" title={cnft.name}>{cnft.name}</h3>
        <button
          onClick={handleBurn}
          disabled={isBurning || isLoading}
          className="w-full bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm disabled:opacity-50"
        >
          {isBurning ? 'Burning...' : 'Burn'}
        </button>
      </div>
    </div>
  );
}; 