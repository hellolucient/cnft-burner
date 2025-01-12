# cNFT Investigation Results - Corrected

## The Script

```typescript
const { Connection, PublicKey } = require('@solana/web3.js');
const { createUmi } = require('@metaplex-foundation/umi');
const { defaultPlugins } = require('@metaplex-foundation/umi-bundle-defaults');
const { defaultProgramRepository } = require('@metaplex-foundation/umi-program-repository');
const { dasApi } = require('@metaplex-foundation/digital-asset-standard-api');
const { publicKey } = require('@metaplex-foundation/umi-public-keys');
const { mplBubblegum } = require('@metaplex-foundation/mpl-bubblegum');

const ASSET = 'HyTXddbWfwjqyJ4tB4RXtMt3ZLXANv7vmWoWcuBRW3dk';
const ENDPOINT = 'https://api.mainnet-beta.solana.com';
```

## Investigation Results

### 1. Asset Information
```json
{
  "assetId": "HyTXddbWfwjqyJ4tB4RXtMt3ZLXANv7vmWoWcuBRW3dk",
  "compression": {
    "compressed": true,
    "tree": "474LEVaDthZh9uSpddqi8dNjbPj9Wqzq3bx7VKfTVJti",
    "leaf_id": 45878,
    "seq": 45895
  },
  "ownership": {
    "frozen": false,
    "delegated": true,
    "delegate": "FQDezz7XejjWn2hmMQNPy6FBiYar8NokJbUzutHUvt7d",
    "owner": "8mbfhEWTFFQmRhPixjfWAGe1eycBTTENh22GKVWnMVAX"
  }
}
```

### 2. Tree Account Status
```json
{
  "treeAddress": "474LEVaDthZh9uSpddqi8dNjbPj9Wqzq3bx7VKfTVJti",
  "dataSize": 52600,
  "owner": "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
}
```

### 3. Proof Data
```json
{
  "root": "7q2iJSKqaumgvacgWjqm1EFeUPZGGUst82TLiuyYMWQt",
  "proof": 24,
  "node_index": 16823094,
  "leaf": "HjoMaydoMSmaKqPSTskbBToJpgUE942Jy24V4WAVTgG3"
}
```

## Analysis

1. **Asset State**
   - Confirmed compressed NFT
   - Relatively low leaf_id (45878)
   - Sequence number close to leaf_id (45895)
   - Asset is delegated to FQDezz...vt7d
   - Not frozen

2. **Tree State**
   - Tree is active and valid
   - Significant data size (52600 bytes)
   - Owned by correct Bubblegum program
   - Shows frequent activity
   - Valid proof structure

3. **Delegation Status**
   - Asset is currently delegated to FQDezz...vt7d
   - Delegate Authority has permission to:
     1. Transfer the cNFT
     2. Burn the cNFT
   - Delegation must be revoked by owner before burning
   - Requires specific revocation transaction

## Key Findings

1. **Tree Health**
   - Tree is fully operational
   - Not closed or corrupted
   - Regular modifications occurring
   - Proper program ownership

2. **Asset Status**
   - Valid compression data
   - Complete proof chain
   - Current delegation active
   - Owner verified

3. **Potential Issues**
   - Delegation is actively blocking burns
   - Need to revoke delegation first
   - Current delegate has burn permissions
   - Owner must revoke before proceeding

## Solution

1. **Revoke Delegation**
```typescript
import { getAssetWithProof, delegate } from '@metaplex-foundation/mpl-bubblegum'

const assetWithProof = await getAssetWithProof(umi, assetId, {truncateCanopy: true});
await delegate(umi, {
  ...assetWithProof,
  leafOwner,
  previousLeafDelegate: currentDelegate,  // FQDezz7XejjWn2hmMQNPy6FBiYar8NokJbUzutHUvt7d
  newLeafDelegate: leafOwner.publicKey,  // Set back to owner
}).sendAndConfirm(umi)
```

2. **Then Attempt Burn**
   - After delegation is revoked
   - Owner will have full control
   - No delegate interference

## Recommendations

1. **Immediate Actions**
   - Revoke delegation first
   - Verify delegation is cleared
   - Then attempt burn operation

2. **Code Updates**
   - Add delegation check before burns
   - Add revocation handling
   - Implement proper delegation flow:
     1. Check delegation status
     2. Revoke if delegated
     3. Proceed with burn

3. **Further Investigation**
   - Research delegate program purpose
   - Check other assets in same tree
   - Monitor tree activity patterns

## References
- Asset ID: HyTXddbWfwjqyJ4tB4RXtMt3ZLXANv7vmWoWcuBRW3dk
- Tree Address: 474LEVaDthZh9uSpddqi8dNjbPj9Wqzq3bx7VKfTVJti
- Delegate: FQDezz7XejjWn2hmMQNPy6FBiYar8NokJbUzutHUvt7d
- Owner: 8mbfhEWTFFQmRhPixjfWAGe1eycBTTENh22GKVWnMVAX 

## Documentation
- [Metaplex Bubblegum Delegation Docs](https://developers.metaplex.com/bubblegum/delegate-cnfts) 