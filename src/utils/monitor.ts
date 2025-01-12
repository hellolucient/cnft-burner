interface WalletTransaction {
  transaction: unknown;
  options?: unknown;
}

export function setupNetworkMonitoring() {
  // Monitor fetch requests
  const originalFetch = window.fetch;
  window.fetch = function(...args: Parameters<typeof fetch>) {
    console.log('Network Request:', {
      url: args[0],
      options: args[1]
    });
    return originalFetch.apply(this, args);
  };

  // Monitor wallet transactions
  if (window.solana) {
    const originalSignAndSendTransaction = window.solana.signAndSendTransaction;
    window.solana.signAndSendTransaction = async function(
      ...args: [WalletTransaction, ...unknown[]]
    ) {
      console.log('Transaction Details:', {
        transaction: args[0],
        options: args[1]
      });
      return originalSignAndSendTransaction.apply(this, args);
    };
  }
} 