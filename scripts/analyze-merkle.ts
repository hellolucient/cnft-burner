const { Connection, PublicKey } = require('@solana/web3.js');
const { createUmi } = require('@metaplex-foundation/umi');
const { defaultPlugins } = require('@metaplex-foundation/umi-bundle-defaults');
const { defaultProgramRepository } = require('@metaplex-foundation/umi-program-repository');
const { dasApi } = require('@metaplex-foundation/digital-asset-standard-api');
const { publicKey } = require('@metaplex-foundation/umi-public-keys');
const { mplBubblegum, getAssetWithProof } = require('@metaplex-foundation/mpl-bubblegum');

const ASSET = 'HyTXddbWfwjqyJ4tB4RXtMt3ZLXANv7vmWoWcuBRW3dk';
const ENDPOINT = 'https://api.mainnet-beta.solana.com';

async function getHistoricalData(connection: typeof Connection, treeAddress: string) {
  console.log('\n4. Fetching historical data...');
  
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(treeAddress),
    { limit: 10 }
  );

  return signatures.map((sig: { 
    signature: string, 
    slot: number, 
    blockTime?: number 
  }) => ({
    signature: sig.signature,
    slot: sig.slot,
    timestamp: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'unknown'
  }));
}

async function analyzeMerkleTree() {
  console.log('Investigating cNFT:', ASSET);
  
  // Initialize connections
  const connection = new Connection(ENDPOINT);
  const umi = createUmi()
    .use(defaultPlugins(ENDPOINT))
    .use(defaultProgramRepository())
    .use(mplBubblegum())
    .use(dasApi());

  try {
    // 1. Get basic asset info from DAS
    console.log('\n1. Fetching asset info...');
    const assetId = publicKey(ASSET);
    const asset = await umi.rpc.getAsset(assetId);
    console.log({
      assetId: ASSET,
      compression: asset.compression,  // This will show us all tree data
      ownership: asset.ownership
    });

    // 2. Get tree info using correct tree address
    console.log('\n2. Fetching tree info...');
    const treeAddress = asset.compression.tree;  // Use correct tree address
    const treeAccount = await connection.getAccountInfo(new PublicKey(treeAddress));
    
    console.log({
      treeAddress: treeAddress,
      dataSize: treeAccount?.data.length,
      owner: treeAccount?.owner.toBase58()
    });

    // 3. Get proof data
    console.log('\n3. Getting proof details...');
    const proofData = await umi.rpc.getAssetProof(assetId);
    console.log('Proof data:', {
      root: proofData.root,
      proof: proofData.proof.length,
      node_index: proofData.node_index,
      leaf: proofData.leaf
    });

    // 4. Get historical data
    const history = await getHistoricalData(connection, treeAddress);
    console.log('\nRecent tree modifications:', history);

    // Summary
    console.log('\nSummary:', {
      treeAddress: treeAddress,
      isTreeValid: !!treeAccount,
      proofValid: proofData.proof.length > 0,
      hasHistory: history.length > 0,
      recommendations: [
        'Next steps based on findings...'
      ]
    });

  } catch (error) {
    console.error('Investigation failed:', error);
  }
}

analyzeMerkleTree()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  }); 