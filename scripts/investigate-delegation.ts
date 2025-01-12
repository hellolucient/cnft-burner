// This will be a standalone script to investigate delegated cNFT burning

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { createUmi } = require('@metaplex-foundation/umi');
const { defaultPlugins } = require('@metaplex-foundation/umi-bundle-defaults');
const { defaultProgramRepository } = require('@metaplex-foundation/umi-program-repository');
const { dasApi, DasApiAsset } = require('@metaplex-foundation/digital-asset-standard-api');
const { publicKey } = require('@metaplex-foundation/umi-public-keys');
const { mplBubblegum, getAssetWithProof, burn, delegate } = require('@metaplex-foundation/mpl-bubblegum');
const { mplTokenMetadata } = require('@metaplex-foundation/mpl-token-metadata');
const { Context } = require('@metaplex-foundation/umi');
const { keypairIdentity, createSignerFromKeypair } = require('@metaplex-foundation/umi');

const ASSET_ID = 'HyTXddbWfwjqyJ4tB4RXtMt3ZLXANv7vmWoWcuBRW3dk';
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const WALLET = '8mbfhEWTFFQmRhPixjfWAGe1eycBTTENh22GKVWnMVAX';

async function testDelegateBurn(umi: any, asset: any) {
  console.log('\nTesting Direct-Delegate-Burn approach...');
  const assetWithProof = await getAssetWithProof(umi, publicKey(ASSET_ID), {
    truncateCanopy: true
  });

  // Log transaction components
  console.log('Investigation Components:', {
    proofLength: assetWithProof.proof.length,
    treeId: assetWithProof.merkleTree?.toString(),
    leafDelegate: asset.ownership.delegate,
    proofSample: assetWithProof.proof.slice(0, 2).map((p: string) => p.toString())
  });

  // Create burn transaction
  const burnTx = burn(umi, {
    ...assetWithProof,
    leafDelegate: publicKey(asset.ownership.delegate)
  });

  // Calculate required vs extra proofs
  const totalProofs = assetWithProof.proof.length;
  const requiredProofs = assetWithProof.proof.slice(0, totalProofs - 9);
  const extraProofs = assetWithProof.proof
    .slice(-9)
    .map((p: string) => p.toString());

  console.log('Proof distribution:', {
    total: totalProofs,
    required: requiredProofs.length,
    extra: extraProofs.length
  });

  const builtTx = await burnTx.buildWithLatestBlockhash(umi);
  console.log('Transaction Analysis:', {
    totalSize: builtTx.serializedMessage.length,
    numInstructions: builtTx.message.instructions.length,
    numAccounts: builtTx.message.accounts.length,
    // Compare with successful tool's 1128 bytes
    sizeDifference: builtTx.serializedMessage.length - 1128
  });
}

async function investigateDelegation() {
  console.log('Investigating delegated cNFT:', ASSET_ID);
  
  // Create keypair first
  const keypair = Keypair.generate();
  const signer = createSignerFromKeypair(createUmi(), keypair);
  
  // Then create UMI with signer
  const umi = createUmi()
    .use(defaultPlugins(RPC_URL))
    .use(defaultProgramRepository())
    .use(mplBubblegum())
    .use(dasApi())
    .use(keypairIdentity(signer));

  try {
    // Get asset data first
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

    await testDelegateBurn(umi, asset);

  } catch (error) {
    console.error('Investigation failed:', error);
  }
}

// Run the investigation
investigateDelegation()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  }); 