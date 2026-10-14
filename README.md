# PCAudio: hear your PC on your iPhone

Play anything on your Windows PC (music, videos, games) and hear it on your iPhone over your home
Wi‑Fi, with about a tenth of a second of delay. It keeps playing when you lock your iPhone.

**You need:** a Windows 10 or 11 PC, an iPhone, and one Wi‑Fi network that both are connected to.

## Step 1: Install PCAudio on your PC

### [⬇ Download PCAudio for Windows](https://github.com/Bannnerszx/PhoneToPCAudio/releases/latest/download/PCAudioSetup.exe)

1. Open the downloaded **PCAudioSetup.exe**.
2. If Windows says **"Windows protected your PC"**, click **More info**, then **Run anyway**.
   This appears because the installer isn't signed by a paid publisher certificate.
3. Click **Yes** when Windows asks to allow changes, then **Install**, then **Finish**.

That's all on the PC. PCAudio now runs quietly next to the clock, and starts by itself whenever
you turn on the PC. Its icon is a white speaker on a blue square, which turns green while your
iPhone is listening. If you don't see it, click the **^** arrow next to the clock.

## Step 2: Install PCAudio on your iPhone

### [⬇ Download PCAudio for iPhone (.ipa)](https://github.com/Bannnerszx/PhoneToPCAudio/releases/latest/download/PCAudio.ipa)

The iPhone app isn't on the App Store. You install it with **AltStore**, which uses your own Apple
ID. If you haven't set up AltStore yet, do that first (see [Setting up AltStore](#setting-up-altstore)
below).

1. On your iPhone, open the download link above in **Safari** and tap **Download**.
   The file is saved in the **Files** app, under **Downloads**.
2. Make sure **AltServer** is running on your PC, and that your iPhone is on the same Wi‑Fi.
3. Open **AltStore**, go to **My Apps**, tap **+**, and choose **PCAudio.ipa**.

## Step 3: Connect

1. Open **PCAudio** on your iPhone.
2. The first time, iOS asks whether PCAudio may **find devices on your local network**. Tap
   **Allow**. (If the app then says it can't find your PC, tap **Search again**.)
3. After a few seconds, your PC's name appears. Tap **Play**.
4. Play something on your PC. You'll hear it on your iPhone.

You can lock your iPhone or switch to another app, and the sound keeps playing. You can also pause
and resume it from the lock screen. Next time, just open PCAudio and tap **Play**.

## Use your iPhone as the PC's microphone

1. On your PC, install the free [VB-CABLE Virtual Audio Device](https://vb-audio.com/Cable/)
   (unzip it, right-click **VBCABLE_Setup_x64.exe**, choose **Run as administrator**, then
   **Install Driver**), and restart the PC.
2. In PCAudio on your iPhone, tap **Use as microphone**. The first time, tap **Allow** when iOS asks
   about the microphone.
3. In the app that should hear you (Discord, Zoom, Teams, OBS…), choose **CABLE Output** as the
   microphone.

It works alongside **Play**, and keeps going when you lock your iPhone. Without VB-CABLE, your voice
plays on the PC's speakers instead.

While the microphone is on, the iPhone cancels the PC's sound from its speaker out of the mic, like
a phone call, and **Play** sounds like a call too. For the best sound, use earphones or AirPods: you
hear the PC in your ears, and the iPhone's microphone picks up only you.

## If something isn't working

**The app says "Can't find your PC"**
- Check that the PCAudio icon is next to your PC's clock. If it isn't, open **PCAudio** from the
  Start menu.
- Check that your iPhone and PC are on the **same Wi‑Fi**. Guest networks usually stop devices from
  seeing each other.
- On the iPhone, open **Settings → Privacy & Security → Local Network** and make sure **PCAudio** is
  on.
- Still nothing? Right-click the PCAudio icon on your PC to see its **Address** (for example
  `192.168.1.20`), and type it into the app under *Or type your PC's address*.

**The sound keeps cutting out:** in the app, raise **Delay** by 10–20 ms.

**The sound is late, for example in videos:** lower **Delay** a little. Most home Wi‑Fi works
well between 60 and 100 ms.

**You switched to headphones or other speakers on the PC:** wait about 3 seconds. PCAudio
follows the new speakers by itself.

**The app stopped opening after a week:** that's AltStore's 7-day limit. Open AltStore on the
iPhone while AltServer is running on your PC, and tap **Refresh All**.

**You want to turn PCAudio off**
- To quit it for now, right-click the PCAudio icon and choose **Quit**.
- To stop it starting with Windows, right-click the icon and untick **Start with Windows**.
- To remove it, go to **Settings → Apps → Installed apps → PCAudio → Uninstall**.

## Setting up AltStore

You only do this once. It needs a USB cable for the first connection.

1. On your PC, install **iTunes** and **iCloud** from **apple.com**, *not* the Microsoft Store
   versions, which don't work with AltServer.
2. Install **AltServer** from [altstore.io](https://altstore.io). Plug the iPhone into the PC with a
   cable and tap **Trust** on the iPhone.
3. In iTunes, open your iPhone and turn on **"Sync with this iPhone over Wi-Fi"**.
4. Click the AltServer icon next to the clock, choose **Install AltStore**, pick your iPhone, and sign
   in with your Apple ID.
5. On the iPhone:
   - Go to **Settings → General → VPN & Device Management** and trust your Apple ID.
   - Go to **Settings → Privacy & Security → Developer Mode**, turn it on, and restart the iPhone.

**Keeping it working:**
- Apps installed this way with a free Apple ID **expire after 7 days**. AltStore renews them by
  itself when AltServer is running on a PC on the same Wi‑Fi, so set AltServer to start with
  Windows.
- A free Apple ID can have **3 of these apps at once, and AltStore itself counts as one**.

> Make sure you use **AltStore Classic** (the one that uses AltServer), not **AltStore PAL**, which is a
> different app.

## For developers

Building, releasing, and how PCAudio works: see [DEVELOPING.md](DEVELOPING.md).
