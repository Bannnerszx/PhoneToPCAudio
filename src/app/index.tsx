import { useKeepAwake } from 'expo-keep-awake';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { streamUrl, type FoundPC } from '@/audio/sender';
import Player, { isExpoGo } from '@/components/player';
import { Button, Card, SectionFooter, SectionHeader, StepButton, usePalette } from '@/components/ui';
import { usePCSearch } from '@/hooks/use-pc-search';
import { MAX_LATENCY_MS, MIN_LATENCY_MS, type Settings, useSettings } from '@/hooks/use-settings';

const LATENCY_STEP_MS = 10;

export default function HomeScreen() {
  const { settings, loaded, update } = useSettings();
  if (!loaded) return null;
  return <Home settings={settings} update={update} />;
}

type HomeProps = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};

function Home({ settings, update }: HomeProps) {
  const palette = usePalette();
  const [playing, setPlaying] = useState(false);
  const remember = useCallback((host: string) => update({ host }), [update]);
  const { state, searchAgain, connectTo } = usePCSearch(settings.host, remember);

  // Searching again replaces the player, which ends playback.
  function restart(search: () => void) {
    setPlaying(false);
    search();
  }

  function changeLatency(delta: number) {
    const latencyMs = Math.min(MAX_LATENCY_MS, Math.max(MIN_LATENCY_MS, settings.latencyMs + delta));
    update({ latencyMs });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {isExpoGo && playing && state.status === 'found' && <KeepScreenOn />}

      {state.status === 'searching' && (
        <Card style={styles.searching}>
          <ActivityIndicator />
          <Text style={[styles.body, { color: palette.secondaryText }]}>Looking for your PC…</Text>
        </Card>
      )}

      {state.status === 'found' && (
        <>
          <PlayerCard
            pc={state.pc}
            latencyMs={settings.latencyMs}
            onPlayingChange={async (value) => setPlaying(value)}
          />
          <SectionFooter>
            {isExpoGo
              ? 'Keep this screen open while you listen. In Expo Go, the sound stops when the phone locks.'
              : 'Keeps playing when you lock your iPhone or switch apps.'}
          </SectionFooter>
          <Button variant="plain" label="Not your PC? Search again" onPress={() => restart(searchAgain)} />
        </>
      )}

      {state.status === 'no-wifi' && (
        <Card>
          <Text style={[styles.title, { color: palette.text }]}>Connect to Wi‑Fi</Text>
          <Text style={[styles.body, { color: palette.secondaryText }]}>
            Your iPhone needs to be on the same Wi‑Fi as your PC.
          </Text>
          <Button label="Try again" onPress={() => restart(searchAgain)} />
        </Card>
      )}

      {state.status === 'not-found' && (
        <>
          <Card>
            <Text style={[styles.title, { color: palette.text }]}>
              {state.tried ? `Nothing answered at ${state.tried}` : "Can't find your PC"}
            </Text>
            <Text style={[styles.body, { color: palette.secondaryText }]}>
              1. On your PC, open PCAudio. Its speaker icon appears next to the clock.
            </Text>
            <Text style={[styles.body, { color: palette.secondaryText }]}>
              2. Make sure your iPhone and PC are on the same Wi‑Fi.
            </Text>
            <Button label="Search again" onPress={() => restart(searchAgain)} />
          </Card>
          <AddressEntry initialHost={state.tried ?? settings.host} onSubmit={connectTo} />
        </>
      )}

      <SectionHeader>Delay</SectionHeader>
      <Card style={styles.stepper}>
        <StepButton label="−" onPress={() => changeLatency(-LATENCY_STEP_MS)} />
        <Text style={[styles.latency, { color: palette.text }]}>{settings.latencyMs} ms</Text>
        <StepButton label="+" onPress={() => changeLatency(LATENCY_STEP_MS)} />
      </Card>
      <SectionFooter>Lower means less delay. If the sound cuts out, raise it.</SectionFooter>
    </ScrollView>
  );
}

type PlayerCardProps = {
  pc: FoundPC;
  latencyMs: number;
  onPlayingChange: (playing: boolean) => Promise<void>;
};

function PlayerCard({ pc, latencyMs, onPlayingChange }: PlayerCardProps) {
  const palette = usePalette();
  const url = streamUrl(pc.host);
  return (
    <Card>
      <Text style={[styles.label, { color: palette.secondaryText }]}>YOUR PC</Text>
      <Text style={[styles.pcName, { color: palette.text }]}>{pc.name}</Text>
      <View style={styles.player}>
        <Player
          key={url}
          url={url}
          pcName={pc.name}
          targetLatencyMs={latencyMs}
          onPlayingChange={onPlayingChange}
        />
      </View>
    </Card>
  );
}

function AddressEntry({ initialHost, onSubmit }: { initialHost: string; onSubmit: (host: string) => void }) {
  const palette = usePalette();
  const [host, setHost] = useState(initialHost);
  return (
    <>
      <SectionHeader>Or type your PC&apos;s address</SectionHeader>
      <Card style={styles.inputCard}>
        <TextInput
          style={[styles.input, { color: palette.text }]}
          value={host}
          onChangeText={setHost}
          onSubmitEditing={() => host.trim() && onSubmit(host.trim())}
          placeholder="192.168.1.20"
          placeholderTextColor={palette.secondaryText}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
        />
      </Card>
      <SectionFooter>Right-click the PCAudio icon next to your PC&apos;s clock to see its address.</SectionFooter>
    </>
  );
}

function KeepScreenOn() {
  useKeepAwake();
  return null;
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  searching: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
  },
  pcName: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 2,
  },
  player: {
    marginTop: 16,
  },
  inputCard: {
    paddingVertical: 0,
  },
  input: {
    fontSize: 17,
    paddingVertical: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  latency: {
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
});
