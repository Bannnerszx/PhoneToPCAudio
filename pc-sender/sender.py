"""Streams this PC's sound to the PCAudio app over Wi-Fi.

Captures whatever Windows is playing (WASAPI loopback) and sends it to every
connected phone as raw 16-bit PCM over a WebSocket. Also plays a phone's
microphone when the app's "Use as microphone" is on (see mic.py).

    py sender.py            # stream the default speakers
    py sender.py --list     # list devices you can stream from
    py sender.py --device 12
    py sender.py --mic-device 7  # where the phone's microphone plays (see --list)

This is the console version. tray.py wraps it as the PCAudio Windows app.
"""

import argparse
import asyncio
import json
import socket
import sys
from array import array
from collections.abc import Callable

import pyaudiowpatch as pyaudio
from websockets.asyncio.server import ServerConnection, serve
from websockets.exceptions import ConnectionClosed

import mic

DEFAULT_PORT = 8765
CHUNK_MS = 10
# Per-phone backlog limit (about 200 ms). Beyond it the oldest audio is dropped,
# so a Wi-Fi hiccup never turns into permanent delay.
QUEUE_CHUNKS = 20
# Windows delivers nothing while no app is playing sound. After this long without
# audio, silence is sent instead so the phone's playback (and connection) stays alive.
SILENCE_AFTER_S = 0.03
# Longest silence sent at once, e.g. after the PC wakes from sleep.
SILENCE_MAX_S = 0.1
# Keep the socket's send buffer shallow (8 KiB is about 40 ms of audio).
WRITE_LIMIT = 8192
# Windows only shows a newly chosen default device (say, headphones instead of
# speakers) to a freshly opened capture. So once the capture has been idle this
# long, it's reopened: there's nothing to lose, and it costs about 30 ms of CPU.
REOPEN_WHEN_IDLE_S = 3
RETRY_S = 2


class Broadcast:
    """Sends audio to every connected phone, filling gaps in the capture with silence."""

    def __init__(self) -> None:
        self.queues: set[asyncio.Queue[bytes | str]] = set()
        self.format = ""
        self.last_audio = 0.0
        self.silent_until = 0.0
        self.set_format(48000, 2)

    def set_format(self, rate: int, channels: int) -> None:
        """Sets the format of the audio that follows, telling phones if it changed."""
        stream_format = json.dumps(
            {"type": "format", "sampleRate": rate, "channels": channels, "encoding": "s16le"}
        )
        if stream_format == self.format:
            return
        self.format = stream_format
        self.rate = rate
        self.frame_bytes = channels * 2
        for queue in self.queues:
            # Audio still queued is in the old format.
            while not queue.empty():
                queue.get_nowait()
            queue.put_nowait(stream_format)

    def send(self, chunk: bytes) -> None:
        for queue in self.queues:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(chunk)

    def on_audio(self, chunk: bytes) -> None:
        self.last_audio = asyncio.get_running_loop().time()
        self.send(chunk)

    async def fill_silence(self) -> None:
        # Paced by the clock, not by timeouts: Windows timers are too coarse to tell
        # a late chunk from a stopped stream, and extra silence would add delay.
        loop = asyncio.get_running_loop()
        while True:
            await asyncio.sleep(CHUNK_MS / 1000)
            now = loop.time()
            if now - self.last_audio < SILENCE_AFTER_S:
                continue
            start = max(self.last_audio, self.silent_until, now - SILENCE_MAX_S)
            frames = int((now - start) * self.rate)
            if frames > 0:
                self.send(bytes(frames * self.frame_bytes))
                self.silent_until = start + frames / self.rate


def loopback_devices(pa: pyaudio.PyAudio) -> list[dict]:
    return list(pa.get_loopback_device_info_generator())


def pick_device(pa: pyaudio.PyAudio, index: int | None) -> dict:
    if index is None:
        return pa.get_default_wasapi_loopback()
    for device in loopback_devices(pa):
        if device["index"] == index:
            return device
    sys.exit(f"Device {index} is not a loopback device. Run with --list to see the options.")


