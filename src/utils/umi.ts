import { createUmi } from '@metaplex-foundation/umi';
import { mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { RPC_ENDPOINT } from './constants';
import { defaultProgramRepository } from '@metaplex-foundation/umi-program-repository';
import { defaultPlugins } from '@metaplex-foundation/umi-bundle-defaults';

export const createUmiInstance = () => {
  return createUmi()
    .use(defaultPlugins(RPC_ENDPOINT))
    .use(defaultProgramRepository())
    .use(mplBubblegum())
    .use(dasApi());
}; 