"""Plays the iPhone's microphone on this PC (the app's "Use as microphone").

The phone connects to /mic and sends 16-bit mono PCM. If VB-Audio Virtual Cable
is installed, the sound goes into "CABLE Input", so other apps (Discord, Zoom,
OBS...) can pick "CABLE Output" as their microphone. Otherwise it plays through
the default speakers.
"""

import json
import threading
from array import array
from collections.abc import Callable

import pyaudiowpatch as pyaudio
from websockets.asyncio.server import ServerConnection
from websockets.exceptions import ConnectionClosed

VIRTUAL_CABLE = "CABLE Input"
CHUNK_MS = 10
# Audio held back to ride out Wi-Fi timing jitter, on top of one chunk from the
# phone (10 ms from the built app, about 100 ms from Expo Go). Less than the music
# stream: a microphone is only useful with little delay.
TARGET_MS = 60
# Beyond target + one more chunk + this, the oldest audio is dropped, so a Wi-Fi
# hiccup (or the phone's clock running slightly fast) never turns into permanent delay.
MAX_EXTRA_MS = 60
SAMPLE_BYTES = 2


def output_devices(pa: pyaudio.PyAudio) -> list[dict]:
    wasapi = pa.get_host_api_info_by_type(pyaudio.paWASAPI)
    devices = (
        pa.get_device_info_by_host_api_device_index(wasapi["index"], i)
        for i in range(wasapi["deviceCount"])
    )
    return [device for device in devices if device["maxOutputChannels"] > 0]


def pick_output(pa: pyaudio.PyAudio, index: int | None) -> dict:
    """The given device, else the virtual cable if installed, else the default speakers."""
    if index is not None:
        return pa.get_device_info_by_index(index)
    for device in output_devices(pa):
        if device["name"].startswith(VIRTUAL_CABLE):
            return device
    wasapi = pa.get_host_api_info_by_type(pyaudio.paWASAPI)
    return pa.get_device_info_by_index(wasapi["defaultOutputDevice"])


class JitterBuffer:
    """Filled by the network as audio arrives, emptied by the sound card at its own pace."""

    def __init__(self, rate: int) -> None:
        self.lock = threading.Lock()
        self.data = bytearray()
        self.base = rate * TARGET_MS // 1000 * SAMPLE_BYTES
        self.extra = rate * MAX_EXTRA_MS // 1000 * SAMPLE_BYTES
        self.largest_chunk = 0
        self.primed = False

    @property
    def target(self) -> int:
        return self.base + self.largest_chunk

    def add(self, chunk: bytes) -> None:
        with self.lock:
            self.largest_chunk = max(self.largest_chunk, len(chunk))
            self.data += chunk
            if len(self.data) > self.target + self.largest_chunk + self.extra:
                del self.data[: len(self.data) - self.target]

    def take(self, size: int) -> bytes:
        with self.lock:
            # After running dry, wait for a full target's worth before playing again.
            if not self.primed and len(self.data) < self.target:
                return bytes(size)
            self.primed = True
            chunk = bytes(self.data[:size])
            del self.data[:size]
        if len(chunk) < size:
            self.primed = False
            chunk += bytes(size - len(chunk))
        return chunk


def resample(samples: array, source_rate: int, rate: int) -> array:
    """Linear resampling, in case the phone couldn't record at the rate asked for."""
    count = len(samples) * rate // source_rate
    if count == 0 or len(samples) < 2:
        return array("h")
    step = (len(samples) - 1) / max(count - 1, 1)
    out = array("h", bytes(count * SAMPLE_BYTES))
    for i in range(count):
        position = i * step
        j = int(position)
        k = min(j + 1, len(samples) - 1)
        out[i] = int(samples[j] + (samples[k] - samples[j]) * (position - j))
    return out


async def receive(
    ws: ServerConnection, device_index: int | None, on_ready: Callable[[str], None]
) -> None:
    """Plays one phone's microphone until it disconnects. `on_ready` gets the device name."""
    with pyaudio.PyAudio() as pa:
        try:
            device = pick_output(pa, device_index)
            # Windows only accepts the device's own sample rate, so the phone is asked
            # to record at it.
            rate = int(device["defaultSampleRate"])
            buffer = JitterBuffer(rate)

            def on_play(in_data, frame_count, time_info, status):
                return (buffer.take(frame_count * SAMPLE_BYTES), pyaudio.paContinue)

            stream = pa.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=rate,
                output=True,
                output_device_index=device["index"],
                frames_per_buffer=rate * CHUNK_MS // 1000,
                stream_callback=on_play,
            )
        except (OSError, LookupError) as error:
            print(f"Can't play the phone's microphone ({error}).")
            await ws.send(json.dumps({"type": "error", "message": "The PC can't play the microphone"}))
            return

        with stream:
            ready = {"type": "mic-ready", "sampleRate": rate, "channels": 1, "encoding": "s16le"}
            await ws.send(json.dumps({**ready, "device": device["name"]}))
            on_ready(device["name"])
            source_rate = rate
            try:
                async for message in ws:
                    if isinstance(message, str):
                        stream_format = json.loads(message)
                        if stream_format.get("type") == "format":
                            source_rate = int(stream_format["sampleRate"])
                        continue
                    samples = array("h", message[: len(message) // SAMPLE_BYTES * SAMPLE_BYTES])
                    if source_rate != rate:
                        samples = resample(samples, source_rate, rate)
                    buffer.add(samples.tobytes())
            except ConnectionClosed:
                pass
