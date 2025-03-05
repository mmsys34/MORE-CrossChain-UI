import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrum,
  mainnet,
  flowMainnet,
  flowTestnet
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'RainbowKit App',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    mainnet,
    flowMainnet,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [flowTestnet] : []),
  ],
  ssr: true,
});
