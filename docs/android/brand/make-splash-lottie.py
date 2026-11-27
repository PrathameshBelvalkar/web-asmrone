"""Builds the O.1 splash Lottie (designsystem/src/main/res/raw/splash_logo.json) from the rounded icon tile.

usage: python3 make-splash-lottie.py <mark.webp> <out.json>

Timeline (30 fps): frames 0–15 are the intro (the tile bounces in), frames 15–75 loop (echo rings every second,
sparkles twinkling in turn, a gentle bob). Frame 75 matches frame 15, so the loop has no jump.
"""
import base64
import json
import sys

FPS, INTRO_END, LOOP_END = 30, 15, 75
SIZE, TILE, CENTRE = 240, 150, 120
EASE_OUT = {"o": {"x": [0.2], "y": [0]}, "i": {"x": [0.2], "y": [1]}}
EASE_IN_OUT = {"o": {"x": [0.4], "y": [0]}, "i": {"x": [0.6], "y": [1]}}


def rgba(hex_colour):
    h = hex_colour.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1]


def static(v):
    return {"a": 0, "k": v}


def animated(*frames, ease=EASE_OUT):
    """frames: (time, value) pairs; every key but the last eases into the next."""
    keys = []
    for i, (t, v) in enumerate(frames):
        key = {"t": t, "s": v if isinstance(v, list) else [v]}
        if i < len(frames) - 1:
            key.update(ease)
        keys.append(key)
    return {"a": 1, "k": keys}


def transform(position=None, scale=None, opacity=None, rotation=None, anchor=(0, 0)):
    return {
        "o": opacity or static(100),
        "r": rotation or static(0),
        "p": position or static([CENTRE, CENTRE, 0]),
        "a": static([anchor[0], anchor[1], 0]),
        "s": scale or static([100, 100, 100]),
    }


def layer(index, name, kind, ks, **extra):
    return {"ddd": 0, "ind": index, "ty": kind, "nm": name, "sr": 1, "ks": ks, "ao": 0,
            "ip": 0, "op": LOOP_END, "st": 0, "bm": 0, **extra}


def group(*items):
    tr = {"ty": "tr", "p": static([0, 0]), "a": static([0, 0]), "s": static([100, 100]), "r": static(0),
          "o": static(100), "sk": static(0), "sa": static(0)}
    return {"ty": "gr", "it": [*items, tr]}


def ring(index, start):
    """An echo ring: a circle the size of the tile that grows and fades over one second."""
    end = start + 30
    scale = animated((start, [100, 100, 100]), (end, [160, 160, 100]))
    opacity = animated((0, 0), (start, 0), (start + 1, 70), (end, 0))
    shape = group({"ty": "el", "p": static([0, 0]), "s": static([TILE, TILE])},
                  {"ty": "st", "c": static(rgba("#B9C3F0")), "o": static(100), "w": static(3), "lc": 2, "lj": 2})
    return layer(index, f"ring {start}", 4, transform(scale=scale, opacity=opacity), shapes=[shape])


def sparkle(index, x, y, size, colour, start):
    """A four-point star that pops and fades over 20 frames, turning a little."""
    s, w = size / 2, size / 8
    points = [[0, -s], [w, -w], [s, 0], [w, w], [0, s], [-w, w], [-s, 0], [-w, -w]]
    path = {"ty": "sh", "ks": static({"i": [[0, 0]] * 8, "o": [[0, 0]] * 8, "v": points, "c": True})}
    fill = {"ty": "fl", "c": static(rgba(colour)), "o": static(100), "r": 1}
    end = start + 20
    scale = animated((0, [0, 0, 100]), (start, [0, 0, 100]), (start + 8, [110, 110, 100]), (end, [0, 0, 100]))
    rotation = animated((start, -20), (end, 25))
    return layer(index, f"sparkle {start}", 4,
                 transform(position=static([x, y, 0]), scale=scale, rotation=rotation), shapes=[group(path, fill)])


def main(mark_path, out_path):
    data = base64.b64encode(open(mark_path, "rb").read()).decode()
    asset_px = 384
    tile_scale = TILE / asset_px * 100

    # The tile: bounces in (85 % → 106 % → 100 %), then bobs 4 units up and back down once per loop.
    tile_ks = transform(
        anchor=(asset_px / 2, asset_px / 2),
        scale=animated((0, [tile_scale * 0.85] * 2 + [100]), (9, [tile_scale * 1.06] * 2 + [100]),
                       (INTRO_END, [tile_scale] * 2 + [100])),
        position=animated((0, [CENTRE, CENTRE, 0]), (INTRO_END, [CENTRE, CENTRE, 0]),
                          (45, [CENTRE, CENTRE - 4, 0]), (LOOP_END, [CENTRE, CENTRE, 0]), ease=EASE_IN_OUT),
    )

    layers = [
        sparkle(1, 38, 50, 16, "#8E95E8", INTRO_END),
        sparkle(2, 206, 72, 12, "#F2A7C8", 35),
        sparkle(3, 200, 204, 14, "#8E95E8", 55),
        layer(4, "tile", 2, tile_ks, refId="mark"),
        ring(5, 2),           # intro ring, before the loop starts
        ring(6, INTRO_END),   # loop: one ring every second
        ring(7, 45),
    ]
    layers[4]["op"] = 32      # the intro ring isn't part of the loop

    lottie = {
        "v": "5.7.4", "fr": FPS, "ip": 0, "op": LOOP_END, "w": SIZE, "h": SIZE, "nm": "Nekohub splash", "ddd": 0,
        "assets": [{"id": "mark", "w": asset_px, "h": asset_px, "u": "", "p": f"data:image/webp;base64,{data}", "e": 1}],
        "layers": layers,
        "markers": [{"tm": 0, "cm": "intro", "dr": INTRO_END}, {"tm": INTRO_END, "cm": "loop", "dr": LOOP_END - INTRO_END}],
    }
    with open(out_path, "w") as f:
        json.dump(lottie, f, separators=(",", ":"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
