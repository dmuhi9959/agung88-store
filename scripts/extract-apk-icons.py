#!/usr/bin/env python3
"""
Extract launcher icon dari file APK dan simpan sebagai PNG.
Update database iconUrl supaya card APK menampilkan icon asli.
"""

import os
import subprocess
import zipfile
import shutil
import sqlite3
from PIL import Image
import io

ANDROID_HOME = os.path.expanduser('~/android-sdk')
AAPT2 = os.path.join(ANDROID_HOME, 'build-tools', '34.0.0', 'aapt2')
DB_PATH = '/home/z/my-project/db/custom.db'
ICONS_DIR = '/home/z/my-project/public/uploads/icons'

# APK files di upload folder
APKS = [
    {
        'name': 'RBTV+',
        'source': '/home/z/my-project/public/uploads/mods/rbtv-v3.0.323.apk',
        'output': 'rbtv-icon.png',
    },
    {
        'name': 'MovieBox TV',
        'source': '/home/z/my-project/public/uploads/mods/moviebox-tv-v1.1.11.apk',
        'output': 'moviebox-tv-icon.png',
    },
    {
        'name': 'VORX TV',
        'source': '/home/z/my-project/public/uploads/mods/vorx-tv-v1.23.apk',
        'output': 'vorx-tv-icon.png',
    },
]

def find_launcher_icon(apk_path):
    """Cari path launcher icon di APK dengan aapt2.
    Kalau yang ketemu adaptive icon (XML), cari PNG alternatif di mipmap densities."""
    try:
        result = subprocess.run(
            [AAPT2, 'dump', 'badging', apk_path],
            capture_output=True, text=True, timeout=30
        )
        # Cari baris application-icon-<density>
        icons = []
        for line in result.stdout.split('\n'):
            if line.startswith('application-icon-'):
                parts = line.split(':', 1)
                if len(parts) == 2:
                    density = parts[0].replace('application-icon-', '')
                    icon_path = parts[1].strip().strip("'")
                    icons.append((density, icon_path))
        
        # Filter icon yang bukan XML (PNG/webp)
        png_icons = [(d, p) for d, p in icons if not p.endswith('.xml')]
        
        # Pilih density tertinggi yang PNG
        priority = ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi']
        for p in priority:
            for d, path in png_icons:
                if d == p:
                    return path
        
        # Kalau semua XML, cari foreground di mipmap-xxxhdpi (bukan anydpi)
        with zipfile.ZipFile(apk_path, 'r') as zf:
            all_files = zf.namelist()
            # Cari ic_launcher_foreground.png/webp atau ic_launcher.png/webp atau banner_launcher.webp
            candidates = []
            for f in all_files:
                if (f.endswith('.png') or f.endswith('.webp')) and (
                    'ic_launcher_foreground' in f or 
                    'ic_launcher' in f or 
                    'banner_launcher' in f or
                    'itachi_launcher' in f
                ):
                    # Skip anydpi (XML)
                    if 'anydpi' not in f:
                        candidates.append(f)
            
            # Pilih yang density tertinggi
            for density in ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi']:
                for c in candidates:
                    if density in c:
                        return c
            
            # Fallback: PNG/WEBP pertama yang ketemu
            if candidates:
                return candidates[0]
        
        # Kalau tetap tidak ketemu, return XML pertama (akan gagal extract)
        if icons:
            return icons[0][1]
        return None
    except Exception as e:
        print(f'  ✗ Error finding icon: {e}')
        return None

def extract_icon_from_apk(apk_path, icon_in_apk, output_path):
    """Extract icon dari APK dan convert ke PNG 192x192"""
    if not icon_in_apk:
        print('  ✗ Icon tidak ditemukan di APK')
        return False
    try:
        with zipfile.ZipFile(apk_path, 'r') as zf:
            # Baca file icon
            with zf.open(icon_in_apk) as f:
                icon_data = f.read()
        
        # Load dengan PIL
        img = Image.open(io.BytesIO(icon_data))
        # Convert ke RGBA supaya bisa handle transparan
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Resize ke 192x192 (maintain aspect, pad transparan)
        size = 192
        src = img.copy()
        src.thumbnail((size, size), Image.LANCZOS)
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        offset = ((size - src.width) // 2, (size - src.height) // 2)
        canvas.paste(src, offset, src)
        canvas.save(output_path, 'PNG', optimize=True)
        
        # Verifikasi file
        if os.path.exists(output_path):
            size_bytes = os.path.getsize(output_path)
            print(f'  ✓ Saved: {output_path} ({size_bytes} bytes)')
            return True
        return False
    except Exception as e:
        print(f'  ✗ Error extracting: {e}')
        return False

def update_database_icon(name, icon_url):
    """Update iconUrl di database untuk APK dengan nama tertentu"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE Mod SET iconUrl = ? WHERE name = ?",
            (icon_url, name)
        )
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        return affected > 0
    except Exception as e:
        print(f'  ✗ DB Error: {e}')
        return False

def main():
    print('🚀 Extracting icons dari APK files...\n')
    
    # Ensure icons dir exists
    os.makedirs(ICONS_DIR, exist_ok=True)
    
    for apk in APKS:
        print(f'━━━ {apk["name"]} ━━━')
        print(f'  APK: {apk["source"]}')
        
        if not os.path.exists(apk['source']):
            print(f'  ✗ APK file tidak ditemukan')
            continue
        
        # Find launcher icon
        icon_in_apk = find_launcher_icon(apk['source'])
        print(f'  Icon in APK: {icon_in_apk or "(not found)"}')
        
        if not icon_in_apk:
            continue
        
        # Extract
        output_path = os.path.join(ICONS_DIR, apk['output'])
        success = extract_icon_from_apk(apk['source'], icon_in_apk, output_path)
        
        if success:
            # Update database
            icon_url = f'/uploads/icons/{apk["output"]}'
            db_updated = update_database_icon(apk['name'], icon_url)
            if db_updated:
                print(f'  ✓ DB updated: iconUrl = {icon_url}')
            else:
                print(f'  ✗ DB tidak terupdate')
        print()
    
    # Summary
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print('📊 Status iconUrl di database:')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT name, iconUrl FROM Mod")
        for name, icon_url in cursor.fetchall():
            status = '✓' if icon_url else '✗'
            print(f'  {status} {name}: {icon_url or "(kosong)"}')
        conn.close()
    except Exception as e:
        print(f'  DB error: {e}')

if __name__ == '__main__':
    main()
