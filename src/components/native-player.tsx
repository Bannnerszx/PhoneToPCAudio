import { useEffect, useEffectEvent, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AudioContext, AudioManager, PlaybackNotificationManager } from 'react-native-audio-api';

import {
  createStreamPlayer,
  describeStats,
  IDLE_STATS,
  type PlayerStats,
  type StreamPlayer,
} from '@/audio/stream-player';
import type { PlayerProps } from '@/components/player';
import { usePalette } from '@/components/ui';

// Built-app player: native audio with a "playback" audio session, so it keeps
// playing with the phone locked or another app open (the app.json plugin adds the
// "audio" background mode). Not available in Expo Go.
export default function NativePlayer({ url, pcName, targetLatencyMs, onPlayingChange }: PlayerProps) {
  const palette = usePalette();
  const [stats, setStats] = useState<PlayerStats>(IDLE_STATS);
  const [player] = useState<StreamPlayer>(() =>
    createStreamPlayer({
      url,
      targetLatencyMs,
      // Matching the stream's rate means iOS resamples (if at all) once, at the output.
      createContext: () => new AudioContext({ sampleRate: 48000 }),
      onStats: setStats,
    }),
  );
  const playing = stats.state !== 'idle';

  async function play() {
    // Must happen before the AudioContext is created. "playback" ignores the silent
    // switch and is what lets audio continue in the background.
    AudioManager.setAudioSessionOptions({ iosCategory: 'playback', iosMode: 'default', iosOptions: [] });
    await activateSession();
    player.start();
    void onPlayingChange(true);
    await showNowPlaying('playing');
  }

  function stop() {
    player.stop();
    void onPlayingChange(false);
    void showNowPlaying('paused');
    void AudioManager.setAudioSessionActivity(false).catch(() => {});
  }

  // The lock screen entry is a nicety; playback works without it.
  async function showNowPlaying(state: 'playing' | 'paused') {
    try {
      await PlaybackNotificationManager.show({ title: pcName, artist: 'PCAudio', state });
      await PlaybackNotificationManager.enableControl('play', true);
      await PlaybackNotificationManager.enableControl('pause', true);
    } catch (error) {
      console.warn('Lock screen controls unavailable', error);
    }
  }

  useEffect(() => {
    player.setTargetLatency(targetLatencyMs);
  }, [player, targetLatencyMs]);

  // Lock screen / Control Center buttons, and resuming after a call or Siri.
  const onRemotePlay = useEffectEvent(() => {
    if (!playing) void play();
  });
  const onRemotePause = useEffectEvent(() => {
    if (playing) stop();
  });
  const onInterruptionEnded = useEffectEvent(async () => {
    if (!playing) return;
    await activateSession();
    player.stop();
    player.start();
  });

  useEffect(() => {
    AudioManager.observeAudioInterruptions(true);
    const subscriptions = [
      PlaybackNotificationManager.addEventListener('playbackNotificationPlay', () => onRemotePlay()),
      PlaybackNotificationManager.addEventListener('playbackNotificationPause', () => onRemotePause()),
      AudioManager.addSystemEventListener('interruption', (event) => {
        if (event.type === 'ended') onInterruptionEnded();
      }),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription?.remove());
      player.stop();
      void PlaybackNotificationManager.hide().catch(() => {});
      void AudioManager.setAudioSessionActivity(false).catch(() => {});
    };
  }, [player]);

  return (
    <View>
      <Pressable
        onPress={playing ? stop : () => void play()}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: playing ? palette.danger : palette.accent },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.label}>{playing ? 'Stop' : 'Play'}</Text>
      </Pressable>
      <Text style={[styles.status, { color: palette.secondaryText }]}>{describeStats(stats)}</Text>
    </View>
  );
}

async function activateSession() {
  try {
    await AudioManager.setAudioSessionActivity(true);
  } catch (error) {
    // Another app holding audio exclusively; the context may still start.
    console.warn('Audio session activation failed', error);
  }
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 16,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  status: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
  },
});
