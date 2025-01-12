import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { CNFT, BurnResult } from '@/types';
import { ERROR_MESSAGES } from '@/utils/constants';
import { burn, getAssetWithProof, delegate } from '@metaplex-foundation/mpl-bubblegum';
import { createUmiInstance } from '@/utils/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { publicKey } from '@metaplex-foundation/umi-public-keys';
import { dasApi, DasApiInterface } from '@metaplex-foundation/digital-asset-standard-api';
import { Context } from '@metaplex-foundation/umi';
import { 
  createLutForTransactionBuilder, 
  createLut, 
  findAddressLookupTablePda
} from '@metaplex-foundation/mpl-toolbox';
import { 
  AddressLookupTableInput,
  RpcInterface,
  TransactionBuilder,
  Instruction,
  transactionBuilder,
  Signer,
  WrappedInstruction,
  PublicKey,
  TransactionSignature,
  CompiledInstruction
} from '@metaplex-foundation/umi';
import { 
  AddressLookupTableProgram,
  PublicKey as SolanaPublicKey,
  Transaction,
  SystemProgram,
  Connection,
  AddressLookupTableAccount,
  TransactionInstruction,
  VersionedTransaction
} from '@solana/web3.js';
import { computeOptimalCanopyDepth } from '@/utils/merkle';
import bs58 from 'bs58';

