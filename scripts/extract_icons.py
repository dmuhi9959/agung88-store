#!/usr/bin/env python3
"""
Robust APK icon extractor v2.

Strategy:
  1. Find mipmap-* images with launcher-icon filenames (ic_launcher, app_icon, etc.)
  2. Find drawable/ root images with icon/logo filenames
  3. Find the LARGEST SQUARE image (app icons are square)
     - Must be 64x64 to 512x512
     - Must have actual content (not all-transparent)
  4. Fall back to any image with content
"""
import io
import os
import zipfile

from PIL import Image

ICON_OUTPUT_SIZE = (192, 192)

ICON_NAME_PATTERNS = (
    'ic_launcher',
    'ic_app_icon',
    'app_icon',
    'ic_launcher_foreground',
    'ic_launcher_round',
    'logo',
    'icon',
)

EXCLUDE_PATTERNS = (
    'exo_', 'common_google', 'ic_mr_', 'notify_', 'notification_',
    'abc_', 'design_', 'material_', 'googleg_', 'firebase_', 'crash_',
    'screenshot', 'splash', '_bg.9', 'error_message_icon', 'placeholder',
    'banner', 'splash', 'background', 'header',
)


def is_image(name: str) -> bool:
    return name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))


def is_nine_patch(name: str) -> bool:
    return name.endswith('.9.png')


def is_excluded(name: str) -> bool:
    lower = name.lower()
    return any(p in lower for p in EXCLUDE_PATTERNS)


def get_image_info(zf: zipfile.ZipFile, name: str):
    """Return (width, height, has_content, file_size)."""
    try:
        info = zf.getinfo(name)
        with zf.open(name) as f:
            img = Image.open(io.BytesIO(f.read())).convert('RGBA')
        w, h = img.size
        # Check if image has actual non-transparent content
        alpha = img.getchannel('A')
        bbox = alpha.getbbox()
        has_content = bbox is not None
        # Also check if image isn't completely transparent
        if has_content:
            ext = img.crop(bbox)
            # Get pixel stats
            try:
                pixels = list(ext.getdata())
                if pixels:
                    # Check at least some pixels are non-zero
                    non_zero = sum(1 for p in pixels[:1000] if (p[0] + p[1] + p[2]) > 10)
                    if non_zero == 0:
                        has_content = False
            except Exception:
                pass
        return (w, h, has_content, info.file_size)
    except Exception:
        return (0, 0, False, 0)


def is_square(w: int, h: int, tolerance: float = 0.05) -> bool:
    if w == 0 or h == 0:
        return False
    ratio = w / h
    return (1 - tolerance) <= ratio <= (1 + tolerance)


def pick_best_icon(zf: zipfile.ZipFile, images):
    """Return best icon candidate name, or None."""
    if not images:
        return None

    # 1) mipmap with launcher filename
    for density in ('mipmap-xxxhdpi', 'mipmap-xxhdpi', 'mipmap-xhdpi',
                   'mipmap-hdpi', 'mipmap-mdpi', 'mipmap'):
        for pattern in ICON_NAME_PATTERNS:
            candidates = [
                n for n in images
                if f'res/{density}/' in n
                and pattern in n.lower()
                and not is_excluded(n)
                and not is_nine_patch(n)
            ]
            if candidates:
                # Filter for non-zero size
                valid = [(n, zf.getinfo(n).file_size) for n in candidates
                         if zf.getinfo(n).file_size > 0]
                if valid:
                    return max(valid, key=lambda x: x[1])[0]

    # 2) Any mipmap with launcher filename
    for pattern in ICON_NAME_PATTERNS:
        candidates = [
            n for n in images
            if 'mipmap' in n
            and pattern in n.lower()
            and not is_excluded(n)
            and not is_nine_patch(n)
        ]
        if candidates:
            valid = [(n, zf.getinfo(n).file_size) for n in candidates
                     if zf.getinfo(n).file_size > 0]
            if valid:
                return max(valid, key=lambda x: x[1])[0]

    # 3) drawable root with launcher filename
    for pattern in ICON_NAME_PATTERNS:
        candidates = [
            n for n in images
            if n.startswith('res/drawable/')
            and pattern in n.lower()
            and not is_excluded(n)
            and not is_nine_patch(n)
        ]
        if candidates:
            valid = [(n, zf.getinfo(n).file_size) for n in candidates
                     if zf.getinfo(n).file_size > 0]
            if valid:
                return max(valid, key=lambda x: x[1])[0]

    # 4) LARGEST SQUARE image with content (the new key strategy!)
    square_candidates = []
    for n in images:
        if not n.startswith('res/'):
            continue
        if is_excluded(n) or is_nine_patch(n):
            continue
        w, h, has_content, file_size = get_image_info(zf, n)
        if not has_content:
            continue
        # App icon range: 48x48 to 512x512, must be square
        if w < 48 or h < 48 or w > 768 or h > 768:
            continue
        if not is_square(w, h):
            continue
        # Score: prefer larger file size (more detailed)
        square_candidates.append((n, w, file_size))

    if square_candidates:
        # Sort by file size desc, prefer larger square images
        square_candidates.sort(key=lambda x: x[2], reverse=True)
        return square_candidates[0][0]

    # 5) Fallback: largest image with content (any shape)
    all_with_content = []
    for n in images:
        if not n.startswith('res/'):
            continue
        if is_excluded(n) or is_nine_patch(n):
            continue
        w, h, has_content, file_size = get_image_info(zf, n)
        if has_content and file_size > 1000:
            # Prefer closer to square
            ratio = min(w, h) / max(w, h) if max(w, h) > 0 else 0
            # Score combines file_size and squareness
            score = file_size * ratio
            all_with_content.append((n, w, h, file_size, ratio, score))
    if all_with_content:
        all_with_content.sort(key=lambda x: x[5], reverse=True)
        return all_with_content[0][0]

    return None


