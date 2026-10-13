// Expo Go microphone capture with expo-audio, which Expo Go includes. expo-audio is
// left out of builds (package.json, expo.autolinking.exclude), so only Expo Go loads this.
//
// While it records, expo-audio switches iOS to record-only audio, so Play goes quiet.
// It delivers about 100 ms per chunk; the PC buffers accordingly.
import { requireNativeModule } from 'expo';
import { setAudioModeAsync, type AudioStream } from 'expo-audio';

import type { MicCapture } from '@/audio/mic-sender';

// useAudioStream() fixes the sample rate before the PC has said which one it needs,
// so the stream is created directly, the same way the hook does it.
const ExpoAudio = requireNativeModule<{ AudioStream: typeof AudioStream }>('ExpoAudio');

export function createExpoGoCapture(): MicCapture {
  let stream: AudioStream | null = null;

  function stop() {
    const current = stream;
    stream = null;
    if (!current) return;
    current.stop();
    current.release();
    // Stopping leaves iOS in record-only mode, which would keep Play silent.
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'mixWithOthers' });
  }

  return {
    start(sampleRate, onChunk, onError) {
      stop();
      const current = new ExpoAudio.AudioStream({ sampleRate, channels: 1, encoding: 'int16' });
      current.addListener('audioStreamBuffer', (buffer) => onChunk(buffer.data, buffer.sampleRate));
      stream = current;
      current.start().catch((error: unknown) => {
        if (stream === current) onError(error instanceof Error ? error.message : String(error));
      });
    },
    stop,
  };
}
