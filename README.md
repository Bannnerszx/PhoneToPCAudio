# HelloApp: React Native (Expo) for iPhone, built from Windows

A minimal Expo app. You develop it on Windows and run it on an iPhone two ways:

1. **Expo Go**: the quick development loop. No Mac and no signing needed.
2. **A standalone app sideloaded with AltStore Classic**: GitHub Actions builds an unsigned `.ipa`
   on a macOS runner, and AltStore signs it with your free Apple ID.

## 1. Develop with Expo Go

```bash
npm install
npx expo start          # scan the QR code with the iPhone Camera app
npx expo start --tunnel # use this if the phone can't reach the PC on your Wi-Fi
```

Install **Expo Go** from the App Store first. Edits to `App.tsx` show up on the phone right away.

Checks:

```bash
npx tsc --noEmit
npx expo-doctor
```

## 2. Build the `.ipa` (GitHub Actions)

Push to `main`, or open **Actions → iOS unsigned IPA → Run workflow**. When it finishes, download the
`HelloApp-ipa` artifact (a zip) and extract `HelloApp.ipa`.

> macOS runners are free on public repos. On private repos, macOS minutes count 10x against your
> monthly free minutes.

## 3. Sideload with AltStore Classic + AltServer (Windows)

1. Install **iTunes** and **iCloud** from **apple.com**, *not* the Microsoft Store versions. AltServer
   doesn't work with the Store versions.
2. Install **AltServer** from <https://altstore.io>. Plug in the iPhone by USB and tap *Trust*.
   In iTunes, open the device and enable **"Sync with this iPhone over Wi-Fi"**.
3. Click the AltServer tray icon → **Install AltStore** → your iPhone → sign in with your Apple ID.
4. On the iPhone:
   - Settings → General → **VPN & Device Management** → trust your Apple ID.
   - Settings → Privacy & Security → **Developer Mode** → on, then restart.
5. Copy `HelloApp.ipa` to the phone (for example with iCloud Drive or OneDrive, then save it to Files).
6. Open AltStore → **My Apps** → **+** → pick `HelloApp.ipa`.

### Keeping it alive (the 7-day limit)

- Apps signed with a free Apple ID **expire after 7 days**.
- AltStore refreshes them in the background **if AltServer is running on a PC on the same Wi-Fi**.
  Set AltServer to launch at startup and allow it through the Windows firewall.
- Public, school or work Wi-Fi often blocks this. Refresh over USB instead, or tap **Refresh All**
  in AltStore when you're home.
- A free Apple ID allows **3 sideloaded apps at once, and AltStore counts as one**.

> **AltStore PAL is a different product.** It's an EU/Japan/Brazil marketplace for notarized apps and
> doesn't use AltServer. This project uses **AltStore Classic**.
