#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build the Veo seed plates for the reference-style cut.

The reference video (assets/src2/ref_target.mp4) is a fully generated clip in
which the illustrator's bottle had been re-rendered by the model, which the
contract forbids. So: take the reference's own key frames as seeds, but swap
the label on every visible bottle for the "?" bottle label (assets/src/
bottle_halloween.png), which we are allowed to change. The illustrator's
bottle never enters a generative model; it is composited over the final cut
by handoff/product_end.py.

    python3 handoff/make_ref_plates.py            # writes handoff/plates_ref/*.png
    python3 handoff/make_ref_plates.py --check    # also writes a contact sheet

The label quad on each frame is found automatically (white bottle body ->
morphological opening removes the pump -> minAreaRect), with a manual
override where hands occlude the bottle.
"""
import os, sys, subprocess, argparse
import numpy as np, cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF  = os.path.join(ROOT, 'assets', 'src2', 'ref_target.mp4')
QBOT = os.path.join(ROOT, 'assets', 'src', 'bottle_halloween.png')
OUT  = os.path.join(ROOT, 'handoff', 'plates_ref')
W, H = 1080, 1920
SRC_W, SRC_H = 496, 864          # the reference clip's frame size
SC = H / SRC_H                   # upscale factor (2.222)
XOFF = (SRC_W * SC - W) / 2      # centre crop after scaling to height 1920

# label rectangle inside the "?" bottle image, and the body it sits on
Q_LABEL = (314, 573, 694, 1213)
Q_BODY  = (263, 540, 747, 1245)

# name, time in the reference, label swap?, roi for the bottle body (x0,y0,x1,y1 in 496x864)
# or an explicit quad [tl,tr,br,bl] when the auto-detect cannot see the corners
SHOTS = [
  ('01_face',   0.20, None),
  ('02_stone',  1.40, dict(roi=(120, 330, 330, 620), open=35)),
  ('03_hands',  4.40, dict(roi=(60, 130, 400, 720), open=95)),
  ('04_raise',  5.90, dict(quad=[(327, 243), (425, 228), (467, 373), (372, 393)])),
  ('05_pump',   8.40, None),
  ('06_sit',   11.80, None),
  ('07_hug',   13.30, dict(quad=[(328, 495), (490, 520), (410, 852), (232, 775)])),
  ('08_stand', 13.80, dict(roi=(100, 240, 400, 680), open=95)),
]

def frame_at(t):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', '%.3f' % t, '-i', REF,
                          '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
                         capture_output=True, check=True).stdout
    return cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)

def upscale(img):
    big = cv2.resize(img, (int(round(SRC_W * SC)), H), interpolation=cv2.INTER_LANCZOS4)
    x0 = int(round(XOFF))
    big = big[:, x0:x0 + W]
    # a touch of unsharp mask so the 2.2x upscale does not read as soft
    blur = cv2.GaussianBlur(big, (0, 0), 1.6)
    return cv2.addWeighted(big, 1.35, blur, -0.35, 0)

def order_quad(pts):
    pts = np.array(pts, np.float32)
    s = pts.sum(1); d = pts[:, 0] - pts[:, 1]
    tl = pts[np.argmin(s)]; br = pts[np.argmax(s)]
    tr = pts[np.argmax(d)]; bl = pts[np.argmin(d)]
    return np.array([tl, tr, br, bl], np.float32)

def detect_body(img, roi, k):
    x0, y0, x1, y1 = roi
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = ((hsv[:, :, 2] > 120) & (hsv[:, :, 1] < 90)).astype(np.uint8) * 255
    mask = np.zeros_like(m); mask[y0:y1, x0:x1] = m[y0:y1, x0:x1]
    # close: fill the drawing strokes on the label; open: drop the narrow pump
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    body = cv2.morphologyEx(mask, cv2.MORPH_OPEN, ker)
    cnts, _ = cv2.findContours(body, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts: sys.exit('no bottle body found in roi %s' % (roi,))
    c = max(cnts, key=cv2.contourArea)
    rect = cv2.minAreaRect(c)
    return order_quad(cv2.boxPoints(rect))

def label_quad_from_body(body):
    """map the '?' label rectangle into the detected body quad by bilinear interpolation"""
    bx0, by0, bx1, by1 = Q_BODY; lx0, ly0, lx1, ly1 = Q_LABEL
    u0 = (lx0 - bx0) / (bx1 - bx0); u1 = (lx1 - bx0) / (bx1 - bx0)
    v0 = (ly0 - by0) / (by1 - by0); v1 = (ly1 - by0) / (by1 - by0)
    tl, tr, br, bl = body
    def P(u, v):
        top = tl + (tr - tl) * u; bot = bl + (br - bl) * u
        return top + (bot - top) * v
    return np.array([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], np.float32)

def swap_label(plate, quad_src):
    """quad_src is in 496x864 coordinates, ordered tl,tr,br,bl. Returns plate with the '?' label warped in."""
    q = (quad_src * SC - np.array([XOFF, 0], np.float32)).astype(np.float32)
    lab = cv2.imread(QBOT, cv2.IMREAD_COLOR)[Q_LABEL[1]:Q_LABEL[3], Q_LABEL[0]:Q_LABEL[2]]
    lh, lw = lab.shape[:2]
    src = np.array([[0, 0], [lw, 0], [lw, lh], [0, lh]], np.float32)
    M = cv2.getPerspectiveTransform(src, q)
    warped = cv2.warpPerspective(lab, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
    mask = np.zeros((H, W), np.float32)
    cv2.fillConvexPoly(mask, q.astype(np.int32), 1.0)
    mask = cv2.GaussianBlur(mask, (0, 0), 2.0)
    # keep the frame's own shading: modulate the label by the blurred luminance of the
    # area it replaces, normalised to that area's mean (drawing strokes blur away)
    gray = cv2.cvtColor(plate, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    shade = cv2.GaussianBlur(gray, (0, 0), 18)
    inside = mask > 0.5
    mean = float(shade[inside].mean()) if inside.any() else 1.0
    gain = np.clip(shade / max(mean, 1e-3), 0.55, 1.25)
    tinted = np.clip(warped.astype(np.float32) * gain[:, :, None], 0, 255)
    m3 = mask[:, :, None]
    out = plate.astype(np.float32) * (1 - m3) + tinted * m3
    return np.clip(out, 0, 255).astype(np.uint8), q

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--check', action='store_true'); a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    tiles = []
    for name, t, spec in SHOTS:
        img = frame_at(t)
        plate = upscale(img)
        dbg = None
        if spec:
            body = order_quad(spec['quad']) if 'quad' in spec else detect_body(img, spec['roi'], spec['open'])
            lq = label_quad_from_body(body)
            plate, q = swap_label(plate, lq)
            if a.check:
                dbg = plate.copy()
                bq = (body * SC - np.array([XOFF, 0])).astype(np.int32)
                cv2.polylines(dbg, [bq], True, (0, 0, 255), 3)
                cv2.polylines(dbg, [q.astype(np.int32)], True, (0, 255, 0), 2)
            print('%-9s t=%5.2f body=%s' % (name, t, body.astype(int).tolist()))
        else:
            print('%-9s t=%5.2f (no bottle label)' % (name, t))
        cv2.imwrite(os.path.join(OUT, name + '.png'), plate)
        tiles.append(cv2.resize(dbg if dbg is not None else plate, (270, 480)))
    if a.check:
        sheet = np.concatenate(tiles, 1)
        cv2.imwrite(os.path.join(OUT, '_check.jpg'), sheet, [cv2.IMWRITE_JPEG_QUALITY, 88])
        print('-> handoff/plates_ref/_check.jpg')

if __name__ == '__main__':
    main()
