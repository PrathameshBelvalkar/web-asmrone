# Manual test checklist (Echo Desktop)

Run this on a real machine for each operating system before publishing a release. Record the
results in the release notes. Automated tests cover the logic; this list covers what only a person can see.

Machine: ______________  OS: ______________  Installer: ______________  Date: __________

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Install on a machine that has never had Echo, FFmpeg or Whisper | Installs and opens | |
| 2 | First start | Home page, no prompt; browsing and playback work; a track without subtitles shows only the "Turn on AI subtitles in Settings" link | |
| 3 | Settings → turn on AI subtitles, touch nothing else | Download, check and speed test run by themselves and end on "Ready" | |
| 3a | During the download, turn Wi-Fi off at about 50 %, then on | Continues without starting over | |
| 4 | Quit the app during the download, reopen | Download continues by itself from the same percent | |
| 4a | Turn the switch off during the download, then on again | Pauses, then continues from the same percent | |
| 4b | Pause, then Cancel download | Pause keeps the progress; Cancel deletes the partial file | |
| 5 | Speed test | Shows a speed; Windows/Linux without a Vulkan driver end on "Processor only" | |
| 6 | Play a track that has no subtitles | Lines appear within about 20 seconds | |
| 7 | Jump to the middle of the track | New lines start from there | |
| 8 | Settings → switch model, play another track | Works with the new model | |
| 8a | Settings → delete a downloaded model (not in use, then the one in use) | The file is removed; the one in use switches to another, or AI subtitles turn off | |
| 9 | Close the window while audio plays (macOS, Windows) | Audio continues; tray icon reopens the window | |
| 10 | Quit (Cmd+Q, tray Quit, File → Quit) | No `Echo`, `ffmpeg` or `whisper-server` process is left | |
| 11 | Open the app twice | The second start focuses the first window | |
| 12 | Restart the app | Queue and settings are still there | |
| 13 | Disk almost full | Clear "Not enough free disk space" message | |
| 14 | Install a newer version over an older one | Models and settings are kept | |
| 15 | Path with spaces or non-English letters in the user name (Windows) | Everything works | |
| 16 | Help → Check for updates… | "You have the latest version of Echo" when there is nothing new | |
