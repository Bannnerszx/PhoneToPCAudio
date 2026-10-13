import { useEffect, useEffectEvent, useState } from 'react';
import { AudioManager } from 'react-native-audio-api';

import { createMicSender, IDLE_MIC, type MicSender, type MicStats } from '@/audio/mic-sender';
import { createNativeCapture } from '@/audio/native-capture';
import { activate, setAudioActive } from '@/audio/session';
import type { MicProps } from '@/components/mic';
import MicControls, { NO_PERMISSION } from '@/components/mic-controls';

// Built-app microphone: records with native audio and streams to the PC. Keeps
// going with the phone locked (the "audio" background mode). Not available in Expo Go.
export default function NativeMic({ url }: MicProps) {
  const [stats, setStats] = useState<MicStats>(IDLE_MIC);
  const [sender] = useState<MicSender>(() =>
    createMicSender({ url, capture: createNativeCapture(), onStats: setStats }),
  );
  const on = stats.state !== 'idle';

  async function start() {
    if ((await AudioManager.requestRecordingPermissions()) !== 'Granted') {
      setStats({ state: 'idle', error: NO_PERMISSION });
      return;
    }
    await setAudioActive('mic', true);
    sender.start();
  }

  function stop() {
    sender.stop();
    void setAudioActive('mic', false);
  }

  // A phone call or Siri stops the recorder; start again once it's over.
  const onInterruptionEnded = useEffectEvent(async () => {
    if (!on) return;
    await activate();
    sender.stop();
    sender.start();
  });

  useEffect(() => {
    AudioManager.observeAudioInterruptions(true);
    const subscription = AudioManager.addSystemEventListener('interruption', (event) => {
      if (event.type === 'ended') onInterruptionEnded();
    });
    return () => {
      subscription?.remove();
      sender.stop();
      void setAudioActive('mic', false);
    };
  }, [sender]);

  return <MicControls stats={stats} onStart={() => void start()} onStop={stop} />;
}
