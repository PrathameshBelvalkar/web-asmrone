# Manual test checklist (NekoHub Desktop)

Run this on a real Mac (one with an Apple chip and one with an Intel chip) before publishing a release. Record the
results in the release notes. Automated tests cover the logic; this list covers what only a person can see.

Mac: ______________  macOS: ______________  Installer: ______________  Date: __________

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Install on a machine that has never had NekoHub, FFmpeg or Whisper | Installs and opens | |
| 2 | First start | Home page, no prompt; browsing and playback work; a track without subtitles shows only the "Turn on AI subtitles in Settings" link | |
| 3 | Settings → turn on AI subtitles, touch nothing else | Download, check and speed test run by themselves and end on "Ready" | |
| 3a | During the download, turn Wi-Fi off at about 50 %, then on | Continues without starting over | |
| 4 | Quit the app during the download, reopen | Download continues by itself from the same percent | |
| 4a | Turn the switch off during the download, then on again | Pauses, then continues from the same percent | |
| 4b | Pause, then Cancel download | Pause keeps the progress; Cancel deletes the partial file | |
| 5 | Speed test | Shows a speed; Intel Macs end on "Processor only" | |
| 6 | Play a track that has no subtitles | Lines appear within about 20 seconds | |
| 7 | Jump to the middle of the track | New lines start from there | |
| 8 | Settings → switch model, play another track | Works with the new model | |
| 8a | Settings → delete a downloaded model (not in use, then the one in use) | The file is removed; the one in use switches to another, or AI subtitles turn off | |
| 9 | Close the window while audio plays | Audio continues; menu bar icon reopens the window | |
| 10 | Quit (Cmd+Q, menu bar icon → Quit) | No `NekoHub`, `ffmpeg` or `whisper-server` process is left | |
| 11 | Open the app twice | The second start focuses the first window | |
| 12 | Restart the app | Queue and settings are still there | |
| 13 | Disk almost full | Clear "Not enough free disk space" message | |
| 14 | Install a newer version over an older one | Models and settings are kept | |
| 15 | Path with spaces or non-English letters in the user name | Everything works | |
| 16 | Help → Check for updates… | "You have the latest version of NekoHub" when there is nothing new | |
| 17 | First start | Manga & Doujinshi is in the sidebar between Browse and Account | |
| 18 | Manga → Browse, scroll; pick a language, then a category; open a gallery; read | Covers load; more load on scroll; the language is still picked after a restart; the reader turns pages with the arrow keys and Space without starting playback | |
| 19 | Reader on a Japanese manga → Two pages; then Settings → Cover on its own off; Long strip; F for fullscreen | Pages are laid out right to left (page 2 on the right of 3) while → and the right side still go forward; turning the switch off shifts the pairs; wide spreads stay whole; the bars fade while reading and come back on a tap in the middle; the strip's page number follows scrolling; panels still open in fullscreen | |
| 20 | Manga → Artists, type part of a name; open an artist | Matching artists appear (the first search for a letter can take a few seconds); the artist page shows the name, gallery count and their galleries | |
| 21 | Manga → Search → Tags, type a tag name | Matching tags appear as you type; each opens its galleries | |
| 22 | First start | JAV is in the sidebar between Manga & Doujinshi and Account, with News, Latest, Movies, Idols, Genres and Search | |
| 23 | JAV → News, open a weekly post; JAV → Latest | Posts load with pictures and more load on scroll; a weekly post shows its numbered movies or idols; Latest shows a Coming soon row, then released movies (the first visit takes a few seconds) | |
| 24 | JAV → Movies, switch to Uncensored and Top rated; open a movie; click an image; press → and Esc; click Trailer | Covers load; the movie page shows details, genres, cast, images and similar movies; the viewer moves with the arrow keys and closes with Esc without starting playback; the trailer plays, or says "Trailer unavailable" | |
| 25 | JAV → Idols → Filters, pick a cup size and a hair colour; open an idol | The list narrows and the choices show as chips that remove them; there is no loli body type; the idol page shows the profile, movies (more on scroll) and related idols | |
