const { Connection, PublicKey } = require('@solana/web3.js');
const { createUmi } = require('@metaplex-foundation/umi');
const { defaultPlugins } = require('@metaplex-foundation/umi-bundle-defaults');
const { defaultProgramRepository } = require('@metaplex-foundation/umi-program-repository');
const { dasApi, GetAssetRpcResponse } = require('@metaplex-foundation/digital-asset-standard-api');
const { publicKey } = require('@metaplex-foundation/umi-public-keys');
const { mplBubblegum } = require('@metaplex-foundation/mpl-bubblegum');

// Your wallet address
const WALLET = '8mbfhEWTFFQmRhPixjfWAGe1eycBTTENh22GKVWnMVAX';
const ENDPOINT = 'https://api.mainnet-beta.solana.com';

async function checkDelegatedCNFTs() {
  console.log('Checking for delegated cNFTs in wallet:', WALLET);
  
  const connection = new Connection(ENDPOINT);
  const umi = createUmi()
    .use(defaultPlugins(ENDPOINT))
    .use(defaultProgramRepository())
    .use(mplBubblegum())
    .use(dasApi());

  try {
    // 1. Get all assets for wallet
    console.log('\n1. Fetching wallet assets...');
    const assets = await umi.rpc.getAssetsByOwner({
      owner: publicKey(WALLET)
    });

    // 2. Filter and analyze delegated assets
    const delegatedAssets = assets.items.filter((asset: typeof GetAssetRpcResponse) => 
      asset.ownership?.delegated === true
    );

    console.log('\nDelegated Assets Found:', delegatedAssets.length);
    
    // 3. Show details for each delegated asset
    delegatedAssets.forEach((asset: typeof GetAssetRpcResponse, index: number) => {
      console.log(`\n${index + 1}. Delegated Asset:`, {
        assetId: asset.id,
        name: asset.content?.metadata?.name || 'Unknown',
        delegate: asset.ownership?.delegate,
        tree: asset.compression?.tree,
        delegated: asset.ownership?.delegated
      });
    });

    // 4. Summary
    console.log('\nSummary:', {
      totalAssets: assets.items.length,
      delegatedCount: delegatedAssets.length,
      delegatedPercentage: `${((delegatedAssets.length / assets.items.length) * 100).toFixed(2)}%`
    });

  } catch (error) {
    console.error('Investigation failed:', error);
  }
}

checkDelegatedCNFTs()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  }); 