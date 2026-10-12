import * as Network from 'expo-network';
import { useCallback, useEffect, useState } from 'react';

import { findPC, probe, type FoundPC } from '@/audio/sender';

export type SearchState =
  | { status: 'searching' }
  | { status: 'found'; pc: FoundPC }
  | { status: 'no-wifi' }
  // `tried` is set when the user typed an address that didn't answer.
  | { status: 'not-found'; tried?: string };

async function search(lastHost: string): Promise<SearchState> {
  const network = await Network.getNetworkStateAsync();
  const onLocalNetwork =
    network.type === Network.NetworkStateType.WIFI || network.type === Network.NetworkStateType.ETHERNET;
  if (!onLocalNetwork) return { status: 'no-wifi' };
  const pc = await findPC(lastHost, await Network.getIpAddressAsync());
  return pc ? { status: 'found', pc } : { status: 'not-found' };
}

// Looks for the PC on mount. `remember` is called with each PC found; keep it stable.
export function usePCSearch(lastHost: string, remember: (host: string) => void) {
  const [state, setState] = useState<SearchState>({ status: 'searching' });
  const [initialHost] = useState(lastHost);

  const apply = useCallback(
    (result: SearchState) => {
      if (result.status === 'found') remember(result.pc.host);
      setState(result);
    },
    [remember],
  );

  useEffect(() => {
    let cancelled = false;
    void search(initialHost).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [initialHost, apply]);

  const searchAgain = useCallback(() => {
    setState({ status: 'searching' });
    void search(lastHost).then(apply);
  }, [lastHost, apply]);

  const connectTo = useCallback(
    (host: string) => {
      setState({ status: 'searching' });
      void probe(host).then((pc) => apply(pc ? { status: 'found', pc } : { status: 'not-found', tried: host }));
    },
    [apply],
  );

  return { state, searchAgain, connectTo };
}
