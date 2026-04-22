// src/lib/x1-api.ts
// Fetches wallet token balances from the XDEX API.
// Used as the primary source for the token selector in App.tsx;
// falls back to direct RPC scan if the API returns nothing.

import axios from 'axios';

export interface TokenData {
  mint: string;
  symbol: string;
  name: string;
  logo: string | null;
  balance: number;
  decimals: number;
}

export async function getUserTokens(
  walletAddress: string,
  network: 'mainnet' | 'testnet'
): Promise<TokenData[]> {
  try {
    const networkParam = network === 'mainnet' ? 'X1 Mainnet' : 'X1 Testnet';

    const response = await axios.get('https://api.xdex.xyz/api/xendex/wallet/tokens', {
      params: {
        network: networkParam,
        wallet_address: walletAddress,
      },
    });

    // XDEX wallet tokens API returns { data: { tokens: [...] } }
    const outerData = response.data?.data;
    const tokenList: any[] = Array.isArray(outerData?.tokens)
      ? outerData.tokens
      : Array.isArray(outerData)
      ? outerData
      : Array.isArray(response.data)
      ? response.data
      : [];

    return tokenList.map((token: any): TokenData => ({
      mint: token.mint || token.address,
      symbol: token.symbol || 'UNK',
      name: token.name || 'Unknown',
      logo: token.imageUrl || token.image || token.logoURI || null,
      balance: token.ui_amount ?? token.balance ?? 0,
      decimals: token.decimals ?? 0,
    }));
  } catch (error) {
    console.error('[x1-api] getUserTokens failed:', error);
    return [];
  }
}
