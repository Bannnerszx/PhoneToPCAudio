import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';

import { createExpoGoCapture } from '@/audio/expo-go-capture';
import { createMicSender, IDLE_MIC, type MicSender, type MicStats } from '@/audio/mic-sender';
import type { MicProps } from '@/components/mic';
import MicControls, { NO_PERMISSION } from '@/components/mic-controls';

// Expo Go microphone. Stops when the phone locks, so the screen stays on while it's
// on, and Play goes quiet while it records. The built app (native-mic.tsx) has
// neither limit.
export default function ExpoGoMic({ url }: MicProps) {
  const [stats, setStats] = useState<MicStats>(IDLE_MIC);
  const [sender] = useState<MicSender>(() =>
    createMicSender({ url, capture: createExpoGoCapture(), onStats: setStats }),
  );
  const on = stats.state !== 'idle';

  async function start() {
    if (!(await requestRecordingPermissionsAsync()).granted) {
      setStats({ state: 'idle', error: NO_PERMISSION });
      return;
    }
    sender.start();
  }

  useEffect(() => () => sender.stop(), [sender]);

  return (
    <>
      {on && <KeepScreenOn />}
      <MicControls stats={stats} onStart={() => void start()} onStop={() => sender.stop()} />
    </>
  );
}

// Its own tag, so it doesn't release the player's keep-awake (or the other way round).
function KeepScreenOn() {
  useKeepAwake('microphone');
  return null;
}
