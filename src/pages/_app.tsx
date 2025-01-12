import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { useMemo, useEffect } from 'react';
import { NETWORK, RPC_ENDPOINT } from '@/utils/constants';
import dynamic from 'next/dynamic';
import { setupNetworkMonitoring } from '@/utils/monitor';

// Import wallet adapter CSS
require('@solana/wallet-adapter-react-ui/styles.css');

// Dynamic import of WalletModalProvider to avoid SSR issues
const WalletModalProviderDynamic = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletModalProvider),
  { 
    ssr: false,
    loading: () => null
  }
);

function App({ Component, pageProps }: AppProps) {
  const network = NETWORK as WalletAdapterNetwork;
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    [network]
  );

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setupNetworkMonitoring();
    }
  }, []);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProviderDynamic>
          <Component {...pageProps} />
        </WalletModalProviderDynamic>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Wrap the App component with dynamic to avoid SSR
export default dynamic(() => Promise.resolve(App), {
  ssr: false
});
