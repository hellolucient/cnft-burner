import { 
  Connection, 
  PublicKey, 
  TransactionResponse, 
  VersionedMessage,
  MessageV0,
  MessageCompiledInstruction,
  AddressLookupTableAccount
} from '@solana/web3.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { Buffer } from 'buffer';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUCCESSFUL_BURNS = [
  // Delegated burn
  '2nt1sWH2CKV1QHpFKPEWnvMPADQHHPKkhwDxXnJjs4GhVE2cud9d6TQHeZd3SxqmTMXmTbGhyFQ4U9fzNFAmnfKq',
  // Normal burn
  '4a48BRh3AGSSaSPDQCBcbFViJdnU4UimrVMWTz6owP4unB2FjwD3iFf4KkM6NMsbMCVk5PSz98UdS2qSMgxqBHw'
];

// Make sure RPC_URL starts with https://
const RPC_URL = process.env.NEXT_PUBLIC_RPC_ENDPOINT?.startsWith('http') 
  ? process.env.NEXT_PUBLIC_RPC_ENDPOINT
  : `https://${process.env.NEXT_PUBLIC_RPC_ENDPOINT}`;

interface LutState {
  addresses: string[];
  authority?: string;
  deactivationSlot: string;
  lastExtendedSlot: number;
  isActive: boolean;
}

interface LutSuccessResponse {
  address: string;
  state: LutState;
}

interface LutErrorResponse {
  address: string;
  error: string;
}

type LutResponse = LutSuccessResponse | LutErrorResponse;

async function getLutDetails(connection: Connection, lutAddress: PublicKey) {
  try {
    const account = await connection.getAddressLookupTable(lutAddress);
    if (!account.value) {
      return {
        address: lutAddress.toString(),
        error: 'LUT not found'
      };
    }

    return {
      address: lutAddress.toString(),
      state: {
        addresses: account.value.state.addresses.map(a => a.toString()),
        authority: account.value.state.authority?.toString(),
        deactivationSlot: account.value.state.deactivationSlot.toString(),
        lastExtendedSlot: account.value.state.lastExtendedSlot,
        isActive: !account.value.state.deactivationSlot
      }
    };
  } catch (err) {
    return {
      address: lutAddress.toString(),
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

async function analyzeTransaction(signature: string) {
  const connection = new Connection(RPC_URL!);
  
  console.log(`\nAnalyzing transaction: ${signature}`);
  
  // Get full transaction data
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: 'confirmed'
  });

  if (!tx) {
    console.log('Transaction not found');
    return;
  }

  const message = tx.transaction.message as MessageV0;

  // Basic Structure
  console.log('\nTransaction Structure:', {
    version: tx.version,
    numInstructions: message.compiledInstructions.length,
    numAccounts: message.staticAccountKeys.length,
    numAddressTableLookups: message.addressTableLookups?.length || 0
  });

  // Detailed LUT Analysis
  const luts = message.addressTableLookups || [];
  const lutDetails = await Promise.all(
    luts.map(lut => getLutDetails(connection, lut.accountKey))
  );

  console.log('\nDetailed LUT Analysis:', {
    numLuts: luts.length,
    lutDetails: lutDetails.map((lut: LutResponse) => ({
      address: lut.address,
      numAddresses: 'state' in lut ? lut.state.addresses.length : 0,
      addresses: 'state' in lut ? lut.state.addresses : [],
      isActive: 'state' in lut ? lut.state.isActive : false,
      error: 'error' in lut ? lut.error : undefined
    }))
  });

  // Program Analysis
  const uniquePrograms = new Set(
    message.compiledInstructions.map(ix => 
      message.staticAccountKeys[ix.programIdIndex].toString()
    )
  );

  console.log('\nPrograms Used:', Array.from(uniquePrograms));

  // Instruction Details
  console.log('\nInstruction Details:', message.compiledInstructions.map(ix => {
    try {
      return {
        programId: message.staticAccountKeys[ix.programIdIndex].toString(),
        numAccounts: ix.accountKeyIndexes.length,
        dataSize: ix.data.length,
        accounts: ix.accountKeyIndexes
          .filter(index => index < message.staticAccountKeys.length)  // Ensure valid index
          .map(index => message.staticAccountKeys[index]?.toString() || 'unknown')
      };
    } catch (err) {
      console.log('Error processing instruction:', err);
      return {
        programId: 'error',
        numAccounts: 0,
        dataSize: 0,
        accounts: []
      };
    }
  }));

  // Add more debug info
  console.log('\nStatic Account Keys:', {
    count: message.staticAccountKeys.length,
    keys: message.staticAccountKeys.map(key => key.toString())
  });

  console.log('\nLookup Table Raw Data:', {
    lookups: message.addressTableLookups?.map(lut => ({
      tableId: lut.accountKey.toString(),
      writableIndexes: lut.writableIndexes,
      readonlyIndexes: lut.readonlyIndexes
    }))
  });

  // Log Messages Analysis
  console.log('\nTransaction Logs:', tx.meta?.logMessages);

  const initInstruction = message.compiledInstructions.find(ix => 
    message.staticAccountKeys[ix.programIdIndex].toString() === 'F6fmDVCQfvnEq2KR8hhfZSEczfM9JK9fWbCsYJNbTGn7'
  );

  if (initInstruction) {
    analyzeInstructionData(Buffer.from(initInstruction.data));
  }
}

function analyzeInstructionData(data: Buffer) {
  console.log('\nInitialize Instruction Data:', {
    hex: data.toString('hex'),
    bytes: Array.from(data),
    possibleU64: data.readBigUInt64LE(0),  // Try reading as u64
    possibleU32s: [data.readUInt32LE(0), data.readUInt32LE(4)],  // Try as two u32s
  });
}

async function main() {
  console.log('Starting detailed analysis of successful burns...');
  
  for (const signature of SUCCESSFUL_BURNS) {
    await analyzeTransaction(signature);
  }
}

main().catch(console.error); 