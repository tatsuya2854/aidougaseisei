#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
The ending: the generated "?" product shot (handoff/clips/08.mp4, or its seed
plate when no clip exists) plays for HOLD_Q seconds, a flash hits, and the real
illustrator bottle (assets/src/product_clean.png) is composited over the "?"
bottle, pixel-for-pixel, only uniformly scaled and placed. Nothing about the
illustration goes through a model or a filter. Captions are drawn beside it.

    python3 handoff/product_end.py                 # -> handoff/.work/08_end.mp4
    python3 handoff/product_end.py --preview        # also a contact strip
"""
import os, sys, argparse, subprocess
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

ROOT  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIP  = os.path.join(ROOT, 'handoff', 'clips', '08.mp4')
PLATE = os.path.join(ROOT, 'handoff', 'plates_ref', '08_stand.png')
PROD  = os.path.join(ROOT, 'assets', 'src', 'product_clean.png')
FONT  = os.path.join(ROOT, 'assets', 'fonts', 'MPLUSRounded1c-ExtraBold.ttf')
WORK  = os.path.join(ROOT, 'handoff', '.work')
W, H, FPS = 1080, 1920, 30
HOLD_Q = 2.00          # seconds of the "?" bottle before the flash
TOTAL  = 6.60          # length of this segment
FLASH  = HOLD_Q        # the swap happens inside the white frame

# where the "?" bottle body sits in the plate (496x864 -> 1080x1920): x 300..780, y 704..1506
Q_BODY = (300, 704, 780, 1506)
# the real bottle image: body spans x 309..860, y 610..1466 in a 1179x1769 image
P_BODY = (309, 610, 860, 1466)

def read_frames(path, n):
    """decode the first n frames of a clip at FPS, letterbox-free 1080x1920"""
    cmd = ['ffmpeg', '-loglevel', 'error', '-i', path, '-vf',
           'scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,fps=%d' % (W, H, W, H, FPS),
           '-frames:v', str(n), '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    k = len(raw) // (W * H * 3)
    return np.frombuffer(raw, np.uint8).reshape(k, H, W, 3)

def bottle_cutout():
    """alpha for the product photo: white background -> transparent, feathered edge, no other change"""
    im = cv2.imread(PROD, cv2.IMREAD_COLOR)
    g = im.astype(np.int32).sum(2)
    a = np.where(g < 735, 255, 0).astype(np.uint8)
    # keep only the bottle blob, fill interior (the label is light but the bottle is a single region)
    cnts, _ = cv2.findContours(a, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cnts, key=cv2.contourArea)
    a = np.zeros_like(a); cv2.drawContours(a, [c], -1, 255, -1)
    a = cv2.GaussianBlur(a, (0, 0), 1.2)
    return im, a

def place(im, a):
    """uniform scale so the real bottle's body covers the '?' body with a margin, centred on it"""
    qx0, qy0, qx1, qy1 = Q_BODY; px0, py0, px1, py1 = P_BODY
    s = max((qx1 - qx0) / (px1 - px0), (qy1 - qy0) / (py1 - py0)) * 1.04
    ims = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    als = cv2.resize(a, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    cx = (qx0 + qx1) / 2 - (px0 + px1) / 2 * s
    cy = (qy0 + qy1) / 2 - (py0 + py1) / 2 * s
    return ims, als, int(round(cx)), int(round(cy))

def glow_layer():
    """warm halo behind the bottle plus a floor pool: hides the '?' bottle's edges and its reflection"""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = (Q_BODY[0] + Q_BODY[2]) / 2, (Q_BODY[1] + Q_BODY[3]) / 2
    halo = np.exp(-(((x - cx) / 330) ** 2 + ((y - cy) / 520) ** 2))
    pool = np.exp(-(((x - cx) / 420) ** 2 + ((y - (Q_BODY[3] + 60)) / 150) ** 2))
    g = np.clip(halo * 0.22 + pool * 0.30, 0, 1)
    col = np.array([200, 230, 255], np.float32)   # BGR warm white
    return g[:, :, None] * col[None, None, :]

def caption(t):
    """returns an RGBA PIL layer for time t after the swap"""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    f1 = ImageFont.truetype(FONT, 92); f2 = ImageFont.truetype(FONT, 54); f3 = ImageFont.truetype(FONT, 46)
    def fade(t0, dur=0.35): return float(np.clip((t - t0) / dur, 0, 1))
    def txt(y, s, f, al, fill=(255, 250, 240)):
        if al <= 0: return
        w = d.textlength(s, font=f)
        x = (W - w) / 2
        for dx, dy in ((3, 3), (-3, 3), (3, -3), (-3, -3), (0, 4), (0, -4), (4, 0), (-4, 0)):
            d.text((x + dx, y + dy), s, font=f, fill=(70, 30, 60, int(220 * al)))
        d.text((x, y), s, font=f, fill=fill + (int(255 * al),))
    a1 = fade(0.25); a2 = fade(0.55); a3 = fade(0.95)
    txt(150 - 20 * (1 - a1), 'ほぐほぐクリーム', f1, a1)
    txt(268 - 20 * (1 - a2), 'ChenMe', f2, a2, (255, 224, 170))
    txt(1660 - 20 * (1 - a3), 'HAPPY HALLOWEEN', f3, a3, (255, 240, 200))
    return layer

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--preview', action='store_true')
    ap.add_argument('--out', default=os.path.join(WORK, '08_end.mp4')); a = ap.parse_args()
    os.makedirs(WORK, exist_ok=True)
    n = int(round(TOTAL * FPS))
    if os.path.exists(CLIP):
        src = read_frames(CLIP, n)
        print('using generated clip %s (%d frames)' % (CLIP, len(src)))
    else:
        src = np.repeat(cv2.imread(PLATE)[None], 1, 0)
        print('no clip; using the seed plate as a still')
    prod, alpha = bottle_cutout()
    ims, als, ox, oy = place(prod, alpha)
    glow = glow_layer()
    ph, pw = ims.shape[:2]
    # paste region (clip to frame)
    x0, y0 = max(ox, 0), max(oy, 0); x1, y1 = min(ox + pw, W), min(oy + ph, H)
    sub_im = ims[y0 - oy:y1 - oy, x0 - ox:x1 - ox].astype(np.float32)
    sub_al = als[y0 - oy:y1 - oy, x0 - ox:x1 - ox].astype(np.float32)[:, :, None] / 255
    print('bottle placed at (%d,%d) size %dx%d' % (ox, oy, pw, ph))

    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                           '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-', '-an',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', a.out],
                          stdin=subprocess.PIPE)
    strip = []
    for i in range(n):
        t = i / FPS
        base = src[min(i, len(src) - 1)].astype(np.float32)
        if t < FLASH - 0.5:
            fr = base
        else:
            u = t - FLASH
            if u < 0:                       # gathering: glow rises into the flash
                k = (u + 0.5) / 0.5
                fr = base + glow * (k ** 2) * 0.6
            else:
                fr = base + glow * 0.9
                fr[y0:y1, x0:x1] = fr[y0:y1, x0:x1] * (1 - sub_al) + sub_im * sub_al
                cap = np.array(caption(u).convert('RGBA')).astype(np.float32)
                ca = cap[:, :, 3:4] / 255
                fr = fr * (1 - ca) + cap[:, :, 2::-1] * ca      # RGBA -> BGR
            # white flash centred on the swap
            wf = np.exp(-((u) / 0.11) ** 2) if u > -0.12 else 0.0
            fr = fr * (1 - wf) + 255 * wf
        fr = np.clip(fr, 0, 255).astype(np.uint8)
        ff.stdin.write(fr.tobytes())
        if a.preview and i % 20 == 0: strip.append(cv2.resize(fr, (216, 384)))
    ff.stdin.close(); ff.wait()
    print('->', a.out)
    if a.preview:
        cv2.imwrite(os.path.join(WORK, '08_end_strip.jpg'), np.concatenate(strip, 1), [cv2.IMWRITE_JPEG_QUALITY, 85])
        print('->', os.path.join(WORK, '08_end_strip.jpg'))

if __name__ == '__main__':
    main()