def extract_icon(apk_path: str, output_path: str) -> bool:
    print(f'\n--- Extracting: {os.path.basename(apk_path)}')
    if not os.path.exists(apk_path):
        print(f'  APK not found')
        return False
    try:
        with zipfile.ZipFile(apk_path) as zf:
            images = [n for n in zf.namelist()
                       if is_image(n) and not is_nine_patch(n)]
            if not images:
                print(f'  No images found in APK')
                return False
            best = pick_best_icon(zf, images)
            if not best:
                print(f'  No icon candidate found')
                return False
            info = zf.getinfo(best)
            with zf.open(best) as f:
                img = Image.open(io.BytesIO(f.read())).convert('RGBA')
            print(f'  Selected: {best} ({img.width}x{img.height}, {info.file_size} bytes)')

            # Smart resize: cover-fit into 192x192 with transparent background
            canvas = Image.new('RGBA', ICON_OUTPUT_SIZE, (0, 0, 0, 0))
            ratio = max(ICON_OUTPUT_SIZE[0] / img.width,
                        ICON_OUTPUT_SIZE[1] / img.height)
            new_size = (max(1, int(img.width * ratio)),
                       max(1, int(img.height * ratio)))
            img_resized = img.resize(new_size, Image.LANCZOS)
            # Crop center if larger than target
            if img_resized.width > ICON_OUTPUT_SIZE[0]:
                left = (img_resized.width - ICON_OUTPUT_SIZE[0]) // 2
                img_resized = img_resized.crop((left, 0,
                    left + ICON_OUTPUT_SIZE[0], img_resized.height))
            if img_resized.height > ICON_OUTPUT_SIZE[1]:
                top = (img_resized.height - ICON_OUTPUT_SIZE[1]) // 2
                img_resized = img_resized.crop((0, top,
                    img_resized.width, top + ICON_OUTPUT_SIZE[1]))
            # Center paste (in case it's smaller)
            offset = ((ICON_OUTPUT_SIZE[0] - img_resized.width) // 2,
                      (ICON_OUTPUT_SIZE[1] - img_resized.height) // 2)
            canvas.paste(img_resized, offset, img_resized)
            canvas.save(output_path, 'PNG')
            print(f'  Saved: {os.path.basename(output_path)} ({os.path.getsize(output_path)} bytes)')
            return True
    except Exception as e:
        print(f'  ERROR: {e}')
        import traceback
        traceback.print_exc()
        return False


def main():
    mods_dir = '/home/z/my-project/public/uploads/mods'
    icons_dir = '/home/z/my-project/public/uploads/icons'
    os.makedirs(icons_dir, exist_ok=True)

    broken_threshold = 5000
    targets = []

    for f in sorted(os.listdir(mods_dir)):
        if not f.endswith('.apk'):
            continue
        apk_path = os.path.join(mods_dir, f)
        icon_name = f.replace('.apk', '-icon.png')
        icon_path = os.path.join(icons_dir, icon_name)

        if not os.path.exists(icon_path):
            targets.append((apk_path, icon_path))
            print(f'Missing: {f}')
        elif os.path.getsize(icon_path) < broken_threshold:
            targets.append((apk_path, icon_path))
            print(f'Broken ({os.path.getsize(icon_path)}b): {f}')

    if not targets:
        print('All icons healthy.')
        return

    print(f'\nExtracting {len(targets)} icons...')
    success = 0
    failed = []
    for apk_path, icon_path in targets:
        if extract_icon(apk_path, icon_path):
            success += 1
        else:
            failed.append(os.path.basename(apk_path))

    print(f'\n=== Summary ===')
    print(f'Success: {success}/{len(targets)}')
    if failed:
        print(f'Failed: {failed}')


if __name__ == '__main__':
    main()
