# Developing PCAudio

PCAudio has two parts:

- **The PC app** (`pc-sender/`): a Windows tray app (Python, packaged with PyInstaller and Inno Setup).
  It captures the sound Windows is playing (WASAPI loopback) and streams it as uncompressed audio
  over a WebSocket on port 8765. It also plays the iPhone's microphone (`pc-sender/mic.py`).
- **The iPhone app** (Expo SDK 57 / React Native, Expo Router in `src/app/`): finds the PC on the
  Wi‑Fi and plays the stream with a small, adjustable buffer, and can send its microphone to the PC.

Everything is built from Windows. No Mac is needed: iOS builds run on GitHub Actions.

## Releasing

Push a version tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Both workflows run for the tag:

- **Windows PC app** builds `PCAudioSetup.exe`.
- **iOS unsigned IPA** builds `PCAudio.ipa`.

Each one attaches its file to the GitHub release for that tag, which the first one to finish creates.
The README's download links (`releases/latest/download/...`) always point to the newest release.

Pushes to `main` also run the builds, without releasing. The results are workflow artifacts that you
can only download while signed in to GitHub.

## The PC app

### Building

**On GitHub:** push to `main` (with changes in `pc-sender/`), or open **Actions → Windows PC app → Run
workflow**.

**Locally:** this builds `pc-sender\build\dist\PCAudio\PCAudio.exe`, and also
`pc-sender\build\PCAudioSetup.exe` if [Inno Setup 6](https://jrsoftware.org/isinfo.php) is
installed (`winget install JRSoftware.InnoSetup`).

```powershell
powershell -ExecutionPolicy Bypass -File pc-sender\build.ps1
```

What the installer sets up:
- **The app:** installed in Program Files, with a Start menu entry.
- **Start with Windows:** an entry under `HKCU\...\Run`, which you can turn off from the tray menu.
- **A Windows Firewall rule:** it lets phones connect without Windows asking. It only accepts
  devices on the local network, and it applies to every network profile because Windows often marks
  home Wi‑Fi as *Public*.
- **Uninstalling** removes all three.

### The console version

`pc-sender/sender.py` is the same streamer without the tray icon. It needs Python 3.10 or newer.

```bash
py -m pip install -r pc-sender/requirements.txt
py pc-sender/sender.py            # or double-click pc-sender/run-sender.bat
py pc-sender/sender.py --list     # other audio devices; pick one with --device N
py pc-sender/sender.py --port 9000
py pc-sender/sender.py --mic-device 7   # where the phone's microphone plays (see --list)
```

Running it from Python means Windows asks about the firewall the first time. Allow it for the network
type your Wi‑Fi uses.

## The iPhone app

### Developing in Expo Go

```bash
npm install
npx expo start          # scan the QR code with the iPhone Camera app
```

Expo Go can't load the native audio library, so in Expo Go the app plays through a web view
(`src/components/web-audio-player.tsx`):
- The sound stops when the phone locks or you leave the app. The app keeps the screen on while it plays.
- If you hear nothing with the silent switch on, turn the switch off.

`src/components/player.tsx` picks the web player in Expo Go, and the native one in a build.

The microphone records with `expo-audio` in Expo Go (`src/audio/expo-go-capture.ts`), and with
`react-native-audio-api` in a build (`src/audio/native-capture.ts`):
- While it records, `expo-audio` switches iOS to record-only audio, so **Play** goes quiet.
- It stops when the phone locks, so the app keeps the screen on while the mic is on.
- `expo-audio` is excluded from builds (`expo.autolinking.exclude` in `package.json`), so it can't
  change the audio session under the native player. Don't import it outside the Expo Go mic.

Checks before committing:

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

### The built app (`.ipa`)

The built app plays through native audio (`react-native-audio-api`, in
`src/components/native-player.tsx`):
- It uses a *playback* audio session and the *audio* background mode, so it keeps playing with the
  phone locked or another app open, and ignores the silent switch.
- It shows PCAudio on the lock screen with play/pause, and resumes after a call.

To build it, push to `main`, or open **Actions → iOS unsigned IPA → Run workflow**. A macOS runner
builds an unsigned `.ipa`, and AltStore Classic signs it with your Apple ID when you install it.

> macOS runners are free on public repos. On private repos, macOS minutes count 10x against your
> monthly free minutes.

## How it works

```
PC: WASAPI loopback ─► 16-bit PCM, 48 kHz stereo, 10 ms chunks ─► WebSocket :8765
                                                                        │ Wi‑Fi (≈1.5 Mbit/s)
iPhone: WebSocket ─► src/audio/stream-player.ts ─► each chunk scheduled right after the previous one
```

- **Finding the PC:** the app first tries the last address that worked. Otherwise it asks every
  address on the phone's Wi‑Fi (`/probe` on port 8765, 64 at a time, nearest first), and the PC
  app answers with its name. This takes a few seconds, and needs no Bonjour or other native code, so
  it works in Expo Go.
- **No codec:** the audio is uncompressed, so there's no encoding or decoding delay.
- **The buffer:** the player keeps about *Delay* ms of audio queued. If it runs dry (a "dropout"), it
  starts again at the target. If audio piles up after a Wi‑Fi hiccup, it skips 10 ms chunks until it's
  back at the target. That also corrects for the PC's and phone's clocks running at slightly
  different speeds.
- **Silence:** when nothing is playing, Windows delivers no audio at all, so the sender streams
  silence instead. That keeps the connection alive, keeps iOS treating the app as playing audio
  while locked, and lets the phone spot a dead link within 2 s and reconnect.
- **The microphone** (`src/audio/mic-sender.ts` → `pc-sender/mic.py`): the phone connects to `/mic`.
  The PC opens its output device ("CABLE Input" from VB-CABLE if installed, so apps can use
  "CABLE Output" as a mic; otherwise the default speakers) and replies with the device's sample rate,
  because Windows only accepts that rate. The phone records 10 ms mono chunks at it and sends them as
  16-bit PCM. The PC keeps about 60 ms buffered and drops the oldest audio beyond 120 ms. While the
  mic is on, the iOS session is `playAndRecord` in voice chat mode (`src/audio/session.ts`), whose
  echo cancellation keeps the PC's sound on the phone's speaker out of the mic.
- **Switching speakers:** Windows only reports a new default output device (headphones, monitor
  speakers…) to a newly opened capture. So whenever nothing has been captured for 3 s, the sender
  reopens it, which costs about 1% CPU while idle. After you switch devices mid-song, the phone is
  silent for about 3 s and then follows.
