export interface TransactionAnalysis {
  signature: string;
  version: number;
  instructions: {
    programId: string;
    accounts: string[];
    data: string;
  }[];
  lookupTables: {
    address: string;
    addresses: string[];
    slot: number;
  }[];
  options: {
    feePayer: string;
    computeUnits: number;
    fee: number;
  };
} 