// This will be a standalone script to investigate HyTXddbWfwjqyJ4tB4RXtMt3ZLXANv7vmWoWcuBRW3dk

const { Connection, PublicKey } = require('@solana/web3.js');
const { createUmi } = require('@metaplex-foundation/umi');
const { defaultPlugins } = require('@metaplex-foundation/umi-bundle-defaults');
const { defaultProgramRepository } = require('@metaplex-foundation/umi-program-repository');
const { dasApi } = require('@metaplex-foundation/digital-asset-standard-api');
const { publicKey } = require('@metaplex-foundation/umi-public-keys');
const { mplBubblegum, getAssetWithProof } = require('@metaplex-foundation/mpl-bubblegum');
const { mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');

const ASSET_ID = '232DvzLgeiyc5vzEmYXpeBtJQMkULzz3Cr7zRTxE3giy';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const WALLET = '8mbfhEWTFFQmRhPixjfWAGe1eycBTTENh22GKVWnMVAX';

function calculateTransactionSize(proofLength: number): number {
  const BASE_TX_SIZE = 100;
  const PROOF_ELEMENT_SIZE = 32;
  const LUT_REFERENCE_SIZE = 32;
  
  return BASE_TX_SIZE + 
         (proofLength * PROOF_ELEMENT_SIZE) + 
         (Math.min(proofLength, 10) * LUT_REFERENCE_SIZE);
}

function analyzeTreeMetadata(treeAccount: Uint8Array): void {
  console.log('\n4. Analyzing tree metadata...');
  
  console.log({
    accountSize: treeAccount.length,
    hasCanopy: treeAccount.length > 32,
    estimatedMaxDepth: Math.floor(Math.log2(treeAccount.length))
  });
}

async function getHistoricalData(connection: typeof Connection, treeAddress: string) {
  console.log('\n5. Fetching historical data...');
  
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

async function investigateCNFT() {
  console.log('Investigating cNFT:', ASSET_ID);
  
  const connection = new Connection(RPC_URL);
  const umi = createUmi()
    .use(defaultPlugins(RPC_URL))
    .use(defaultProgramRepository())
    .use(mplBubblegum())
    .use(dasApi());

  try {
    // 1. Get basic asset info with delegation focus
    console.log('\n1. Getting asset info...');
    const asset = await umi.rpc.getAsset(publicKey(ASSET_ID));
    console.log('Asset data:', {
      assetId: ASSET_ID,
      name: asset.content?.metadata?.name,
      ownership: {
        delegated: asset.ownership?.delegated,
        delegate: asset.ownership?.delegate,
        owner: asset.ownership?.owner
      }
    });

    // 2. Simulate delegation revocation
    console.log('\n2. Testing delegation revocation requirements...');
    const assetWithProof = await getAssetWithProof(umi, publicKey(ASSET_ID));
    console.log('Revocation requirements:', {
      needsRevocation: asset.ownership?.delegated,
      currentDelegate: asset.ownership?.delegate,
      proofLength: assetWithProof.proof.length,
      canRevoke: asset.ownership?.owner.toString() === WALLET // Check if we're the owner
    });

    // 3. Summary
    console.log('\nSummary:');
    console.log({
      isDelegated: asset.ownership?.delegated,
      revocationNeeded: asset.ownership?.delegated,
      recommendedFlow: asset.ownership?.delegated ? 'Revoke then Burn' : 'Direct Burn',
      estimatedSteps: asset.ownership?.delegated ? 2 : 1
    });

  } catch (error) {
    console.error('Investigation failed:', error);
  }
}

// Run the investigation
investigateCNFT()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  }); 