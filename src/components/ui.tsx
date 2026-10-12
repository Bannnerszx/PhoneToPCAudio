import { Pressable, StyleSheet, Text, useColorScheme, View, type ViewProps } from 'react-native';

import { colors, type Palette } from '@/theme';

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}

export function SectionHeader({ children }: { children: string }) {
  const palette = usePalette();
  return <Text style={[styles.header, { color: palette.secondaryText }]}>{children.toUpperCase()}</Text>;
}

export function SectionFooter({ children }: { children: string }) {
  const palette = usePalette();
  return <Text style={[styles.footer, { color: palette.secondaryText }]}>{children}</Text>;
}

export function Card({ style, ...props }: ViewProps) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.card }, style]} {...props} />;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'plain';
};

export function Button({ label, onPress, variant = 'filled' }: ButtonProps) {
  const palette = usePalette();
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        filled ? styles.filled : styles.plain,
        filled && { backgroundColor: palette.accent },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: filled ? '#fff' : palette.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.stepButton, { backgroundColor: palette.background }, pressed && styles.pressed]}
    >
      <Text style={[styles.stepLabel, { color: palette.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 13,
    marginTop: 24,
    marginBottom: 6,
    marginHorizontal: 16,
  },
  footer: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginHorizontal: 16,
  },
  card: {
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 16,
  },
  filled: {
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 14,
    alignItems: 'center',
  },
  plain: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  stepButton: {
    width: 44,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 22,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});
