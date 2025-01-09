export interface CNFT {
  id: string;
  name: string;
  symbol: string;
  uri: string;
  collection?: string;
  treeAddress: string;
  leafIndex: number;
  assetHash: string;
}

export interface BurnResult {
  signature: string;
  success: boolean;
  error?: string;
  logs?: string[];
} 