def front_stereo(data: bytes, channels: int) -> bytes:
    """Keeps front left/right from interleaved 16-bit surround audio."""
    samples = array("h", data)
    stereo = array("h", bytes(len(samples) // channels * 4))
    stereo[0::2] = samples[0::channels]
    stereo[1::2] = samples[1::channels]
    return stereo.tobytes()


def lan_ip() -> str:
    # Connecting a UDP socket sends nothing; it only picks the interface Windows
    # would use, which is the Wi-Fi/Ethernet address the phone can reach.
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


async def capture(device_index: int | None, broadcast: Broadcast) -> None:
    """Captures until cancelled. Follows the default device unless one is given."""
    loop = asyncio.get_running_loop()
    device_name = None
    while True:
        try:
            with pyaudio.PyAudio() as pa:
                device = pick_device(pa, device_index)
                channels = device["maxInputChannels"]
                rate = int(device["defaultSampleRate"])

                def on_capture(in_data, frame_count, time_info, status):
                    if channels > 2:
                        in_data = front_stereo(in_data, channels)
                    loop.call_soon_threadsafe(broadcast.on_audio, in_data)
                    return (None, pyaudio.paContinue)

                with pa.open(
                    format=pyaudio.paInt16,
                    channels=channels,
                    rate=rate,
                    input=True,
                    input_device_index=device["index"],
                    frames_per_buffer=rate * CHUNK_MS // 1000,
                    stream_callback=on_capture,
                ) as stream:
                    broadcast.set_format(rate, min(channels, 2))
                    if device["name"] != device_name:
                        device_name = device["name"]
                        print(f"Streaming: {device_name} ({rate} Hz, {min(channels, 2)} ch)")
                    opened = loop.time()
                    while stream.is_active():
                        await asyncio.sleep(1)
                        idle = loop.time() - max(broadcast.last_audio, opened)
                        if device_index is None and idle > REOPEN_WHEN_IDLE_S:
                            break
        except (OSError, LookupError) as error:
            # No output device right now (e.g. headphones unplugged mid-switch).
            print(f"Can't capture audio ({error}). Retrying.")
            await asyncio.sleep(RETRY_S)


async def run(
    device_index: int | None,
    port: int,
    on_listeners: Callable[[int], None] | None = None,
    mic_device: int | None = None,
    on_mic: Callable[[list[str]], None] | None = None,
) -> None:
    """Streams until cancelled. `on_listeners` gets the phone count when it changes, and
    `on_mic` the devices that phone microphones are playing on."""
    # The app's network search connects to /probe on every address; the reply
    # tells it which one is a PCAudio sender, and its name.
    hello = json.dumps({"type": "hello", "app": "pcaudio", "name": socket.gethostname()})
    broadcast = Broadcast()

    mics: list[str] = []

    def listeners_changed() -> None:
        if on_listeners:
            on_listeners(len(broadcast.queues))

    def mics_changed() -> None:
        if on_mic:
            on_mic(list(mics))

    async def handle_mic(ws: ServerConnection) -> None:
        address = ws.remote_address[0]
        playing_on = None

        def on_ready(device_name: str) -> None:
            nonlocal playing_on
            playing_on = device_name
            mics.append(device_name)
            mics_changed()
            print(f"Phone microphone on: {address}, playing on {device_name}")

        try:
            await mic.receive(ws, mic_device, on_ready)
        finally:
            if playing_on:
                mics.remove(playing_on)
                mics_changed()
                print(f"Phone microphone off: {address}")

    async def handle(ws: ServerConnection) -> None:
        if ws.request and ws.request.path == "/probe":
            await ws.send(hello)
            return
        if ws.request and ws.request.path == "/mic":
            await handle_mic(ws)
            return
        address = ws.remote_address[0]
        queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=QUEUE_CHUNKS)
        print(f"Phone connected: {address}")
        try:
            await ws.send(broadcast.format)
            broadcast.queues.add(queue)
            listeners_changed()
            while True:
                await ws.send(await queue.get())
        except ConnectionClosed:
            pass
        finally:
            broadcast.queues.discard(queue)
            listeners_changed()
            print(f"Phone disconnected: {address}")

    async with serve(handle, "0.0.0.0", port, compression=None, write_limit=WRITE_LIMIT) as server:
        print(f"In the PCAudio app, enter:  {lan_ip()}")
        if port != DEFAULT_PORT:
            print(f"(with port: {lan_ip()}:{port})")
        print("Press Ctrl+C to stop.")
        await asyncio.gather(
            server.serve_forever(),
            broadcast.fill_silence(),
            capture(device_index, broadcast),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Stream this PC's sound to the PCAudio app.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"default {DEFAULT_PORT}")
    parser.add_argument("--device", type=int, help="loopback device index (see --list)")
    parser.add_argument(
        "--mic-device", type=int, help="output device for the phone's microphone (see --list)"
    )
    parser.add_argument("--list", action="store_true", help="list audio devices and exit")
    args = parser.parse_args()

    if args.list:
        with pyaudio.PyAudio() as pa:
            print("Devices to stream from (--device):")
            default = pa.get_default_wasapi_loopback()["index"]
            for device in loopback_devices(pa):
                marker = "*" if device["index"] == default else " "
                print(f"{marker} {device['index']:>3}  {device['name']}")
            print("Devices to play the phone's microphone on (--mic-device):")
            default = mic.pick_output(pa, None)["index"]
            for device in mic.output_devices(pa):
                marker = "*" if device["index"] == default else " "
                print(f"{marker} {device['index']:>3}  {device['name']}")
        return

    try:
        asyncio.run(run(args.device, args.port, mic_device=args.mic_device))
    except KeyboardInterrupt:
        print("Stopped.")


if __name__ == "__main__":
    main()
