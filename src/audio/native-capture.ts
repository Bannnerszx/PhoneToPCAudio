// Built-app microphone capture with react-native-audio-api. Not available in Expo Go.
import { AudioRecorder } from 'react-native-audio-api';

import type { MicCapture } from '@/audio/mic-sender';

const CHUNK_MS = 10;

export function createNativeCapture(): MicCapture {
  let recorder: AudioRecorder | null = null;

  function stop() {
    const rec = recorder;
    recorder = null;
    if (!rec) return;
    rec.clearOnAudioReady();
    rec.clearOnError();
    void rec.stop();
  }

  return {
    start(sampleRate, onChunk, onError) {
      stop();
      const rec = new AudioRecorder();
      const result = rec.onAudioReady(
        { sampleRate, bufferLength: (sampleRate * CHUNK_MS) / 1000, channelCount: 1 },
        ({ buffer }) => onChunk(toInt16(buffer.getChannelData(0)).buffer, buffer.sampleRate),
      );
      if (result.status === 'error') {
        onError(result.message);
        return;
      }
      rec.onError((event) => onError(event.message));
      recorder = rec;
      void rec.start().then((started) => {
        if (started.status === 'error') onError(started.message);
      });
    },
    stop,
  };
}

function toInt16(samples: Float32Array) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767);
  }
  return out;
}
