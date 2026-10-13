// Sends the iPhone's microphone to the PC (pc-sender/mic.py).
//
// Connects to /mic; the PC answers with the sample rate its output device runs at,
// and the capture is asked for that rate. Audio is sent as 16-bit mono PCM, with a
// format message first so the PC can resample if the capture used another rate.

export type MicState = 'idle' | 'connecting' | 'live';

export type MicStats = {
  state: MicState;
  // The PC device the microphone plays on.
  device?: string;
  error?: string;
};

export type MicSender = {
  start(): void;
  stop(): void;
};

// Records the microphone: react-native-audio-api in a build (native-capture.ts),
// expo-audio in Expo Go (expo-go-mic.tsx).
export type MicCapture = {
  start(
    sampleRate: number,
    onChunk: (pcm: ArrayBuffer, sampleRate: number) => void,
    onError: (message: string) => void,
  ): void;
  stop(): void;
};

type Options = {
  // The sender's address, e.g. ws://192.168.1.20:8765.
  url: string;
  capture: MicCapture;
  onStats: (stats: MicStats) => void;
};

// Windows Firewall silently drops connections to a closed port, so a connect
// attempt can hang instead of failing.
const CONNECT_TIMEOUT_MS = 3000;
const MAX_RETRY_MS = 2000;

export const IDLE_MIC: MicStats = { state: 'idle' };

export function createMicSender({ url, capture, onStats }: Options): MicSender {
  let socket: WebSocket | null = null;
  let capturing = false;
  let running = false;
  let state: MicState = 'idle';
  let device: string | undefined;
  let error: string | undefined;
  let retryMs = 500;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function setState(next: MicState) {
    state = next;
    onStats({ state, device, error });
  }

  function connect() {
    setState('connecting');
    const ws = new WebSocket(`${url}/mic`);
    const openTimer = setTimeout(() => dropSocket(ws, "Can't reach your PC"), CONNECT_TIMEOUT_MS);
    ws.onopen = () => clearTimeout(openTimer);
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const message = JSON.parse(event.data);
      if (message.type === 'mic-ready') startCapture(ws, message.sampleRate, message.device);
      else if (message.type === 'error') error = message.message;
    };
    ws.onclose = () => {
      clearTimeout(openTimer);
      dropSocket(ws, 'Lost connection to the PC');
    };
    ws.onerror = () => {
      error = "Can't reach your PC";
    };
    socket = ws;
  }

  // Closes `ws` if it is still the current socket and schedules a reconnect.
  function dropSocket(ws: WebSocket, reason: string) {
    if (socket !== ws) return;
    socket = null;
    stopCapture();
    ws.close();
    if (!running) return;
    error ??= reason;
    setState('connecting');
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }

  function startCapture(ws: WebSocket, sampleRate: number, deviceName: string) {
    stopCapture();
    let sentRate = 0;
    capturing = true;
    capture.start(
      sampleRate,
      (pcm, rate) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (rate !== sentRate) {
          sentRate = rate;
          ws.send(JSON.stringify({ type: 'format', sampleRate: rate, channels: 1, encoding: 's16le' }));
        }
        ws.send(pcm);
      },
      fail,
    );
    // The capture can fail right away, e.g. with the microphone in use.
    if (!running) return;
    device = deviceName;
    error = undefined;
    retryMs = 500;
    setState('live');
  }

  function stopCapture() {
    if (!capturing) return;
    capturing = false;
    capture.stop();
  }

  // The microphone itself failed (not the network): retrying won't help.
  function fail(message: string) {
    if (!running) return;
    stop();
    error = message;
    setState('idle');
  }

  function stop() {
    running = false;
    clearTimeout(retryTimer);
    stopCapture();
    const ws = socket;
    socket = null;
    ws?.close();
    device = undefined;
    setState('idle');
  }

  return {
    start() {
      if (running) return;
      running = true;
      error = undefined;
      retryMs = 500;
      connect();
    },
    stop,
  };
}

export function describeMic(stats: MicStats): string {
  switch (stats.state) {
    case 'idle':
      return stats.error ?? 'Off';
    case 'connecting':
      return stats.error ? `${stats.error}. Retrying…` : 'Connecting…';
    case 'live':
      return `On · playing on ${stats.device}`;
  }
}
