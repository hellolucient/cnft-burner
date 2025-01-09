import type { NextApiRequest, NextApiResponse } from 'next';
import { CNFT } from '@/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { owner } = req.query;
  if (!owner) {
    return res.status(400).json({ error: 'Owner address is required' });
  }

  try {
    const response = await fetch(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'my-id',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: owner,
            page: 1,
            limit: 1000,
            displayOptions: {
              showUnverifiedCollections: true
            }
          }
        })
      }
    );

    const data = await response.json();
    console.log('API Response:', data);

    // Filter out burned cNFTs
    const cnfts: CNFT[] = data.result.items
      .filter((item: any) => !item.burnt && item.compression.compressed)
      .map((item: any) => ({
        id: item.id,
        name: item.content.metadata.name,
        symbol: item.content.metadata.symbol,
        uri: item.content.links.image,
        collection: item.grouping.find((g: any) => g.group_key === 'collection')?.group_value,
        collectionName: item.grouping.find((g: any) => g.group_key === 'collection')?.collection_metadata?.name || '',
        treeAddress: item.compression.tree,
        leafIndex: item.compression.leaf_id,
        assetHash: item.compression.asset_hash
      }));

    return res.status(200).json(cnfts);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to fetch cNFTs' });
  }
} 