import { 
  Connection, 
  PublicKey,
  AccountInfo,
  ParsedAccountData,
  VersionedTransactionResponse,
  MessageV0,
  TransactionInstruction
} from '@solana/web3.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const INIT_PROGRAM_ID = 'F6fmDVCQfvnEq2KR8hhfZSEczfM9JK9fWbCsYJNbTGn7';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_ENDPOINT?.startsWith('http') 
  ? process.env.NEXT_PUBLIC_RPC_ENDPOINT
  : `https://${process.env.NEXT_PUBLIC_RPC_ENDPOINT}`;

async function analyzeProgram() {
  const connection = new Connection(RPC_URL!);
  
  // 1. Get Program Account
  const programAccount = await connection.getParsedAccountInfo(
    new PublicKey(INIT_PROGRAM_ID)
  );

  const accountData = programAccount.value?.data;
  console.log('\nProgram Info:', {
    space: Buffer.isBuffer(accountData) ? accountData.length : 'unknown',
    owner: programAccount.value?.owner.toString()
  });

  // 2. Get Recent Transactions
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(INIT_PROGRAM_ID),
    { limit: 10 }
  );

  // 3. Analyze Recent Uses
  console.log('\nRecent Transactions:');
  for (const sig of signatures) {
    const tx = await connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0
    });
    
    if (!tx) continue;

    console.log('\nTransaction:', {
      signature: sig.signature,
      slot: sig.slot,
      err: sig.err,
      memo: sig.memo,
      blockTime: new Date(tx.blockTime! * 1000).toISOString()
    });

    // Look for patterns in instruction data
    const message = tx.transaction.message as MessageV0;
    const initIx = message.compiledInstructions.find((ix) => 
      message.staticAccountKeys[ix.programIdIndex].toString() === INIT_PROGRAM_ID
    );

    if (initIx) {
      console.log('Instruction Data:', {
        hex: Buffer.from(initIx.data).toString('hex'),
        dataSize: initIx.data.length,
        accounts: initIx.accountKeyIndexes.length
      });
    }
  }
}

analyzeProgram().catch(console.error); 