#!/usr/bin/env python3
"""Extract icon from a single APK file and save as PNG.

Usage: python3 extract_single_icon.py <apk_path> <output_png_path>
"""
import io
import os
import sys
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
    'banner', 'header', 'background',
)


def is_image(name):
    return name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))


def is_nine_patch(name):
    return name.endswith('.9.png')


def is_excluded(name):
    lower = name.lower()
    return any(p in lower for p in EXCLUDE_PATTERNS)


def get_image_info(zf, name):
    try:
        info = zf.getinfo(name)
        with zf.open(name) as f:
            img = Image.open(io.BytesIO(f.read())).convert('RGBA')
        w, h = img.size
        alpha = img.getchannel('A')
        bbox = alpha.getbbox()
        has_content = bbox is not None
        if has_content:
            pixels = list(img.crop(bbox).getdata())[:1000]
            if pixels and all((p[0] + p[1] + p[2]) < 10 for p in pixels):
                has_content = False
        return (w, h, has_content, info.file_size)
    except Exception:
        return (0, 0, False, 0)


def is_square(w, h, tol=0.05):
    if w == 0 or h == 0:
        return False
    ratio = w / h
    return (1 - tol) <= ratio <= (1 + tol)


def pick_best_icon(zf, images):
    if not images:
        return None
    # 1) mipmap-* with launcher filename
    for density in ('mipmap-xxxhdpi', 'mipmap-xxhdpi', 'mipmap-xhdpi',
                    'mipmap-hdpi', 'mipmap-mdpi', 'mipmap'):
        for pattern in ICON_NAME_PATTERNS:
            candidates = [n for n in images
                          if f'res/{density}/' in n
                          and pattern in n.lower()
                          and not is_excluded(n)
                          and not is_nine_patch(n)]
            if candidates:
                valid = [(n, zf.getinfo(n).file_size) for n in candidates
                         if zf.getinfo(n).file_size > 0]
                if valid:
                    return max(valid, key=lambda x: x[1])[0]
    # 2) any mipmap with launcher filename
    for pattern in ICON_NAME_PATTERNS:
        candidates = [n for n in images
                      if 'mipmap' in n
                      and pattern in n.lower()
                      and not is_excluded(n)
                      and not is_nine_patch(n)]
        if candidates:
            valid = [(n, zf.getinfo(n).file_size) for n in candidates
                     if zf.getinfo(n).file_size > 0]
            if valid:
                return max(valid, key=lambda x: x[1])[0]
    # 3) drawable root with launcher filename
    for pattern in ICON_NAME_PATTERNS:
        candidates = [n for n in images
                      if n.startswith('res/drawable/')
                      and pattern in n.lower()
                      and not is_excluded(n)
                      and not is_nine_patch(n)]
        if candidates:
            valid = [(n, zf.getinfo(n).file_size) for n in candidates
                     if zf.getinfo(n).file_size > 0]
            if valid:
                return max(valid, key=lambda x: x[1])[0]
    # 4) Largest SQUARE image with content
    square_candidates = []
    for n in images:
        if not n.startswith('res/'):
            continue
        if is_excluded(n) or is_nine_patch(n):
            continue
        w, h, has_content, file_size = get_image_info(zf, n)
        if not has_content:
            continue
        if w < 48 or h < 48 or w > 768 or h > 768:
            continue
        if not is_square(w, h):
            continue
        square_candidates.append((n, w, file_size))
    if square_candidates:
        square_candidates.sort(key=lambda x: x[2], reverse=True)
        return square_candidates[0][0]
    # 5) Largest image with content (any shape)
    all_with_content = []
    for n in images:
        if not n.startswith('res/'):
            continue
        if is_excluded(n) or is_nine_patch(n):
            continue
        w, h, has_content, file_size = get_image_info(zf, n)
        if has_content and file_size > 1000:
            ratio = min(w, h) / max(w, h) if max(w, h) > 0 else 0
            score = file_size * ratio
            all_with_content.append((n, w, h, file_size, ratio, score))
    if all_with_content:
        all_with_content.sort(key=lambda x: x[5], reverse=True)
        return all_with_content[0][0]
    return None


def extract_icon(apk_path, output_path):
    if not os.path.exists(apk_path):
        print(f'APK not found: {apk_path}', file=sys.stderr)
        return False
    try:
        with zipfile.ZipFile(apk_path) as zf:
            images = [n for n in zf.namelist()
                      if is_image(n) and not is_nine_patch(n)]
            if not images:
                print('No images found', file=sys.stderr)
                return False
            best = pick_best_icon(zf, images)
            if not best:
                print('No icon candidate found', file=sys.stderr)
                return False
            with zf.open(best) as f:
                img = Image.open(io.BytesIO(f.read())).convert('RGBA')
            canvas = Image.new('RGBA', ICON_OUTPUT_SIZE, (0, 0, 0, 0))
            ratio = max(ICON_OUTPUT_SIZE[0] / img.width,
                        ICON_OUTPUT_SIZE[1] / img.height)
            new_size = (max(1, int(img.width * ratio)),
                        max(1, int(img.height * ratio)))
            img_resized = img.resize(new_size, Image.LANCZOS)
            if img_resized.width > ICON_OUTPUT_SIZE[0]:
                left = (img_resized.width - ICON_OUTPUT_SIZE[0]) // 2
                img_resized = img_resized.crop((left, 0,
                    left + ICON_OUTPUT_SIZE[0], img_resized.height))
            if img_resized.height > ICON_OUTPUT_SIZE[1]:
                top = (img_resized.height - ICON_OUTPUT_SIZE[1]) // 2
                img_resized = img_resized.crop((0, top,
                    img_resized.width, top + ICON_OUTPUT_SIZE[1]))
            offset = ((ICON_OUTPUT_SIZE[0] - img_resized.width) // 2,
                      (ICON_OUTPUT_SIZE[1] - img_resized.height) // 2)
            canvas.paste(img_resized, offset, img_resized)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            canvas.save(output_path, 'PNG')
            print(f'Icon saved: {output_path} ({os.path.getsize(output_path)}b)')
            return True
    except Exception as e:
        print(f'ERROR: {e}', file=sys.stderr)
        return False


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: extract_single_icon.py <apk_path> <output_png>', file=sys.stderr)
        sys.exit(1)
    success = extract_icon(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)
