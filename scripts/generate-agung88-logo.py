#!/usr/bin/env python3
"""Generate logo AGUNG88 baru - ganti logo lama JASA ROOT"""

from PIL import Image, ImageDraw, ImageFont
import os

size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background gradient emerald-to-teal
for y in range(size):
    for x in range(size):
        t = (x + y) / (2 * size)
        r = int(16 * (1-t) + 13 * t)
        g = int(185 * (1-t) + 148 * t)
        b = int(129 * (1-t) + 136 * t)
        img.putpixel((x, y), (r, g, b, 255))

# Font
try:
    font_large = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 160)
    font_small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 50)
except:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()

# Text "A88" di tengah
text = "A88"
bbox = draw.textbbox((0, 0), text, font=font_large)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
draw.text(((size-tw)//2, (size-th)//2 - 30), text, fill=(255, 255, 255), font=font_large)

# Text "STORE" di bawah
text2 = "STORE"
bbox2 = draw.textbbox((0, 0), text2, font=font_small)
tw2 = bbox2[2] - bbox2[0]
draw.text(((size-tw2)//2, (size-th)//2 + 120), text2, fill=(255, 255, 255), font=font_small)

# Save logo.png
img.save('/home/z/my-project/public/logo.png', 'PNG', optimize=True)
print(f"Logo AGUNG88: {os.path.getsize('/home/z/my-project/public/logo.png')} bytes")

# Generate semua icon sizes
icon_sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512]
for s in icon_sizes:
    icon = img.copy()
    icon.thumbnail((s, s), Image.LANCZOS)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    offset = ((s - icon.width) // 2, (s - icon.height) // 2)
    canvas.paste(icon, offset, icon)
    canvas.save(f'/home/z/my-project/public/icons/icon-{s}x{s}.png', 'PNG', optimize=True)

# Maskable
for s in [192, 512]:
    icon = img.copy()
    icon.thumbnail((int(s * 0.75), int(s * 0.75)), Image.LANCZOS)
    canvas = Image.new('RGBA', (s, s), (16, 185, 129, 255))
    offset = ((s - icon.width) // 2, (s - icon.height) // 2)
    canvas.paste(icon, offset, icon)
    canvas.save(f'/home/z/my-project/public/icons/icon-{s}x{s}-maskable.png', 'PNG', optimize=True)

# Apple touch icon
icon = img.copy()
icon.thumbnail((180, 180), Image.LANCZOS)
canvas = Image.new('RGBA', (180, 180), (0, 0, 0, 0))
offset = ((180 - icon.width) // 2, (180 - icon.height) // 2)
canvas.paste(icon, offset, icon)
canvas.save('/home/z/my-project/public/icons/icon-apple-touch-icon.png', 'PNG', optimize=True)

# Copy icon ke Android project (mipmap)
for density, s in [('mipmap-mdpi', 48), ('mipmap-hdpi', 72), ('mipmap-xhdpi', 96), ('mipmap-xxhdpi', 144), ('mipmap-xxxhdpi', 192)]:
    icon = img.copy()
    icon.thumbnail((s, s), Image.LANCZOS)
    canvas = Image.new('RGBA', (s, s), (16, 185, 129, 255))
    offset = ((s - icon.width) // 2, (s - icon.height) // 2)
    canvas.paste(icon, offset, icon)
    for project in ['stb-mod-store-android-project', 'stb-mod-store-admin-project']:
        path = f'/home/z/my-project/download/{project}/app/src/main/res/{density}/ic_launcher.png'
        canvas.save(path, 'PNG', optimize=True)
        canvas.save(path.replace('ic_launcher.png', 'ic_launcher_round.png'), 'PNG', optimize=True)
        canvas.save(path.replace('ic_launcher.png', 'ic_launcher_foreground.png'), 'PNG', optimize=True)

print("Semua icon AGUNG88 ter-generate!")
