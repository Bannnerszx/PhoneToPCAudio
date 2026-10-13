// The iOS audio session, shared by the native player and the microphone. Built app only.
//
// The player alone uses "playback": full-quality sound that ignores the silent switch and
// keeps going in the background. While the microphone is on, the session is
// "playAndRecord" in voice chat mode, whose echo cancellation keeps the PC's sound
// (playing on the phone's speaker) out of the microphone.
import { AudioManager } from 'react-native-audio-api';

type User = 'player' | 'mic';

const users = new Set<User>();
const changeListeners = new Set<() => void>();

// Turns the session on for `user`, or off once nobody needs it.
export async function setAudioActive(user: User, active: boolean) {
  const hadMic = users.has('mic');
  if (active) users.add(user);
  else users.delete(user);

  if (users.size === 0) {
    await AudioManager.setAudioSessionActivity(false).catch(() => {});
    return;
  }
  // Must happen before an AudioContext or recorder starts.
  AudioManager.setAudioSessionOptions(
    users.has('mic')
      ? { iosCategory: 'playAndRecord', iosMode: 'voiceChat', iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'] }
      : { iosCategory: 'playback', iosMode: 'default', iosOptions: [] },
  );
  await activate();
  if (users.has('mic') !== hadMic) changeListeners.forEach((listener) => listener());
}

// Re-activates the session, e.g. after a phone call ended.
export async function activate() {
  try {
    await AudioManager.setAudioSessionActivity(true);
  } catch (error) {
    // Another app holding audio exclusively; the context may still start.
    console.warn('Audio session activation failed', error);
  }
}

// Called after the session switches between playback and microphone modes, which
// can leave audio that's already running stalled.
export function addSessionChangeListener(listener: () => void) {
  changeListeners.add(listener);
  return { remove: () => changeListeners.delete(listener) };
}
