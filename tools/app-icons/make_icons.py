"""Makes the home-screen icons and iPhone launch screens from one picture.

Run from the repo root after changing tools/app-icons/app-icon-1024.png:

    python tools/app-icons/make_icons.py

It needs Pillow (pip install pillow). It writes:

  public/icons/apple-touch-icon.png    180 x 180, iPhone and iPad home screens
                                        (opaque and square: iOS rounds the corners)
  public/icons/icon-192.png             the manifest's icons for other systems,
  public/icons/icon-512.png             with rounded corners
  public/icons/icon-maskable-512.png    Android's shaped icons (full-bleed square;
                                        keep the artwork inside the middle 80%)
  public/icons/startup/*.png            iPhone launch screens, dark and light
  index.html                            the <link> tags for the launch screens,
                                        between the startup-images markers

The launch screens are the app's own background colour with nothing on it
(Apple's guidance: the launch screen should look like the app's first
screen, not a splash), so opening the installed app never flashes white.
"""

from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCE = HERE / "app-icon-1024.png"
ICONS = ROOT / "public" / "icons"
STARTUP = ICONS / "startup"
INDEX = ROOT / "index.html"

# The app's canvas colour in each theme: --paper in src/styles/tokens.css.
BACKGROUNDS = {"dark": (0, 0, 0), "light": (242, 242, 247)}

# iPhones that run a current iOS, by screen size in points and pixel ratio.
# A new iPhone with a new size gets a new line here.
IPHONES = [
    (375, 667, 2),  # SE (2nd and 3rd gen), 8
    (414, 736, 3),  # 8 Plus
    (375, 812, 3),  # X, XS, 11 Pro, 12 mini, 13 mini
    (414, 896, 2),  # XR, 11
    (414, 896, 3),  # XS Max, 11 Pro Max
    (390, 844, 3),  # 12, 13, 14, 16e
    (428, 926, 3),  # 12 Pro Max, 13 Pro Max, 14 Plus
    (393, 852, 3),  # 14 Pro, 15, 15 Pro, 16
    (430, 932, 3),  # 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
    (402, 874, 3),  # 16 Pro, 17, 17 Pro
    (420, 912, 3),  # Air
    (440, 956, 3),  # 16 Pro Max, 17 Pro Max
]

START_MARK = "<!-- startup-images:start (made by tools/app-icons/make_icons.py) -->"
END_MARK = "<!-- startup-images:end -->"


def rounded(image: Image.Image, radius_share: float = 0.225) -> Image.Image:
    """The picture with transparent rounded corners, like an app icon."""
    size = image.size[0]
    scale = 4  # draw the mask large, then shrink it, for smooth corners
    mask = Image.new("L", (size * scale, size * scale), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size * scale - 1, size * scale - 1), radius=int(size * scale * radius_share), fill=255
    )
    mask = mask.resize((size, size), Image.LANCZOS)
    result = image.convert("RGBA")
    result.putalpha(mask)
    return result


def icon(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.LANCZOS)


def startup_tags() -> list[list[str]]:
    tags = []
    for width, height, ratio in IPHONES:
        for theme in BACKGROUNDS:
            name = f"startup-{width * ratio}x{height * ratio}-{theme}.png"
            media = (
                f"(device-width: {width}px) and (device-height: {height}px) and "
                f"(-webkit-device-pixel-ratio: {ratio}) and (orientation: portrait) and "
                f"(prefers-color-scheme: {theme})"
            )
            # Laid out the way Prettier lays out long tags, so `npm run format`
            # and this script never undo each other.
            tags.append(
                [
                    "<link",
                    '  rel="apple-touch-startup-image"',
                    f'  media="{media}"',
                    f'  href="/icons/startup/{name}"',
                    "/>",
                ]
            )
    return tags


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    if source.size != (1024, 1024):
        raise SystemExit(f"{SOURCE.name} must be 1024 x 1024 (it is {source.size[0]} x {source.size[1]})")

    ICONS.mkdir(parents=True, exist_ok=True)
    icon(source, 180).save(ICONS / "apple-touch-icon.png", optimize=True)
    rounded(icon(source, 192)).save(ICONS / "icon-192.png", optimize=True)
    rounded(icon(source, 512)).save(ICONS / "icon-512.png", optimize=True)
    icon(source, 512).save(ICONS / "icon-maskable-512.png", optimize=True)

    STARTUP.mkdir(parents=True, exist_ok=True)
    for old in STARTUP.glob("startup-*.png"):
        old.unlink()
    for width, height, ratio in IPHONES:
        for theme, colour in BACKGROUNDS.items():
            name = f"startup-{width * ratio}x{height * ratio}-{theme}.png"
            # One colour, as a one-entry palette: a few KB instead of ~10 KB.
            plain = Image.new("P", (width * ratio, height * ratio), 0)
            plain.putpalette(list(colour))
            plain.save(STARTUP / name, optimize=True)

    html = INDEX.read_text(encoding="utf-8")
    newline = "\r\n" if "\r\n" in html else "\n"
    start, end = html.index(START_MARK), html.index(END_MARK)
    indent = "    "
    lines = [indent + line for tag in startup_tags() for line in tag]
    block = START_MARK + newline + newline.join(lines) + newline + indent + END_MARK
    INDEX.write_text(html[:start] + block + html[end + len(END_MARK):], encoding="utf-8")

    print(f"Icons in {ICONS.relative_to(ROOT)}, {len(IPHONES) * len(BACKGROUNDS)} launch screens, index.html updated.")


if __name__ == "__main__":
    main()
