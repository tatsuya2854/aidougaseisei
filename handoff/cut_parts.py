#!/usr/bin/env python3
"""Cut the supplied character render into rig parts.

Nothing is redrawn: every part is the source pixels, masked by a box plus a
colour predicate so a limb never carries a sliver of the piece behind it.
The head is cut from all eight expression poses and registered on the neck,
so the rig keeps the face changes while the body gets real joints.
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter

SRC = 'assets/poses/cut/stand.png'
OUT = 'assets/parts'
os.makedirs(OUT, exist_ok=True)

a = np.array(Image.open(SRC).convert('RGBA')).astype(int)
H, W = a.shape[:2]
r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
solid = al > 40
mx = a[:, :, :3].max(2)
mn = a[:, :, :3].min(2)
sat = mx - mn

C = {
    'orange': solid & (r > 190) & (g > 60) & (g < 190) & (b < 110) & (sat > 90),
    'dark':   solid & (mx < 105),
    'white':  solid & (mn > 200),
    'skin':   solid & (r > 215) & (g > 175) & (g < 250) & (b > 140) & (b < 235) & (sat > 28) & (sat < 108),
    'grey':   solid & (mx > 70) & (mx < 190) & (sat < 62),
    'brown':  solid & (r > 55) & (r < 150) & (g < 100) & (b < 85) & (sat > 22),
}
C['cloth'] = C['dark'] | C['white']
C['leg'] = C['skin'] | C['white'] | C['dark']
C['any'] = solid

# torso carries the vest, hem and shorts as one piece; each limb is cut by
# colour so it never drags a sliver of the piece behind it with it
PARTS = [
    ('armL',  ( 26, 434, 150, 656), 'cloth|skin', 1.0),
    ('armR',  (354, 434, 490, 656), 'cloth|skin', 1.0),
    ('legL',  (140, 630, 250, 778), 'skin|white|dark', 1.0),
    ('legR',  (246, 630, 360, 778), 'skin|white|dark', 1.0),
    ('torso', ( 86, 410, 412, 700), 'any', 1.2),
]
# the tail sweeps behind the hood; keep it out of the head plate
TAIL_KEEP = [(468, 40), (560, 28), (700, 88), (716, 178), (628, 246),
             (520, 252), (452, 222), (410, 196), (408, 142), (446, 92)]
HEAD_BOX = (0, 0, 500, 446)

# joints, in source pixels: where the part rotates and where it hangs from
RIG = {
    'root':  {'pivot': [248, 652], 'parent': None},
    'torso': {'pivot': [248, 614], 'parent': 'root'},
    'head':  {'pivot': [248, 430], 'parent': 'torso'},
    'tail':  {'pivot': [476, 170], 'parent': 'head'},
    'armL':  {'pivot': [122, 448], 'parent': 'torso'},
    'armR':  {'pivot': [376, 448], 'parent': 'torso'},
    'legL':  {'pivot': [196, 634], 'parent': 'root'},
    'legR':  {'pivot': [300, 634], 'parent': 'root'},
}

def poly_mask(pts, shape):
    from PIL import ImageDraw
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.array(m) > 127


def bake(name, mask, feather):
    soft = Image.fromarray((mask * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(feather))
    alpha = (np.array(soft).astype(float) / 255.0) * (al / 255.0)
    ys, xs = np.nonzero(alpha > 0.03)
    if len(xs) == 0:
        return None
    bx0, bx1 = int(xs.min()), int(xs.max()) + 1
    by0, by1 = int(ys.min()), int(ys.max()) + 1
    rgba = np.zeros((by1 - by0, bx1 - bx0, 4), np.uint8)
    rgba[:, :, :3] = a[by0:by1, bx0:bx1, :3]
    rgba[:, :, 3] = np.clip(alpha[by0:by1, bx0:bx1] * 255, 0, 255)
    Image.fromarray(rgba).save(os.path.join(OUT, name + '.png'))
    return {'x': bx0, 'y': by0, 'w': bx1 - bx0, 'h': by1 - by0}


def erode(mask, px):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.array(im.filter(ImageFilter.MinFilter(2 * px + 1))) > 127


def boxmask(box):
    x0, y0, x1, y1 = box
    m = np.zeros((H, W), bool)
    m[y0:y1, x0:x1] = True
    return m


def colmask(key):
    m = np.zeros((H, W), bool)
    for k in key.split('|'):
        m |= C[k]
    return m


tail_keep = poly_mask(TAIL_KEEP, (H, W))
meta = {'src': [W, H], 'parts': {}, 'rig': RIG}

masks = {}
masks['tail'] = solid & boxmask((405, 25, W, 260)) & tail_keep
masks['head'] = solid & boxmask(HEAD_BOX) & ~tail_keep
for name, box, key, f in PARTS:
    m = solid & boxmask(box) & colmask(key)
    if name == 'torso':
        # keep a few pixels of overlap under each limb so no seam opens up
        for k in ('armL', 'armR', 'legL', 'legR'):
            m &= ~erode(masks[k], 3)
    masks[name] = m

FEATHER = {'tail': 1.2, 'head': 1.2, 'torso': 1.2,
           'armL': 1.0, 'armR': 1.0, 'legL': 1.0, 'legR': 1.0}
for name in ('tail', 'head', 'armL', 'armR', 'legL', 'legR', 'torso'):
    info = bake(name, masks[name], FEATHER[name])
    meta['parts'][name] = info
    print(f'{name:6s} {info}')

# how much of the character did we miss?
union = np.zeros((H, W), bool)
for m in masks.values():
    union |= m
miss = solid & ~union
print('uncovered pixels:', int(miss.sum()), 'of', int(solid.sum()))
if miss.sum():
    ys, xs = np.nonzero(miss)
    print('  bbox y', ys.min(), ys.max(), 'x', xs.min(), xs.max())
    Image.fromarray((miss * 255).astype(np.uint8)).save(os.path.join(OUT, '_missed.png'))

json.dump(meta, open(os.path.join(OUT, 'parts.json'), 'w'), indent=1)


# ---------------------------------------------------------------- heads
# One head plate per expression, cut with the same rule and registered so
# the neck pivot and the face centre land in the same place every time.
from scipy import ndimage   # noqa: E402

HEAD_SRC = 'assets/poses/cut'
heads = {}
for fn in sorted(os.listdir(HEAD_SRC)):
    if not fn.endswith('.png'):
        continue
    name = fn[:-4]
    q = np.array(Image.open(os.path.join(HEAD_SRC, fn)).convert('RGBA')).astype(int)
    qh, qw = q.shape[:2]
    qr, qg, qb, qa = q[:, :, 0], q[:, :, 1], q[:, :, 2], q[:, :, 3]
    qs = qa > 40
    qmx, qmn = q[:, :, :3].max(2), q[:, :, :3].min(2)
    qsat = qmx - qmn

    # the hood: bright warm yellow-orange, and the biggest such blob is the head
    hood = qs & (qr > 205) & (qg > 118) & (qg < 212) & (qb < 118) & (qsat > 95)
    lab, k = ndimage.label(hood)
    sizes = ndimage.sum(hood, lab, range(1, k + 1))
    hood = lab == (int(np.argmax(sizes)) + 1)
    hy, hx = np.nonzero(hood)
    # the chin sits a little below the lowest hood pixel
    neck_y = int(min(qh - 1, hy.max() + 0.165 * (hy.max() - hy.min())))
    cx = int((hx.min() + hx.max()) / 2)

    # the twin-tail: dark brown, and always the blob furthest from the centre
    brown = qs & (qr > 52) & (qr < 155) & (qg < 105) & (qb < 92) & (qsat > 20)
    lab2, k2 = ndimage.label(brown)
    tail = np.zeros_like(qs)
    if k2:
        best, bestscore = 0, -1
        for j in range(1, k2 + 1):
            sel = lab2 == j
            if sel.sum() < 900:
                continue
            ys2, xs2 = np.nonzero(sel)
            score = sel.sum() * (1 + abs(xs2.mean() - cx) / qw)
            if score > bestscore:
                bestscore, best = score, j
        if best:
            tail = lab2 == best
            tail = np.array(Image.fromarray((tail * 255).astype(np.uint8))
                            .filter(ImageFilter.MaxFilter(9))) > 127

    # the tail, candy corn and bat clip ride on the tail part, so the head
    # plate stops just outside the hood
    hpad = int(0.045 * (hx.max() - hx.min()))
    m = qs.copy()
    m[neck_y + 1:, :] = False
    m[:, :max(0, int(hx.min()) - hpad)] = False
    m[:, min(qw, int(hx.max()) + hpad):] = False
    m &= ~tail
    # a raised hand can end up in the box; keep only the head blob itself
    lab3, k3 = ndimage.label(m)
    if k3 > 1:
        s3 = ndimage.sum(m, lab3, range(1, k3 + 1))
        m = lab3 == (int(np.argmax(s3)) + 1)
    soft = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    alpha = (np.array(soft).astype(float) / 255.0) * (qa / 255.0)
    ys, xs = np.nonzero(alpha > 0.03)
    bx0, bx1, by0, by1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    rgba = np.zeros((by1 - by0, bx1 - bx0, 4), np.uint8)
    rgba[:, :, :3] = q[by0:by1, bx0:bx1, :3]
    rgba[:, :, 3] = np.clip(alpha[by0:by1, bx0:bx1] * 255, 0, 255)
    Image.fromarray(rgba).save(os.path.join(OUT, 'head_' + name + '.png'))
    # pivot expressed inside the cut plate, in 0..1 of its own box
    heads[name] = {'w': bx1 - bx0, 'h': by1 - by0,
                   'px': (cx - bx0) / (bx1 - bx0), 'py': (neck_y - by0) / (by1 - by0),
                   'hood': [int(hx.max() - hx.min()), int(hy.max() - hy.min())]}
    print(f'head_{name:8s} {bx1-bx0}x{by1-by0} neck ({cx},{neck_y}) '
          f'px={heads[name]["px"]:.3f} py={heads[name]["py"]:.3f}')

meta['heads'] = heads
json.dump(meta, open(os.path.join(OUT, 'parts.json'), 'w'), indent=1)
