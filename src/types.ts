export interface CNFT {
  id: string;
  name: string;
  symbol: string;
  uri: string;
  collection?: string;
  collectionName?: string;
  treeAddress: string;
  leafIndex: number;
  assetHash: string;
  ownership: {
    delegated: boolean;
    delegate: string | null;
    owner: string;
  };
}

export interface BurnResult {
  signature: string;
  success: boolean;
  error?: string;
  logs?: string[];
} 