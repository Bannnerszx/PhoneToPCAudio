"""Draws the PCAudio icon: a white speaker on a rounded square.

    py icon.py build/pcaudio.ico    # writes the .exe/installer icon
"""

import sys

from PIL import Image, ImageDraw

BLUE = (0, 122, 255)
GREEN = (52, 199, 89)
WHITE = (255, 255, 255)
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def draw_icon(size: int = 64, color: tuple[int, int, int] = BLUE) -> Image.Image:
    # Drawn at 4x and scaled down, for smooth edges.
    s = size * 4
    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.22, fill=color)
    draw.rectangle([s * 0.17, s * 0.40, s * 0.31, s * 0.60], fill=WHITE)
    draw.polygon(
        [(s * 0.31, s * 0.40), (s * 0.47, s * 0.25), (s * 0.47, s * 0.75), (s * 0.31, s * 0.60)],
        fill=WHITE,
    )
    for radius in (0.14, 0.27):
        cx, cy, r = s * 0.50, s * 0.50, s * radius
        draw.arc([cx - r, cy - r, cx + r, cy + r], -50, 50, fill=WHITE, width=round(s * 0.065))
    return image.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    draw_icon(256).save(sys.argv[1], sizes=ICO_SIZES)
