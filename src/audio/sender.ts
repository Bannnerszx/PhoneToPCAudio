// Finding and addressing the PCAudio app on the PC (pc-sender/).

export const SENDER_PORT = 8765;

export type FoundPC = { host: string; name: string };

// A PC on the same network answers in milliseconds; the margin is for the
// iPhone's Wi-Fi power saving.
const PROBE_TIMEOUT_MS = 1000;
const SCAN_CONCURRENCY = 64;

// Accepts "192.168.1.20" or "192.168.1.20:9000".
export function streamUrl(host: string) {
  return host.includes(':') ? `ws://${host}` : `ws://${host}:${SENDER_PORT}`;
}

// Resolves with the PC's name if a PCAudio sender answers at `host`.
export function probe(host: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<FoundPC | null> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${streamUrl(host)}/probe`);
    let done = false;
    const finish = (result: FoundPC | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ws.close();
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        finish(message.type === 'hello' && message.app === 'pcaudio' ? { host, name: message.name } : null);
      } catch {
        finish(null);
      }
    };
    ws.onerror = () => finish(null);
    ws.onclose = () => finish(null);
  });
}

// Probes every address on the phone's subnet (assumes a /24, like nearly all home
// networks), nearest addresses first, and resolves with the first PC that answers.
export function scanSubnet(ownIp: string): Promise<FoundPC | null> {
  const parts = ownIp.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN) || ownIp === '0.0.0.0') {
    return Promise.resolve(null);
  }
  const prefix = parts.slice(0, 3).join('.');
  const hosts = Array.from({ length: 254 }, (_, i) => i + 1)
    .filter((last) => last !== parts[3])
    .sort((a, b) => Math.abs(a - parts[3]) - Math.abs(b - parts[3]))
    .map((last) => `${prefix}.${last}`);

  return new Promise((resolve) => {
    let next = 0;
    let active = 0;
    let found = false;
    const launch = () => {
      while (!found && active < SCAN_CONCURRENCY && next < hosts.length) {
        active++;
        void probe(hosts[next++]).then((pc) => {
          active--;
          if (found) return;
          if (pc) {
            found = true;
            resolve(pc);
          } else if (next >= hosts.length && active === 0) {
            resolve(null);
          } else {
            launch();
          }
        });
      }
    };
    launch();
  });
}

// Tries the last known address first (instant on the usual reconnect), then scans.
export async function findPC(lastHost: string, ownIp: string): Promise<FoundPC | null> {
  if (lastHost) {
    const pc = await probe(lastHost);
    if (pc) return pc;
  }
  return scanSubnet(ownIp);
}
