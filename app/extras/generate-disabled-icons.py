#!/usr/bin/env python3
"""Generate disabled '-off' icon variants in app/icons/.

The blue background and the darker blue shadow are flattened into a single
muted gray. The golden letters and the cursor bar are kept smooth
(anti-aliased) and rendered in a dark gray for contrast. No border, no shadow
variation, no color cast.
"""

from pathlib import Path
from PIL import Image


def smooth_flat_gray_icon(src: Image.Image) -> Image.Image:
    """Return a flat gray disabled icon with smooth dark letters."""
    img = src.convert("RGBA").copy()
    width, height = img.size

    BG_GRAY = 120      # slightly darker gray for the circle
    TEXT_GRAY = 200    # slightly off-white for the letters
    EDGE_LOW = 60      # score below this is definitely background
    EDGE_HIGH = 110    # score above this is definitely text

    def smoothstep(edge0: float, edge1: float, x: float) -> float:
        t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
        return t * t * (3.0 - 2.0 * t)

    new_data = []
    for y in range(height):
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))

            if a < 128:
                new_data.append((0, 0, 0, 0))
                continue

            luma = int(0.299 * r + 0.587 * g + 0.114 * b)

            # Boost score for yellow/orange pixels (letters and cursor bar)
            # so the thin cursor survives downsampling/thresholding.
            color_bonus = max(0, min(80, (r - b) * 0.5 + (g - b) * 0.3))
            score = luma + color_bonus

            if score < EDGE_LOW:
                gray = BG_GRAY
            elif score > EDGE_HIGH:
                gray = TEXT_GRAY
            else:
                t = smoothstep(EDGE_LOW, EDGE_HIGH, score)
                gray = int(BG_GRAY * (1 - t) + TEXT_GRAY * t)

            new_data.append((gray, gray, gray, a))

    result = Image.new("RGBA", (width, height))
    result.putdata(new_data)
    return result


def main() -> None:
    icons_dir = Path(__file__).resolve().parent.parent / "icons"
    sizes = [16, 32, 48, 128]

    for size in sizes:
        src_path = icons_dir / f"icon{size}.png"
        dst_path = icons_dir / f"icon{size}-off.png"

        if not src_path.exists():
            print(f"Skipping {src_path}: not found")
            continue

        with Image.open(src_path) as src:
            off = smooth_flat_gray_icon(src)
            off.save(dst_path, "PNG")
            print(f"Saved {dst_path}")


if __name__ == "__main__":
    main()
