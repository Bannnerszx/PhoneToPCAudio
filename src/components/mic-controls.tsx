import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { describeMic, type MicStats } from '@/audio/mic-sender';
import { usePalette } from '@/components/ui';

export const NO_PERMISSION = 'PCAudio isn’t allowed to use the microphone';

type Props = {
  stats: MicStats;
  onStart: () => void;
  onStop: () => void;
};

// The microphone's on/off button and status, shared by the build and Expo Go.
export default function MicControls({ stats, onStart, onStop }: Props) {
  const palette = usePalette();
  const on = stats.state !== 'idle';
  return (
    <View>
      <Pressable
        onPress={on ? onStop : onStart}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: on ? palette.danger : palette.accent },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.label}>{on ? 'Turn off microphone' : 'Use as microphone'}</Text>
      </Pressable>
      <Text style={[styles.status, { color: palette.secondaryText }]}>{describeMic(stats)}</Text>
      {stats.error === NO_PERMISSION && (
        <Text style={[styles.link, { color: palette.accent }]} onPress={() => void Linking.openSettings()}>
          Open Settings
        </Text>
      )}
    </View>
  );
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
  link: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
});
