import { lazy, Suspense } from 'react';

import { isExpoGo } from '@/components/player';

export type MicProps = {
  // The sender's address, e.g. ws://192.168.1.20:8765.
  url: string;
};

// Each is loaded only where its audio library exists: react-native-audio-api in a
// build, expo-audio in Expo Go.
const NativeMic = lazy(() => import('@/components/native-mic'));
const ExpoGoMic = lazy(() => import('@/components/expo-go-mic'));

// Render with key={url}: each PC address gets a fresh microphone.
export default function Mic(props: MicProps) {
  return <Suspense fallback={null}>{isExpoGo ? <ExpoGoMic {...props} /> : <NativeMic {...props} />}</Suspense>;
}