type UmiWithDas = ReturnType<typeof createUmiInstance> & { 
  rpc: DasApiInterface 
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const LUT_VERIFY_RETRIES = 3;
const LUT_VERIFY_DELAY = 1000;
const BATCH_SIZE = 2; // Number of CNFTs to process in parallel
const BATCH_DELAY = 1000; // Delay between batches in ms
const MAX_LUT_RETRIES = 3;
const CLEANUP_LUTS = true; // Whether to clean up LUTs after burning
const SLOT_HISTORY_DEPTH = 150; // Number of slots to look back
const MIN_SLOT_OFFSET = 20; // Minimum slots to look back
const MAX_SLOT_OFFSET = 100; // Maximum slots to look back
const MAX_PROOFS_PER_TX = 9; // Match successful example
const MAX_CANOPY_DEPTH = 14; // Maximum canopy depth for truncation
const LUT_OPERATION_TIMEOUT = 30000; // 30 seconds
const LUT_CLEANUP_TIMEOUT = 10000; // 10 seconds
const MAX_LUTS_PER_TX = 1;  // Use single lookup table
const COMPUTE_BUDGET_PROGRAM = publicKey('ComputeBudget111111111111111111111111111111');

const ERROR_TYPES = {
  LUT: {
    NOT_FOUND: 'not found',
    INVALID_ACCOUNT: 'invalid account',
    TIMEOUT: 'timed out',
    ALREADY_IN_USE: 'already in use',
    LOOKUP_FAILED: 'lookup failed',
    INVALID_INDEX: 'invalid index',
    CLEANUP_FAILED: 'cleanup failed',
    FETCH_FAILED: 'failed to fetch lookup tables',
    API_ERROR: 'api error'
  },
  TX: {
    TOO_LARGE: 'too large',
    TIMEOUT: 'timeout',
    BLOCK_HEIGHT: 'block height exceeded',
    SIMULATION_FAILED: 'simulation failed',
    SIGN_FAILED: 'failed to sign transaction'
  },
  PROOF: {
    INVALID: 'invalid proof',
    TOO_MANY: 'too many proofs',
    FETCH_FAILED: 'failed to fetch proof'
  },
  WALLET: {
    NO_PAYER: 'no payer available',
    DISCONNECTED: 'wallet disconnected'
  },
  MERKLE: {
    PROOF_MISMATCH: 'leaf value does not match',
    TREE_CHANGED: 'tree state changed',
    INVALID_PROOF: 'invalid merkle proof',
    CONCURRENT_ERROR: 'concurrent merkle tree error',
    CANOPY_DEPTH: 'canopy depth error'
  },
  INIT: {
    FAILED: 'Initialization failed'
  }
} as const;

const TX_OPTIONS = {
  maxRetries: 3,
  skipPreflight: true,
  commitment: 'confirmed'
} as const;

interface LookupTableResponse {
  error?: string;
  lookupTables: Record<string, string>;
  minContextSlot?: number;
}

const API_ENDPOINT = 'https://sol-incinerator.dev/create/table/mapping';

const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
  let lastError = new Error('No attempts made');
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (err) {
      lastError = err as Error;
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        console.log(`Retry ${i + 1} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> => {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
};

const fetchLookupTablesForProofs = async (
  proofs: string[],
  connection: Connection
): Promise<AddressLookupTableInput[]> => {
  try {
    if (!proofs.length) {
      console.log('No proofs to fetch LUTs for');
      return [];
    }

    console.log(`Fetching lookup tables for ${proofs.length} proofs`);
    
    const response = await withTimeout(
      fetchWithRetry(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proofs)
      }),
      LUT_OPERATION_TIMEOUT,
      `${ERROR_TYPES.LUT.TIMEOUT}: LUT fetch operation timed out`
    );

    if (!response.ok) {
      throw new Error(`${ERROR_TYPES.LUT.API_ERROR}: ${response.status} ${response.statusText}`);
    }

    const { error, lookupTables, minContextSlot }: LookupTableResponse = await response.json();
    
    if (error) {
      throw new Error(`${ERROR_TYPES.LUT.API_ERROR}: ${error}`);
    }

    // Wait for connection to reach minimum slot
    const slot = minContextSlot ? minContextSlot + 1 : undefined;
    if (slot) {
      console.log(`Waiting for slot ${slot}...`);
      await connection.getSlot('confirmed');
    }

    // Fetch all tables
    const tablesNeeded = new Set(Object.values(lookupTables));
    const fetchedTables = new Map<string, Promise<AddressLookupTableAccount | null>>();
    
    for (const table of tablesNeeded) {
      fetchedTables.set(table, connection.getAddressLookupTable(
        new SolanaPublicKey(table)
      ).then(res => res.value));
    }

    // Convert to AddressLookupTableInput format
    const finalTables: AddressLookupTableInput[] = [];
    for (const [proof, table] of Object.entries(lookupTables)) {
      try {
        const fetchedTable = await fetchedTables.get(table);
        if (fetchedTable) {
          finalTables.push({
            publicKey: publicKey(table),
            addresses: Array.from(fetchedTable.state.addresses).map(addr => 
              publicKey(addr.toString())
            )
          });
        }
      } catch (err) {
        const error = err as Error;
        console.warn(`Failed to fetch table ${table}:`, error);
      }
    }

    return finalTables;
  } catch (err) {
    const error = err as Error;
    console.error('Failed to fetch lookup tables:', error);
    throw new Error(`${ERROR_TYPES.LUT.FETCH_FAILED}: ${error.message}`);
  }
};

interface BurnProgress {
  total: number;
  current: number;
  success: number;
  failed: number;
}

const simulateTransaction = async (
  burnTx: TransactionBuilder,
  umi: UmiWithDas,
  connection: Connection
): Promise<void> => {
  try {
    // Build the transaction
    const builtTx = await burnTx.buildWithLatestBlockhash(umi);
    
    // Try with preflight
    const preflightResult = await burnTx.send(umi, {
      skipPreflight: false
    });
    console.log('Transaction preflight successful:', preflightResult);

    // Try without preflight
    const simulationResult = await burnTx.send(umi, {
      skipPreflight: true
    });
    console.log('Transaction simulation successful:', simulationResult);

  } catch (err) {
    const error = err as Error;
    console.error('Transaction simulation failed:', error);
    
    // Check for specific simulation errors
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('insufficient funds')) {
      throw new Error(`${ERROR_TYPES.TX.SIMULATION_FAILED}: Insufficient funds for transaction`);
    } else if (errorMessage.includes('blockhash not found')) {
      throw new Error(`${ERROR_TYPES.TX.SIMULATION_FAILED}: Blockhash expired - please try again`);
    } else {
      throw new Error(`${ERROR_TYPES.TX.SIMULATION_FAILED}: ${error.message}`);
    }
  }
};

// Add new error messages
const DELEGATION_ERRORS = {
  REVOKE_FAILED: 'Failed to revoke delegation',
  NOT_OWNER: 'Not the owner of this NFT'
} as const;

// Create compute budget instructions
const computePriceIx: WrappedInstruction = {
  instruction: {
    programId: COMPUTE_BUDGET_PROGRAM,
    keys: [],
    data: Buffer.from([
      3,  // SetComputeUnitPrice
      0x40, 0x9C, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00  // 40000 microlamports (higher priority)
    ])
  },
  bytesCreatedOnChain: 0,
  signers: []
};

const computeLimitIx: WrappedInstruction = {
  instruction: {
    programId: COMPUTE_BUDGET_PROGRAM,
    keys: [],
    data: Buffer.from([
      2,  // SetComputeUnitLimit
      0x40, 0x0D, 0x03, 0x00  // 200000 units
    ])
  },
  bytesCreatedOnChain: 0,
  signers: []
};

export const useBurnCNFT = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BurnProgress>({
    total: 0,
    current: 0,
    success: 0,
    failed: 0
  });

  const cleanupLUTs = async (
    umi: UmiWithDas, 
    lutAccounts: AddressLookupTableInput[]
  ) => {
    if (!wallet.publicKey) return;
    
    console.log('Cleaning up LUTs...');
    for (const lut of lutAccounts) {
      try {
        if (!lut.addresses.length) {
          console.warn('Invalid LUT account - no addresses');
          continue;
        }

        const lookupTableAddress = new SolanaPublicKey(lut.addresses[0].toString());
        
        // Verify LUT still exists before cleanup
        const lookupTableAccount = await connection.getAccountInfo(lookupTableAddress);
        if (!lookupTableAccount) {
          console.log('LUT already cleaned up:', lut.addresses[0].toString());
          continue;
        }

        const instruction = AddressLookupTableProgram.closeLookupTable({
          lookupTable: lookupTableAddress,
          authority: wallet.publicKey,
          recipient: wallet.publicKey
        });

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        
        const transaction = new Transaction()
          .add(instruction);
        
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;

        // Sign and send the transaction
        if (!wallet.signTransaction) {
          throw new Error('Wallet does not support transaction signing');
        }
        const signedTx = await wallet.signTransaction(transaction);
        if (!signedTx) {
          throw new Error('Failed to sign transaction');
        }

        const tx = await connection.sendRawTransaction(
          signedTx.serialize(),
          { skipPreflight: true }
        );
        
        await connection.confirmTransaction(tx, 'confirmed');
        console.log('Cleaned up LUT:', lut.addresses[0].toString());
      } catch (err) {
        console.warn('Failed to cleanup LUT:', err);
        if (err instanceof Error) {
          const errorMessage = err.message.toLowerCase();
          if (errorMessage.includes('not found')) {
            console.log('LUT already removed');
          } else if (errorMessage.includes('invalid account')) {
            console.log('Invalid LUT account');
          }
        }
      }
    }
  };

  const burnSingleCNFT = async (cnft: CNFT, umi: UmiWithDas) => {
    try {
      console.log('Starting burn for:', cnft.id);

      // Get asset with full proofs first to compare
      const fullAssetWithProof = await getAssetWithProof(umi, publicKey(cnft.id));
      
      // Log full proof details
      console.log('Full proof details:', {
        proofLength: fullAssetWithProof.proof.length,
        treeAddress: cnft.treeAddress
      });

      // Get tree account info to check canopy
      const treeAccount = await umi.rpc.getAccount(publicKey(cnft.treeAddress));
      console.log('Tree account details:', {
        exists: treeAccount.exists,
        dataSize: treeAccount.exists ? treeAccount.data?.length : 0,
        hasCanopy: treeAccount.exists ? (treeAccount.data?.length ?? 0) > 32 : false,
        owner: treeAccount.exists ? treeAccount.owner?.toString() : 'none'
      });

      // Create base transaction with full proofs
      let burnTx = burn(umi, 
        cnft.ownership?.delegated ? {
          ...fullAssetWithProof,
          leafDelegate: publicKey(cnft.ownership.delegate!)
        } : fullAssetWithProof
      );

      // Add compute budget instructions
      burnTx = burnTx
        .prepend(computePriceIx)  // Set compute unit price (100000)
        .prepend(computeLimitIx);  // Set compute unit limit (200000)

      // Log transaction instructions before sending
      const builtTx = await burnTx.buildWithLatestBlockhash(umi);
      console.log('Transaction Instructions:', builtTx.message.instructions.map(ix => ({
        programId: builtTx.message.accounts[ix.programIndex].toString(),
        data: Buffer.from(ix.data).toString('hex'),
        numAccounts: ix.accountIndexes.length
      })));

      try {
        // Get fresh blockhash and send
        const latestBlockhash = await umi.rpc.getLatestBlockhash();
        burnTx.setBlockhash(latestBlockhash);
        
        // Send and confirm the transaction
        const result = await burnTx.sendAndConfirm(umi);
        
        console.log('Transaction:', {
          signature: bs58.encode(result.signature),
          solscanLink: `https://solscan.io/tx/${bs58.encode(result.signature)}`
        });

        return result;
      } catch (error: any) {
        if (error?.logs) {
          console.error('Transaction failed with logs:', error.logs);
          // If we get a size error, throw it specifically
          if (error.message?.includes('too large')) {
            throw new Error(`Transaction too large: ${error.message}`);
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Burn attempt failed:', error);
      throw error;
    }
  };

  const burnCNFT = async (cnft: CNFT): Promise<BurnResult> => {
    if (!wallet.publicKey) {
      throw new Error(ERROR_MESSAGES.NO_WALLET);
    }

    setIsProcessing(true);
    try {
      const umi = createUmiInstance()
        .use(walletAdapterIdentity(wallet))
        .use(dasApi()) as UmiWithDas;
      
      const burnResult = await burnSingleCNFT(cnft, umi);
      
      return {
        signature: Buffer.from(burnResult!.signature).toString('base64'),
        success: true
      };
    } catch (error) {
      console.error('Burn error:', error);
      return {
        signature: '',
        success: false,
        error: typeof error === 'string' ? error : ERROR_MESSAGES.BURN_FAILED
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const burnMultipleCNFTs = async (cnfts: CNFT[]): Promise<BurnResult[]> => {
    setProgress({ total: cnfts.length, current: 0, success: 0, failed: 0 });
    
    if (!wallet.publicKey) {
      throw new Error(ERROR_MESSAGES.NO_WALLET);
    }

    setIsProcessing(true);
    const results: BurnResult[] = [];
    const umi = createUmiInstance()
      .use(walletAdapterIdentity(wallet))
      .use(dasApi()) as UmiWithDas;

    try {
      // Process in batches to avoid rate limits
      for (let i = 0; i < cnfts.length; i += BATCH_SIZE) {
        const batch = cnfts.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(cnfts.length / BATCH_SIZE)}`);

        try {
          const promises = batch.map(cnft => burnSingleCNFT(cnft, umi));
          const batchResults = await Promise.all(promises);
          const successCount = batchResults.filter(r => r).length;
          
          setProgress(prev => ({
            ...prev,
            current: prev.current + batch.length,
            success: prev.success + successCount,
            failed: prev.failed + (batch.length - successCount)
          }));

          results.push(...batchResults.map(result => ({
            signature: Buffer.from(result.signature).toString('base64'),
            success: true
          })));

          // Add delay between batches if not the last batch
          if (i + BATCH_SIZE < cnfts.length) {
            console.log(`Waiting ${BATCH_DELAY}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }
        } catch (error) {
          console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error);
          // Add failed results for this batch
          results.push(...batch.map(() => ({
            signature: '',
            success: false,
            error: typeof error === 'string' ? error : ERROR_MESSAGES.BURN_FAILED
          })));
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk burn error:', error);
      // Fill in remaining results as failures
      const remainingCount = cnfts.length - results.length;
      return [
        ...results,
        ...Array(remainingCount).fill({
          signature: '',
          success: false,
          error: typeof error === 'string' ? error : ERROR_MESSAGES.BURN_FAILED
        })
      ];
    } finally {
      setIsProcessing(false);
    }
  };

  return { burnCNFT, burnMultipleCNFTs, isProcessing, progress };
}; 