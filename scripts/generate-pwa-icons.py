#!/usr/bin/env python3
"""
Generate PWA icons dari SVG/gradient yang sesuai dengan brand STB Mod Store.
Output: icons berbagai ukuran di /home/z/my-project/public/icons/
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

OUTPUT_DIR = '/home/z/my-project/public/icons'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Brand colors (emerald/teal gradient)
COLOR_PRIMARY = (16, 185, 129)       # emerald-500
COLOR_SECONDARY = (13, 148, 136)    # teal-600
COLOR_DARK = (6, 78, 59)             # emerald-900
COLOR_WHITE = (255, 255, 255)
COLOR_LIGHT = (236, 253, 245)        # emerald-50

def make_gradient(size, maskable=False):
    """Buat background gradient emerald ke teal."""
    img = Image.new('RGB', (size, size), COLOR_PRIMARY)
    pixels = img.load()
    # Diagonal gradient
    for y in range(size):
        for x in range(size):
            # Calculate gradient position (diagonal)
            t = (x + y) / (2 * size)
            r = int(COLOR_PRIMARY[0] * (1 - t) + COLOR_SECONDARY[0] * t)
            g = int(COLOR_PRIMARY[1] * (1 - t) + COLOR_SECONDARY[1] * t)
            b = int(COLOR_PRIMARY[2] * (1 - t) + COLOR_SECONDARY[2] * t)
            pixels[x, y] = (r, g, b)
    return img

def draw_cpu_icon(img, size, padding_ratio=0.25):
    """Gambar icon CPU/chip bergaya di tengah gambar."""
    draw = ImageDraw.Draw(img, 'RGBA')
    cx, cy = size // 2, size // 2
    icon_size = int(size * (1 - 2 * padding_ratio))
    half = icon_size // 2

    # Outer rounded rect (chip body)
    chip_x0 = cx - half
    chip_y0 = cy - half
    chip_x1 = cx + half
    chip_y1 = cy + half
    chip_radius = max(4, icon_size // 12)

    # Shadow
    shadow_offset = max(2, size // 64)
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        [chip_x0 + shadow_offset, chip_y0 + shadow_offset,
         chip_x1 + shadow_offset, chip_y1 + shadow_offset],
        radius=chip_radius, fill=(0, 0, 0, 80)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, size // 64)))
    img.paste(shadow, (0, 0), shadow)

    # Chip body
    draw.rounded_rectangle(
        [chip_x0, chip_y0, chip_x1, chip_y1],
        radius=chip_radius, fill=COLOR_WHITE
    )

    # Pins (small rectangles around chip)
    pin_count = 5
    pin_length = max(2, size // 40)
    pin_width = max(3, size // 30)
    pin_spacing = icon_size // (pin_count + 1)
    pin_color = COLOR_DARK

    for i in range(pin_count):
        offset = (i + 1) * pin_spacing - pin_width // 2
        # Top
        draw.rounded_rectangle(
            [cx - half + offset, chip_y0 - pin_length,
             cx - half + offset + pin_width, chip_y0],
            radius=max(1, pin_width // 3), fill=pin_color
        )
        # Bottom
        draw.rounded_rectangle(
            [cx - half + offset, chip_y1,
             cx - half + offset + pin_width, chip_y1 + pin_length],
            radius=max(1, pin_width // 3), fill=pin_color
        )
        # Left
        draw.rounded_rectangle(
            [chip_x0 - pin_length, cy - half + offset,
             chip_x0, cy - half + offset + pin_width],
            radius=max(1, pin_width // 3), fill=pin_color
        )
        # Right
        draw.rounded_rectangle(
            [chip_x1, cy - half + offset,
             chip_x1 + pin_length, cy - half + offset + pin_width],
            radius=max(1, pin_width // 3), fill=pin_color
        )

    # Inner square (CPU die)
    inner_margin = icon_size // 4
    inner_x0 = chip_x0 + inner_margin
    inner_y0 = chip_y0 + inner_margin
    inner_x1 = chip_x1 - inner_margin
    inner_y1 = chip_y1 - inner_margin
    draw.rounded_rectangle(
        [inner_x0, inner_y0, inner_x1, inner_y1],
        radius=max(2, icon_size // 16), fill=COLOR_PRIMARY
    )

    # Inner highlight dot (LED)
    dot_size = max(2, icon_size // 24)
    draw.ellipse(
        [inner_x0 + (inner_x1 - inner_x0) // 2 - dot_size,
         inner_y0 + (inner_y1 - inner_y0) // 2 - dot_size,
         inner_x0 + (inner_x1 - inner_x0) // 2 + dot_size,
         inner_y0 + (inner_y1 - inner_y0) // 2 + dot_size],
        fill=COLOR_LIGHT
    )

def draw_app_name(img, size):
    """Gambar text 'STB' di bawah icon CPU."""
    draw = ImageDraw.Draw(img, 'RGBA')
    # Try system fonts
    font_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    ]
    font = None
    font_size = max(8, size // 6)
    for fp in font_paths:
        try:
            font = ImageFont.truetype(fp, font_size)
            break
        except:
            continue
    if not font:
        font = ImageFont.load_default()

    text = 'STB'
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) // 2
    y = size - text_h - max(4, size // 24)
    draw.text((x, y), text, font=font, fill=COLOR_WHITE)

def generate_icon(size, maskable=False, with_text=False):
    """Generate satu icon dengan ukuran tertentu."""
    img = make_gradient(size, maskable)
    draw_cpu_icon(img, size, padding_ratio=0.28 if maskable else 0.22)
    if with_text and size >= 192:
        draw_app_name(img, size)
    return img

# Generate berbagai ukuran
icons_to_generate = [
    # (size, maskable, with_text, suffix)
    (72, False, False, '72x72'),
    (96, False, False, '96x96'),
    (128, False, False, '128x128'),
    (144, False, False, '144x144'),
    (152, False, False, '152x152'),
    (192, False, True, '192x192'),
    (256, False, True, '256x256'),
    (384, False, True, '384x384'),
    (512, False, True, '512x512'),
    (192, True, True, '192x192-maskable'),
    (512, True, True, '512x512-maskable'),
    # Apple touch icon
    (180, False, False, 'apple-touch-icon'),
    # Favicon
    (32, False, False, 'favicon-32'),
    (16, False, False, 'favicon-16'),
    # Monochrome for status bar
    (512, False, False, 'monochrome-512'),
]

print('Generating PWA icons...')
for size, maskable, with_text, suffix in icons_to_generate:
    img = generate_icon(size, maskable=maskable, with_text=with_text)
    out_path = os.path.join(OUTPUT_DIR, f'icon-{suffix}.png')
    img.save(out_path, 'PNG', optimize=True)
    print(f'  ✓ {out_path} ({size}x{size})')

# Also save a favicon.ico (multi-res)
favicon_sizes = [16, 32, 48, 64]
favicon_imgs = [generate_icon(s, maskable=False, with_text=False) for s in favicon_sizes]
favicon_path = os.path.join(OUTPUT_DIR, 'favicon.ico')
favicon_imgs[0].save(
    favicon_path,
    format='ICO',
    sizes=[(s, s) for s in favicon_sizes],
    append_images=favicon_imgs[1:]
)
print(f'  ✓ {favicon_path} (ICO multi-res)')

# Generate monochrome version (silhouette)
def make_monochrome(size):
    img = Image.new('L', (size, size), 255)
    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2
    icon_size = int(size * 0.56)
    half = icon_size // 2
    draw.rounded_rectangle(
        [cx - half, cy - half, cx + half, cy + half],
        radius=max(4, icon_size // 12), fill=20
    )
    inner_margin = icon_size // 4
    draw.rounded_rectangle(
        [cx - half + inner_margin, cy - half + inner_margin,
         cx + half - inner_margin, cy + half - inner_margin],
        radius=max(2, icon_size // 16), fill=255
    )
    return img

mono = make_monochrome(512)
mono.save(os.path.join(OUTPUT_DIR, 'icon-monochrome-512.png'), 'PNG')
print(f'  ✓ {os.path.join(OUTPUT_DIR, "icon-monochrome-512.png")} (monochrome)')

# Generate splash screen image (large landscape)
splash_w, splash_h = 1920, 1080
splash = Image.new('RGB', (splash_w, splash_h), COLOR_DARK)
# Add gradient
pixels = splash.load()
for y in range(splash_h):
    for x in range(splash_w):
        t = (x / splash_w + y / splash_h) / 2
        r = int(COLOR_DARK[0] * (1 - t) + COLOR_PRIMARY[0] * t)
        g = int(COLOR_DARK[1] * (1 - t) + COLOR_PRIMARY[1] * t)
        b = int(COLOR_DARK[2] * (1 - t) + COLOR_PRIMARY[2] * t)
        pixels[x, y] = (r, g, b)

# Add icon in center
icon_512 = generate_icon(512, maskable=False, with_text=True)
splash.paste(icon_512, ((splash_w - 512) // 2, (splash_h - 512) // 2 - 100), icon_512.convert('RGBA'))

splash.save(os.path.join(OUTPUT_DIR, 'splash-1920x1080.png'), 'PNG')
print(f'  ✓ {os.path.join(OUTPUT_DIR, "splash-1920x1080.png")} (splash screen)')

print('\n✅ Semua icon PWA berhasil dibuat!')
print(f'📁 Lokasi: {OUTPUT_DIR}')
