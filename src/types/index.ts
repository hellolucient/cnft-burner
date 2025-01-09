import { createUmi } from '@metaplex-foundation/umi';
import { DasApiInterface } from '@metaplex-foundation/digital-asset-standard-api';

export interface CNFT {
  id: string;
  name: string;
  uri: string;
  symbol: string;
  collection?: string;
  assetHash: string;
  treeAddress: string;
  leafIndex: number;
}

export interface BurnResult {
  signature: string;
  success: boolean;
  error?: string;
}

export type UmiWithDas = ReturnType<typeof createUmi> & {
  rpc: {
    das: DasApiInterface;
  };
}; 