import { CNFT } from '@/types';
import { CNFTCard } from './CNFTCard';
import { useBurnCNFT } from '@/hooks/useBurnCNFT';
import { useCallback, useMemo, useState } from 'react';

interface CNFTListProps {
  cnfts: CNFT[];
  onRefresh: () => Promise<void>;
}

interface CollectionGroup {
  collection: string;
  collectionName: string;
  cnfts: CNFT[];
  coverImage: string;
}

const truncateAddress = (address: string, length = 12) => {
  if (!address) return '';
  if (address.length <= length) return address;
  return `${address.slice(0, length)}...`;
};

// Update the helper function to show both collection name and address
const formatCollectionDisplay = (collection: string, showBoth = false) => {
  // Check if it looks like a Solana address (base58 string of typical length)
  const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(collection);
  
  if (isSolanaAddress) {
    return `${collection.slice(0, 12)}...`;
  }
  
  return collection;
};

// Add this helper function to get button styles based on selection state
const getSelectionButtonStyles = (selectionState: 'none' | 'partial' | 'all') => {
  switch (selectionState) {
    case 'all':
      return 'bg-[#14F195] hover:bg-[#0AC17D]';
    case 'partial':
      return 'bg-[#14F195] hover:bg-[#0AC17D] opacity-75';
    default:
      return 'bg-gray-400 hover:bg-gray-500';
  }
};

