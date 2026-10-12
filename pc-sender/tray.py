"""PCAudio for Windows: streams this PC's sound in the background, with a tray icon.

This is what PCAudioSetup.exe installs (see build.ps1). sender.py is the console version.
"""

import asyncio
import ctypes
import sys
import threading
import winreg

import pystray

import sender
from icon import BLUE, GREEN, draw_icon

APP_NAME = "PCAudio"
# Also the AppMutex in installer.iss, so the installer can close a running copy.
MUTEX_NAME = "PCAudioSender"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
# Added to the "start with Windows" command, so a login doesn't pop up a notification.
AUTOSTART_ARG = "--autostart"
# "Start with Windows" points at this exe, so it's only offered in the installed app.
INSTALLED = getattr(sys, "frozen", False)

ERROR_ALREADY_EXISTS = 183
WSAEADDRINUSE = 10048
MB_ICONERROR = 0x10
MB_ICONINFORMATION = 0x40

kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)


def message_box(text: str, icon: int = MB_ICONINFORMATION) -> None:
    ctypes.windll.user32.MessageBoxW(None, text, APP_NAME, icon)


def claim_single_instance() -> bool:
    # The mutex is released when this process exits.
    kernel32.CreateMutexW(None, False, MUTEX_NAME)
    return ctypes.get_last_error() != ERROR_ALREADY_EXISTS


def autostart_enabled() -> bool:
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.QueryValueEx(key, APP_NAME)
        return True
    except FileNotFoundError:
        return False


def set_autostart(enabled: bool) -> None:
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
        if enabled:
            command = f'"{sys.executable}" {AUTOSTART_ARG}'
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, command)
        else:
            try:
                winreg.DeleteValue(key, APP_NAME)
            except FileNotFoundError:
                pass


def describe_error(error: Exception) -> str:
    if isinstance(error, OSError) and error.winerror == WSAEADDRINUSE:
        return (
            f"PCAudio couldn't start because another program is using port {sender.DEFAULT_PORT}.\n\n"
            "Is the console version (sender.py) still running?"
        )
    return f"PCAudio couldn't start:\n\n{error}"


class SenderThread(threading.Thread):
    """Runs sender.run() on its own event loop, next to the tray icon's message loop."""

    def __init__(self, on_listeners, on_error) -> None:
        super().__init__(daemon=True)
        self.on_listeners = on_listeners
        self.on_error = on_error
        self.loop = asyncio.new_event_loop()
        self.task: asyncio.Task | None = None
        self.started_task = threading.Event()

    def run(self) -> None:
        asyncio.set_event_loop(self.loop)
        self.task = self.loop.create_task(
            sender.run(None, sender.DEFAULT_PORT, self.on_listeners)
        )
        self.started_task.set()
        try:
            self.loop.run_until_complete(self.task)
        except asyncio.CancelledError:
            pass
        except Exception as error:
            self.on_error(error)

    def stop(self) -> None:
        self.started_task.wait(timeout=3)
        if self.task:
            self.loop.call_soon_threadsafe(self.task.cancel)
        self.join(timeout=3)


def main() -> None:
    if not claim_single_instance():
        message_box("PCAudio is already running. Look for its icon next to the clock.")
        return

    idle_image = draw_icon(64, BLUE)
    live_image = draw_icon(64, GREEN)
    listeners = 0

    def status() -> str:
        if listeners == 0:
            return "PCAudio: waiting for your iPhone"
        if listeners == 1:
            return "PCAudio: playing on your iPhone"
        return f"PCAudio: playing on {listeners} devices"

    def on_listeners(count: int) -> None:
        nonlocal listeners
        listeners = count
        tray.icon = live_image if count else idle_image
        tray.title = status()
        tray.update_menu()

    def on_error(error: Exception) -> None:
        message_box(describe_error(error), MB_ICONERROR)
        tray.stop()

    def toggle_autostart(_icon, _item) -> None:
        set_autostart(not autostart_enabled())

    tray = pystray.Icon(
        APP_NAME,
        idle_image,
        status(),
        pystray.Menu(
            pystray.MenuItem(lambda _item: status(), None, enabled=False),
            # For typing into the app if its network search can't find this PC.
            pystray.MenuItem(lambda _item: f"Address: {sender.lan_ip()}", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Start with Windows",
                toggle_autostart,
                checked=lambda _item: autostart_enabled(),
                visible=INSTALLED,
            ),
            pystray.MenuItem("Quit", lambda icon, _item: icon.stop()),
        ),
    )
    worker = SenderThread(on_listeners, on_error)

    def setup(icon: pystray.Icon) -> None:
        icon.visible = True
        worker.start()
        if AUTOSTART_ARG not in sys.argv:
            icon.notify("Open PCAudio on your iPhone and tap Play.", "PCAudio is on")

    tray.run(setup)
    worker.stop()


if __name__ == "__main__":
    main()
