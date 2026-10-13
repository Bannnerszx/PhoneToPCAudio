// Plays the PCM stream from pc-sender/sender.py.
//
// Runs on any Web Audio API implementation: the web view's AudioContext (Expo Go)
// or react-native-audio-api's (native build). Each 10 ms chunk becomes its own
// AudioBuffer, scheduled sample-accurately right after the previous one.

export type PlayerState = 'idle' | 'connecting' | 'buffering' | 'playing';

export type PlayerStats = {
  state: PlayerState;
  bufferedMs: number;
  underruns: number;
  dropped: number;
  error?: string;
};

export type StreamPlayer = {
  start(): void;
  stop(): void;
  setTargetLatency(ms: number): void;
};

// The subset of the Web Audio API this file uses.
type AudioBufferLike = {
  copyToChannel(source: Float32Array<ArrayBuffer>, channelNumber: number): void;
};

type AudioBufferSourceLike = {
  buffer: AudioBufferLike | null;
  connect(destination: never): unknown;
  start(when?: number): void;
};

export type AudioContextLike = {
  readonly currentTime: number;
  readonly state?: string;
  readonly destination: unknown;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): AudioBufferSourceLike;
  resume(): Promise<unknown>;
  close(): Promise<unknown>;
};

type StreamFormat = { sampleRate: number; channels: number };

type Options = {
  url: string;
  targetLatencyMs: number;
  // Called synchronously from start(), so a browser still sees the user gesture.
  createContext: () => AudioContextLike;
  onStats: (stats: PlayerStats) => void;
};

// Above target + HARD_EXTRA, chunks are dropped right away.
const HARD_EXTRA_S = 0.08;
// Above target + SOFT_EXTRA for a full second, one chunk is dropped (slow catch-up
// after a Wi-Fi burst, and correction for PC/phone clock drift).
const SOFT_EXTRA_S = 0.02;
const SOFT_WINDOW_S = 1;
const STATS_INTERVAL_MS = 500;
// Windows Firewall silently drops connections to a closed port, so a connect
// attempt can hang instead of failing.
const CONNECT_TIMEOUT_MS = 3000;
// The sender streams silence when the PC is quiet, so a silent socket is a dead one.
const STALL_TIMEOUT_MS = 2000;
const MAX_RETRY_MS = 2000;

export const IDLE_STATS: PlayerStats = { state: 'idle', bufferedMs: 0, underruns: 0, dropped: 0 };

export function createStreamPlayer(options: Options): StreamPlayer {
  let ctx: AudioContextLike | null = null;
  let socket: WebSocket | null = null;
  let running = false;
  let format: StreamFormat | null = null;
  let target = options.targetLatencyMs / 1000;
  let nextTime = 0;
  let aboveSince = -1;
  let state: PlayerState = 'idle';
  let error: string | undefined;
  let underruns = 0;
  let dropped = 0;
  let retryMs = 500;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let statsTimer: ReturnType<typeof setInterval> | undefined;
  let lastMessageAt = 0;

  function emit() {
    const bufferedMs = ctx && state === 'playing' ? Math.max(0, (nextTime - ctx.currentTime) * 1000) : 0;
    options.onStats({ state, bufferedMs: Math.round(bufferedMs), underruns, dropped, error });
  }

  function setState(next: PlayerState) {
    state = next;
    emit();
  }

  function tick() {
    if (socket?.readyState === WebSocket.OPEN && Date.now() - lastMessageAt > STALL_TIMEOUT_MS) {
      dropSocket(socket, 'Lost connection to the PC');
    }
    // iOS suspends the context while something else holds the audio session, e.g.
    // the microphone in Expo Go (record-only). Pick up again once it's released.
    if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
      ctx.resume().catch(() => {});
    }
    emit();
  }

  function connect() {
    setState('connecting');
    const ws = new WebSocket(options.url);
    ws.binaryType = 'arraybuffer';
    const openTimer = setTimeout(() => dropSocket(ws, "Can't reach your PC"), CONNECT_TIMEOUT_MS);
    ws.onopen = () => {
      clearTimeout(openTimer);
      lastMessageAt = Date.now();
      retryMs = 500;
      error = undefined;
      setState('buffering');
    };
    ws.onmessage = (event) => {
      lastMessageAt = Date.now();
      if (typeof event.data === 'string') handleControl(event.data);
      else handleAudio(event.data as ArrayBuffer);
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
    format = null;
    ws.close();
    if (!running) return;
    error ??= reason;
    setState('connecting');
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }

  function handleControl(text: string) {
    const message = JSON.parse(text);
    if (message.type !== 'format' || message.encoding !== 's16le') return;
    format = { sampleRate: message.sampleRate, channels: message.channels };
    nextTime = 0;
    setState('buffering');
  }

  function handleAudio(data: ArrayBuffer) {
    if (!ctx || !format) return;
    const { sampleRate, channels } = format;
    const samples = new Int16Array(data);
    const frames = Math.floor(samples.length / channels);
    if (frames === 0) return;

    const now = ctx.currentTime;
    const ahead = nextTime - now;
    if (ahead < 0) {
      // Ran dry (or first chunk): start again one target-latency from now.
      if (state === 'playing') underruns++;
      nextTime = now + target;
      aboveSince = -1;
    } else if (ahead > target + HARD_EXTRA_S) {
      dropped++;
      return;
    } else if (ahead > target + SOFT_EXTRA_S) {
      if (aboveSince < 0) aboveSince = now;
      else if (now - aboveSince > SOFT_WINDOW_S) {
        aboveSince = now;
        dropped++;
        return;
      }
    } else {
      aboveSince = -1;
    }

    const buffer = ctx.createBuffer(channels, frames, sampleRate);
    const channel = new Float32Array(frames);
    for (let c = 0; c < channels; c++) {
      for (let i = 0; i < frames; i++) channel[i] = samples[i * channels + c] / 32768;
      buffer.copyToChannel(channel, c);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination as never);
    source.start(nextTime);
    nextTime += frames / sampleRate;

    if (state !== 'playing') setState('playing');
  }

  return {
    start() {
      if (running) return;
      running = true;
      underruns = 0;
      dropped = 0;
      error = undefined;
      ctx = options.createContext();
      void ctx.resume();
      statsTimer = setInterval(tick, STATS_INTERVAL_MS);
      connect();
    },

    stop() {
      running = false;
      clearTimeout(retryTimer);
      clearInterval(statsTimer);
      const ws = socket;
      socket = null;
      ws?.close();
      void ctx?.close();
      ctx = null;
      format = null;
      setState('idle');
    },

    setTargetLatency(ms) {
      const next = ms / 1000;
      // Raising the target takes effect now (adds a short gap); lowering it is
      // absorbed by the catch-up logic above.
      if (ctx && state === 'playing' && next > target) nextTime += next - target;
      target = next;
    },
  };
}

export function describeStats(stats: PlayerStats): string {
  switch (stats.state) {
    case 'idle':
      return 'Stopped';
    case 'connecting':
      return stats.error ? `${stats.error}. Retrying…` : 'Connecting…';
    case 'buffering':
      return 'Connected, waiting for audio…';
    case 'playing':
      return `Playing · buffer ${stats.bufferedMs} ms · ${stats.underruns} dropouts · ${stats.dropped} skips`;
  }
}