export const CNFTList: React.FC<CNFTListProps> = ({ cnfts, onRefresh }) => {
  const { burnCNFT, isProcessing } = useBurnCNFT();
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<'none' | 'individual' | 'collection' | 'all'>('none');

  // Group CNFTs by collection
  const collections = useMemo(() => {
    const groups = cnfts.reduce((acc: { [key: string]: CNFT[] }, cnft) => {
      const collectionKey = cnft.collection || 'Uncategorized';
      if (!acc[collectionKey]) {
        acc[collectionKey] = [];
      }
      acc[collectionKey].push(cnft);
      return acc;
    }, {});

    return Object.entries(groups).map(([collection, cnfts]): CollectionGroup => {
      // Get the collection name from the first cNFT in the group
      const collectionName = cnfts[0]?.name?.split(' #')[0] || collection;
      
      return {
        collection,
        collectionName,
        cnfts,
        coverImage: cnfts[0].uri
      };
    });
  }, [cnfts]);

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

  const handleCollectionClick = (collection: string) => {
    setExpandedCollection(prev => prev === collection ? null : collection);
  };

  const handleSelect = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectCollection = (collection: string, cnfts: CNFT[]) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      const collectionIds = new Set(cnfts.map(c => c.id));
      
      // If all items in collection are selected, unselect them
      const allSelected = cnfts.every(c => newSet.has(c.id));
      if (allSelected) {
        collectionIds.forEach(id => newSet.delete(id));
      } else {
        collectionIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedItems(prev => {
      if (prev.size === cnfts.length) {
        return new Set();
      }
      return new Set(cnfts.map(c => c.id));
    });
  };

  // Update the helper function to check collection selection state
  const getCollectionSelectionState = (collectionCnfts: CNFT[]) => {
    if (!collectionCnfts.length) return 'none';
    
    const selectedCount = collectionCnfts.filter(cnft => selectedItems.has(cnft.id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === collectionCnfts.length) return 'all';
    return 'partial';
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end p-4">
        <button 
          onClick={handleSelectAll}
          className={`text-white px-4 py-2 rounded transition-colors ${
            selectedItems.size === cnfts.length
              ? 'bg-[#14F195] hover:bg-[#0AC17D]'
              : selectedItems.size > 0
                ? 'bg-[#14F195] hover:bg-[#0AC17D] opacity-75'
                : 'bg-gray-400 hover:bg-gray-500'
          }`}
        >
          {selectedItems.size === cnfts.length ? 'Deselect All' : 'Select All'}
        </button>

        {/* Add Burn Selected button */}
        {selectedItems.size > 0 && (
          <button
            onClick={async () => {
              if (window.confirm(`Are you sure you want to burn ${selectedItems.size} selected cNFTs? This action cannot be undone.`)) {
                const selectedCnfts = cnfts.filter(cnft => selectedItems.has(cnft.id));
                
                for (const cnft of selectedCnfts) {
                  await handleBurn(cnft);
                }
                // Clear selections after burning
                setSelectedItems(new Set());
              }
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <span>Burn Selected</span>
            <span className="bg-red-600 px-2 py-0.5 rounded-full text-xs">
              {selectedItems.size}
            </span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
        {collections.map((group) => {
          const selectionState = getCollectionSelectionState(group.cnfts);
          
          return (
            <div key={group.collection} className="flex flex-col">
              <div 
                className="relative cursor-pointer mb-2" 
                onClick={() => handleCollectionClick(group.collection)}
              >
                <div className="relative w-3/4 mx-auto aspect-square">
                  <img 
                    src={group.coverImage}
                    alt={group.collection}
                    className={`w-full h-full object-cover rounded-lg shadow-lg ${
                      selectionState === 'all' ? 'ring-2 ring-[#14F195]' : ''
                    }`}
                  />
                  <div className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full text-sm font-bold shadow-lg">
                    {group.cnfts.length}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectCollection(group.collection, group.cnfts);
                    }}
                    className={`absolute bottom-2 right-2 p-1 rounded-full ${
                      getSelectionButtonStyles(selectionState)
                    }`}
                  >
                    <span className="sr-only">Select Collection</span>
                    ✓
                  </button>
                </div>
                <div className="px-2 mt-2 text-center">
                  <h3 className="text-sm font-semibold break-words line-clamp-2" title={group.collectionName}>
                    {group.collectionName}
                  </h3>
                  <p className="text-xs text-gray-500 break-words line-clamp-1" title={group.collection}>
                    {formatCollectionDisplay(group.collection)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal-like expanded view */}
      {expandedCollection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <div className="flex items-center gap-4">
                <div className="max-w-md">
                  <h2 className="text-lg font-semibold break-words line-clamp-2" title={
                    collections.find(g => g.collection === expandedCollection)?.collectionName
                  }>
                    {collections.find(g => g.collection === expandedCollection)?.collectionName}
                  </h2>
                  <p className="text-sm text-gray-500 break-words line-clamp-1" title={expandedCollection}>
                    {formatCollectionDisplay(expandedCollection)}
                  </p>
                </div>
                {/* Select/Deselect All for current collection */}
                <button 
                  onClick={() => {
                    const currentCollection = collections.find(g => g.collection === expandedCollection);
                    if (currentCollection) {
                      handleSelectCollection(expandedCollection, currentCollection.cnfts);
                    }
                  }}
                  className={`text-sm text-white px-3 py-1 rounded transition-colors ${
                    getSelectionButtonStyles(
                      getCollectionSelectionState(
                        collections.find(g => g.collection === expandedCollection)?.cnfts || []
                      )
                    )
                  }`}
                >
                  {getCollectionSelectionState(
                    collections.find(g => g.collection === expandedCollection)?.cnfts || []
                  ) === 'all' 
                    ? 'Deselect All' 
                    : 'Select All'
                  }
                </button>
                {/* Burn Selected button */}
                {selectedItems.size > 0 && (
                  <button
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to burn ${selectedItems.size} selected cNFTs? This action cannot be undone.`)) {
                        const selectedCnfts = collections
                          .find(g => g.collection === expandedCollection)
                          ?.cnfts.filter(cnft => selectedItems.has(cnft.id)) || [];
                        
                        for (const cnft of selectedCnfts) {
                          await handleBurn(cnft);
                        }
                      }
                    }}
                    className="text-sm bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded flex items-center gap-2"
                  >
                    <span>Burn Selected</span>
                    <span className="bg-red-600 px-2 py-0.5 rounded-full text-xs">
                      {selectedItems.size}
                    </span>
                  </button>
                )}
              </div>
              <button 
                onClick={() => setExpandedCollection(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {collections
                  .find(g => g.collection === expandedCollection)
                  ?.cnfts.map((cnft) => (
                    <CNFTCard
                      key={cnft.id}
                      cnft={cnft}
                      onBurn={handleBurn}
                      isLoading={isProcessing}
                      size="small"
                      isSelected={selectedItems.has(cnft.id)}
                      onSelect={() => handleSelect(cnft.id)}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 