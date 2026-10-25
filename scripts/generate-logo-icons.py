#!/usr/bin/env python3
"""
Generate semua ukuran icon (PWA + Android mipmap) dari logo JASA ROOT CIKAMPEK.
Output:
- /public/icons/ (PWA icons - 16px s/d 512px + favicon.ico)
- /download/stb-mod-store-android-project/app/src/main/res/mipmap-*/ (5 densities untuk Android)
"""

import os
import shutil
from PIL import Image, ImageDraw

LOGO_SOURCE = '/home/z/my-project/upload/pasted_image_1792910433844.png'
PWA_DIR = '/home/z/my-project/public/icons'
ANDROID_RES_DIR = '/home/z/my-project/download/stb-mod-store-android-project/app/src/main/res'

# Brand color (hijau emerald sesuai tema)
BRAND_BG_DARK = (6, 78, 59)  # emerald-900

def load_logo():
    """Load logo source sebagai RGBA"""
    img = Image.open(LOGO_SOURCE).convert('RGBA')
    return img

def make_square_logo(size):
    """Resize logo ke size x size, keep aspect ratio dengan padding transparan"""
    src = load_logo()
    # Resize dengan maintain aspect ratio
    src.thumbnail((size, size), Image.LANCZOS)
    
    # Buat canvas transparan
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # Paste di tengah
    offset = ((size - src.width) // 2, (size - src.height) // 2)
    canvas.paste(src, offset, src)
    return canvas

def make_square_logo_with_bg(size, bg_color=BRAND_BG_DARK):
    """Resize logo ke size x size dengan background solid (untuk mipmap Android)"""
    src = load_logo()
    src.thumbnail((int(size * 0.85), int(size * 0.85)), Image.LANCZOS)
    
    # Buat canvas dengan background dark
    canvas = Image.new('RGBA', (size, size), bg_color + (255,))
    offset = ((size - src.width) // 2, (size - src.height) // 2)
    canvas.paste(src, offset, src)
    return canvas

def generate_pwa_icons():
    """Generate PWA icons semua ukuran"""
    print('Generating PWA icons...')
    os.makedirs(PWA_DIR, exist_ok=True)
    
    # Backup old icons (rename folder)
    backup_dir = PWA_DIR + '_old'
    if os.path.exists(PWA_DIR) and not os.path.exists(backup_dir):
        os.rename(PWA_DIR, backup_dir)
        os.makedirs(PWA_DIR, exist_ok=True)
        # Copy favicon.ico dari backup kalau ada (atau regenerate)
        if os.path.exists(backup_dir + '/favicon.ico'):
            shutil.copy2(backup_dir + '/favicon.ico', PWA_DIR + '/favicon.ico')
    
    # Generate semua ukuran PWA
    pwa_sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512]
    
    for size in pwa_sizes:
        icon = make_square_logo(size)
        out_path = os.path.join(PWA_DIR, f'icon-{size}x{size}.png')
        icon.save(out_path, 'PNG', optimize=True)
        print(f'  ✓ {out_path}')
    
    # Maskable (background penuh untuk adaptive)
    for size in [192, 512]:
        # Logo dengan padding lebih besar (80% dari canvas) supaya safe zone
        src = load_logo()
        src.thumbnail((int(size * 0.75), int(size * 0.75)), Image.LANCZOS)
        canvas = Image.new('RGBA', (size, size), BRAND_BG_DARK + (255,))
        offset = ((size - src.width) // 2, (size - src.height) // 2)
        canvas.paste(src, offset, src)
        out_path = os.path.join(PWA_DIR, f'icon-{size}x{size}-maskable.png')
        canvas.save(out_path, 'PNG', optimize=True)
        print(f'  ✓ {out_path} (maskable)')
    
    # Apple touch icon
    apple = make_square_logo(180)
    apple.save(os.path.join(PWA_DIR, 'icon-apple-touch-icon.png'), 'PNG', optimize=True)
    print(f'  ✓ apple-touch-icon')
    
    # Monochrome (untuk status bar)
    mono = load_logo().convert('L')
    mono.thumbnail((512, 512), Image.LANCZOS)
    canvas = Image.new('L', (512, 512), 255)
    offset = ((512 - mono.width) // 2, (512 - mono.height) // 2)
    canvas.paste(mono, offset)
    canvas.save(os.path.join(PWA_DIR, 'icon-monochrome-512.png'), 'PNG', optimize=True)
    print(f'  ✓ monochrome-512')
    
    # Favicon.ico (multi-res)
    fav_imgs = [make_square_logo(s) for s in [16, 32, 48]]
    fav_imgs[0].save(
        os.path.join(PWA_DIR, 'favicon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=fav_imgs[1:]
    )
    print(f'  ✓ favicon.ico')

def generate_android_mipmap():
    """Generate mipmap icons untuk Android project (5 densities)"""
    print('\nGenerating Android mipmap icons...')
    
    # Density mapping: folder name -> size
    densities = [
        ('mipmap-mdpi', 48),     # 48x48
        ('mipmap-hdpi', 72),     # 72x72
        ('mipmap-xhdpi', 96),    # 96x96
        ('mipmap-xxhdpi', 144),  # 144x144
        ('mipmap-xxxhdpi', 192), # 192x192
    ]
    
    for folder, size in densities:
        out_dir = os.path.join(ANDROID_RES_DIR, folder)
        os.makedirs(out_dir, exist_ok=True)
        
        # ic_launcher (dengan background)
        launcher = make_square_logo_with_bg(size)
        launcher.save(os.path.join(out_dir, 'ic_launcher.png'), 'PNG', optimize=True)
        
        # ic_launcher_round (sama, tapi Android otomatis crop circle)
        launcher.save(os.path.join(out_dir, 'ic_launcher_round.png'), 'PNG', optimize=True)
        
        # ic_launcher_foreground (untuk adaptive icon, logo tanpa bg)
        fg = make_square_logo(size)
        fg.save(os.path.join(out_dir, 'ic_launcher_foreground.png'), 'PNG', optimize=True)
        
        print(f'  ✓ {folder}/ic_launcher.png ({size}x{size})')
        print(f'  ✓ {folder}/ic_launcher_round.png ({size}x{size})')
        print(f'  ✓ {folder}/ic_launcher_foreground.png ({size}x{size})')

def copy_original_logo():
    """Copy original logo ke folder public (untuk dipakai di web header)"""
    print('\nCopying original logo...')
    os.makedirs('/home/z/my-project/public', exist_ok=True)
    
    # Copy as logo.png (untuk dipakai di header)
    shutil.copy2(LOGO_SOURCE, '/home/z/my-project/public/logo.png')
    print(f'  ✓ /home/z/my-project/public/logo.png')
    
    # Juga copy ke /public/icons/logo-original.png
    shutil.copy2(LOGO_SOURCE, '/home/z/my-project/public/icons/logo-original.png')
    print(f'  ✓ /home/z/my-project/public/icons/logo-original.png')

def main():
    print(f'Source logo: {LOGO_SOURCE}')
    print(f'Dimension: 1254x1254 PNG')
    print()
    
    # Verify source exists
    if not os.path.exists(LOGO_SOURCE):
        print(f'❌ Source logo tidak ditemukan!')
        return
    
    # Generate semua
    copy_original_logo()
    generate_pwa_icons()
    generate_android_mipmap()
    
    print('\n' + '='*50)
    print('✅ Semua icon berhasil digenerate!')
    print('='*50)
    print()
    print('Lokasi output:')
    print(f'  PWA icons:     {PWA_DIR}/')
    print(f'  Android mipmap: {ANDROID_RES_DIR}/mipmap-*/')
    print()
    print('Langkah selanjutnya:')
    print('  1. Rebuild APK store: cd download/stb-mod-store-android-project && ./gradlew assembleDebug')
    print('  2. Copy APK baru ke folder download')

if __name__ == '__main__':
    main()
