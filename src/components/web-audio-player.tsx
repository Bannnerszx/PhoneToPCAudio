'use dom';

import { useEffect, useRef, useState } from 'react';

import {
  createStreamPlayer,
  describeStats,
  IDLE_STATS,
  type PlayerStats,
  type StreamPlayer,
} from '@/audio/stream-player';
import { colors } from '@/theme';

type Props = {
  url: string;
  targetLatencyMs: number;
  onPlayingChange: (playing: boolean) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

// Expo Go player: Web Audio inside a web view. Audio stops when the app leaves the
// foreground or the phone locks. Render it with key={url}: a new PC address gets a
// fresh web view, which ends the old stream.
export default function WebAudioPlayer({ url, targetLatencyMs, onPlayingChange }: Props) {
  const playerRef = useRef<StreamPlayer | null>(null);
  const [stats, setStats] = useState<PlayerStats>(IDLE_STATS);
  const playing = stats.state !== 'idle';

  useEffect(() => {
    playerRef.current?.setTargetLatency(targetLatencyMs);
  }, [targetLatencyMs]);

  function play() {
    // Treat Web Audio as media playback so the silent switch doesn't mute it (iOS 17+).
    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession) nav.audioSession.type = 'playback';

    const player = createStreamPlayer({
      url,
      targetLatencyMs,
      createContext: createUnlockedContext,
      onStats: setStats,
    });
    playerRef.current = player;
    player.start();
    void onPlayingChange(true);
  }

  function stop() {
    if (!playerRef.current) return;
    playerRef.current.stop();
    playerRef.current = null;
    void onPlayingChange(false);
  }

  return (
    <div className="player">
      <style>{css}</style>
      <button className={playing ? 'stop' : 'play'} onClick={playing ? stop : play}>
        {playing ? 'Stop' : 'Play'}
      </button>
      <p>{describeStats(stats)}</p>
    </div>
  );
}

// Must run inside the tap handler. Playing a one-sample buffer during the gesture is
// what unlocks audio output on iOS WebKit.
function createUnlockedContext() {
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  const silence = ctx.createBufferSource();
  silence.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  silence.connect(ctx.destination);
  silence.start();
  return ctx;
}

const css = `
  html, body { margin: 0; background: transparent; }
  .player {
    font: 15px -apple-system, system-ui, sans-serif;
    color: ${colors.light.secondaryText};
    text-align: center;
    padding: 4px 0;
    -webkit-user-select: none;
    user-select: none;
  }
  button {
    width: 100%;
    border: 0;
    border-radius: 14px;
    padding: 16px;
    font: 600 18px -apple-system, system-ui, sans-serif;
    color: #fff;
    -webkit-tap-highlight-color: transparent;
  }
  button:active { opacity: 0.7; }
  .play { background: ${colors.light.accent}; }
  .stop { background: ${colors.light.danger}; }
  p { margin: 12px 0 0; min-height: 1.3em; }
  @media (prefers-color-scheme: dark) {
    .player { color: ${colors.dark.secondaryText}; }
    .play { background: ${colors.dark.accent}; }
    .stop { background: ${colors.dark.danger}; }
  }
`;
