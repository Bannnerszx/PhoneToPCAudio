; PCAudioSetup.exe: installs the PCAudio Windows app built by build.ps1.
; Compile with Inno Setup 6 (build.ps1 does this when Inno Setup is installed).

#define AppVersion "1.0.0"

[Setup]
AppId={{6F3C2B1E-8A4D-4C59-9B7E-2D1F0A6C5E83}
AppName=PCAudio
AppVersion={#AppVersion}
AppVerName=PCAudio {#AppVersion}
DefaultDirName={autopf}\PCAudio
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
; Admin rights are needed for the firewall rule below.
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Lets the installer close a running PCAudio (same name as MUTEX_NAME in tray.py).
AppMutex=PCAudioSender
OutputDir=build
OutputBaseFilename=PCAudioSetup
SetupIconFile=build\pcaudio.ico
UninstallDisplayIcon={app}\PCAudio.exe
WizardStyle=modern
Compression=lzma2
SolidCompression=yes

[Tasks]
Name: autostart; Description: "Start PCAudio when Windows starts"

[Files]
Source: "build\dist\PCAudio\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\PCAudio"; Filename: "{app}\PCAudio.exe"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "PCAudio"; ValueData: """{app}\PCAudio.exe"" --autostart"; Tasks: autostart; Flags: uninsdeletevalue
; Also removes the value on uninstall if it was turned on later from the tray menu.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: none; ValueName: "PCAudio"; Flags: uninsdeletevalue

[Run]
; Let phones on the same network connect, without Windows asking. Home Wi-Fi is
; often marked "Public" in Windows, so the rule covers every network profile but
; only accepts devices on the local network.
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=PCAudio"; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=PCAudio dir=in action=allow program=""{app}\PCAudio.exe"" enable=yes profile=any remoteip=localsubnet"; Flags: runhidden
Filename: "{app}\PCAudio.exe"; Description: "Start PCAudio now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM PCAudio.exe"; Flags: runhidden; RunOnceId: "StopPCAudio"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=PCAudio"; Flags: runhidden; RunOnceId: "RemoveFirewallRule"
