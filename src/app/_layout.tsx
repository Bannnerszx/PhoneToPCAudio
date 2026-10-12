import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { colors } from '@/theme';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const base = dark ? DarkTheme : DefaultTheme;
  const palette = dark ? colors.dark : colors.light;
  const theme = {
    ...base,
    colors: { ...base.colors, background: palette.background, card: palette.background, primary: palette.accent },
  };

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerLargeTitle: true, headerShadowVisible: false }}>
        <Stack.Screen name="index" options={{ title: 'PC Audio' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
