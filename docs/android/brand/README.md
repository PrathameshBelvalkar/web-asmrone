# Nekohub icon

`nekohub-icon.png` is the source art. `make-icons.swift` turns it into the Android assets:

- `app/src/main/res/mipmap-*/ic_launcher_foreground.png`: adaptive icon foreground (108 dp, art in the 66 dp safe zone)
- `app/src/main/res/mipmap-*/ic_launcher_monochrome.png`: themed icon (Android 13+), the dark shapes only
- `app/src/main/res/drawable-xxxhdpi/splash_icon.png`: system splash icon (240 dp)
- `designsystem/src/main/res/drawable-nodpi/nekohub_mark.png`: the tile on the in-app splash (O.1)

The icon background colour (`ic_launcher_background`) is the art's own background, `#F9F8FD`.

To regenerate, from `apps/android`:

```sh
swift ../../docs/android/brand/make-icons.swift ../../docs/android/brand/nekohub-icon.png app/src/main/res designsystem/src/main/res
```

## Splash animation

`designsystem/src/main/res/raw/splash_logo.json` is a Lottie built from `nekohub-tile.webp` (the tile with rounded
corners) by `make-splash-lottie.py`: frames 0–15 bounce the tile in, frames 15–75 loop (echo rings, sparkles, a bob).
It plays on the in-app splash (first run) and over Home for about a second on every cold start. The system splash
can't play Lottie, so it shows `splash_icon.png`.

```sh
python3 docs/android/brand/make-splash-lottie.py docs/android/brand/nekohub-tile.webp \
  apps/android/designsystem/src/main/res/raw/splash_logo.json
```
