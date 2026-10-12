import Constants, { ExecutionEnvironment } from 'expo-constants';
import { lazy, Suspense } from 'react';

import WebAudioPlayer from '@/components/web-audio-player';

export type PlayerProps = {
  url: string;
  pcName: string;
  targetLatencyMs: number;
  onPlayingChange: (playing: boolean) => Promise<void>;
};

// Expo Go has no react-native-audio-api, so it plays through the web view instead
// (and stops when the phone locks). The native player is loaded only in a build.
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const NativePlayer = lazy(() => import('@/components/native-player'));

// Render with key={url}: each PC address gets a fresh player.
export default function Player({ pcName, ...props }: PlayerProps) {
  if (isExpoGo) {
    return (
      <WebAudioPlayer
        {...props}
        dom={{
          matchContents: true,
          scrollEnabled: false,
          mediaPlaybackRequiresUserAction: false,
          style: { backgroundColor: 'transparent' },
        }}
      />
    );
  }
  return (
    <Suspense fallback={null}>
      <NativePlayer pcName={pcName} {...props} />
    </Suspense>
  );
}
