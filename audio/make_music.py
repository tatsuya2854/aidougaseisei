# -*- coding: utf-8 -*-
"""
ChenMe x Halloween promo — original score, fully synthesized.
Bar = 2.30s (4/4 @ ~104.3 BPM), so the musical bars land on the picture cuts:
  bar2 = 4.60s (grid)   bar4 = 9.20s (street)   bar7 = 16.10s (reveal)
"""
import numpy as np, wave, struct, os

SR   = 44100
DUR  = 24.0
N    = int(SR * DUR)
BAR  = 2.30
BEAT = BAR / 4.0
S16  = BEAT / 4.0

L = np.zeros(N); Rr = np.zeros(N)

def midi(m): return 440.0 * 2.0 ** ((m - 69) / 12.0)

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    s = sig[:max(0, N - i)] * gain
    lg = np.sqrt((1 - pan) / 2.0) * 1.41421
    rg = np.sqrt((1 + pan) / 2.0) * 1.41421
    L[i:i + len(s)] += s * lg
    Rr[i:i + len(s)] += s * rg

def env(nsamp, a=0.004, d=0.25, s=0.0, r=0.10, hold=0.0):
    t = np.arange(nsamp) / SR
    e = np.zeros(nsamp)
    ai = int(a * SR); di = int(d * SR); hi = int(hold * SR)
    e[:ai] = np.linspace(0, 1, ai, endpoint=False) if ai else 0
    j = ai
    if di:
        e[j:j + di] = np.linspace(1, s if s > 0 else 0.0001, min(di, nsamp - j))
        j += di
    if hi and j < nsamp:
        e[j:j + hi] = s
        j += hi
    if j < nsamp:
        k = nsamp - j
        e[j:] = (s if s > 0 else 0.0001) * np.exp(-np.arange(k) / (r * SR + 1))
    return e

def pluck(f, dur, bright=0.5, detune=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t)
    y += bright * 0.45 * np.sin(2 * np.pi * f * 2 * t)
    y += bright * 0.18 * np.sin(2 * np.pi * f * 3 * t)
    if detune: y += 0.4 * np.sin(2 * np.pi * f * (1 + detune) * t)
    return y * env(n, a=0.003, d=dur * 0.9, r=0.05) * 0.5

def bell(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2)
         + 0.42 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4.2)
         + 0.22 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 7.0))
    return y * env(n, a=0.002, d=dur * 0.98, r=0.12) * 0.42

def marimba(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.30 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 12)
    return y * np.exp(-t * 6.5) * 0.55

def bass(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.tanh(1.7 * (np.sin(2 * np.pi * f * t) + 0.22 * np.sin(2 * np.pi * f * 2 * t)))
    return y * env(n, a=0.006, d=dur * 0.55, s=0.55, r=0.10, hold=dur * 0.3) * 0.5

def kick():
    d = 0.30; n = int(d * SR); t = np.arange(n) / SR
    f = 118 * np.exp(-t * 26) + 44
    y = np.sin(2 * np.pi * np.cumsum(f) / SR)
    y = np.tanh(y * 1.5)
    click = np.random.RandomState(1).randn(n) * np.exp(-t * 420) * 0.25
    return (y * np.exp(-t * 8.5) + click) * 0.9

def hat(dur=0.045, seed=2, tone=1.0):
    n = int(dur * SR)
    x = np.random.RandomState(seed).randn(n)
    x = np.diff(np.concatenate([[0], x]))           # crude high-pass
    return x * np.exp(-np.arange(n) / (dur * 0.30 * SR)) * 0.16 * tone

def clap(seed=3):
    d = 0.30; n = int(d * SR); t = np.arange(n) / SR
    x = np.random.RandomState(seed).randn(n)
    x = np.diff(np.concatenate([[0], x]))
    y = np.zeros(n)
    for off, g in ((0.000, 1.0), (0.011, .8), (0.023, .6)):
        i = int(off * SR); y[i:] += x[:n - i] * g
    return y * np.exp(-t * 17) * 0.18

def whoosh(d=0.75, up=True, seed=5):
    n = int(d * SR); t = np.arange(n) / SR
    x = np.random.RandomState(seed).randn(n)
    # sweep a one-pole low-pass by resampling the smoothing coefficient
    a = np.linspace(0.02, 0.45, n) if up else np.linspace(0.45, 0.02, n)
    y = np.zeros(n); z = 0.0
    for i in range(n):
        z += a[i] * (x[i] - z); y[i] = z
    e = (t / d) ** 2 if up else np.exp(-t * 4.5)
    return y * e * 0.55

def riser(d=2.0, seed=7):
    n = int(d * SR); t = np.arange(n) / SR
    x = np.random.RandomState(seed).randn(n)
    a = np.linspace(0.01, 0.55, n)
    y = np.zeros(n); z = 0.0
    for i in range(n):
        z += a[i] * (x[i] - z); y[i] = z
    tone = np.sin(2 * np.pi * np.cumsum(np.linspace(200, 1400, n)) / SR) * 0.25
    return (y * 0.9 + tone) * (t / d) ** 2.2 * 0.5

def impact(seed=9):
    d = 1.5; n = int(d * SR); t = np.arange(n) / SR
    f = 150 * np.exp(-t * 12) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    nz = np.random.RandomState(seed).randn(n) * np.exp(-t * 12) * 0.35
    return (body + nz) * 0.75

def pad(freqs, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for i, f in enumerate(freqs):
        for det in (-0.004, 0.0, 0.004):
            y += np.sin(2 * np.pi * f * (1 + det) * t + i) / (len(freqs) * 3.0)
    # gentle low-pass
    z = 0.0; out = np.zeros(n)
    for i in range(0, n, 1):
        z += 0.06 * (y[i] - z); out[i] = z
    return out * env(n, a=0.35, d=0.2, s=0.85, r=0.9, hold=dur * 0.55) * 0.30

# ---------------- arrangement ----------------
# chords (midi roots + voicings)
Am = [57, 60, 64, 69]; F = [53, 57, 60, 65]; C = [48, 55, 60, 64]; G = [55, 59, 62, 67]
Em = [52, 55, 59, 64]; Dm = [50, 57, 62, 65]
BARS = [Am, F, C, G, Am, F, G, C, G, Am, F]     # bar 0..10

# 1) percussion + groove
for b in range(11):
    t0 = b * BAR
    if t0 >= DUR: break
    dens = 0 if b < 0 else 1
    # kick
    for beat in (0, 2):
        add(kick(), t0 + beat * BEAT, 0.85 if b < 7 else 0.45)
    if 2 <= b < 7:
        add(kick(), t0 + 3.5 * BEAT, 0.55)
    # hats
    for k in range(8):
        g = 1.0 if k % 2 == 0 else 0.62
        if b >= 7: g *= 0.45
        add(hat(seed=10 + k, tone=1.0 + 0.2 * (k % 3)), t0 + k * (BEAT / 2), 0.9 * g,
            pan=0.25 if k % 2 else -0.25)
    # claps
    if 2 <= b < 7:
        for beat in (1, 3):
            add(clap(seed=20 + b), t0 + beat * BEAT, 0.9)
    # bass
    ch = BARS[b]
    root = midi(ch[0] - 12)
    if b < 7:
        for k, g in ((0, 1.0), (1.5, .7), (2, 1.0), (3.5, .7)):
            add(bass(root, BEAT * 0.9), t0 + k * BEAT, 0.9)
    else:
        add(bass(root, BEAT * 3.4), t0, 0.55)

# 2) 16th pluck arpeggio (bars 0-6)
for b in range(7):
    t0 = b * BAR; ch = BARS[b]
    seq = [ch[0], ch[2], ch[3], ch[2], ch[1], ch[3], ch[2], ch[3],
           ch[0], ch[2], ch[3] + 12, ch[3], ch[2], ch[3], ch[1], ch[2]]
    for k, nte in enumerate(seq):
        g = 0.55 if k % 2 == 0 else 0.36
        if b >= 2: g *= 1.15
        add(pluck(midi(nte + 12), S16 * 2.2, bright=0.55),
            t0 + k * S16, g, pan=-0.35 + 0.7 * ((k % 4) / 3.0))

# 3) melody hook (bars 4-6) — cute minor pentatonic
MEL = [(0.0, 76, 1.0), (0.5, 74, .5), (1.0, 72, 1.0), (2.0, 69, 1.5),
       (3.0, 72, .5), (3.5, 74, .5)]
for b in (4, 5, 6):
    t0 = b * BAR
    tr = 0 if b == 4 else (-2 if b == 5 else 2)
    for (bt, nte, ln) in MEL:
        add(marimba(midi(nte + tr), BEAT * ln), t0 + bt * BEAT, 0.85, pan=0.12)
        add(marimba(midi(nte + tr - 12), BEAT * ln), t0 + bt * BEAT, 0.30, pan=-0.12)

# 4) transitions
add(whoosh(0.85, up=True, seed=31), 4.60 - 0.62, 0.55, pan=-0.2)
add(whoosh(0.85, up=True, seed=32), 9.20 - 0.62, 0.60, pan=0.2)
add(riser(2.20, seed=33), 16.20 - 2.20, 0.60)
add(impact(41), 16.20, 0.85)
add(whoosh(1.10, up=False, seed=34), 16.20, 0.45)

# tile-pop ticks across the 9-up grid
for k in range(9):
    add(marimba(midi(81 + [0, 2, 4, 7, 9, 12, 7, 4, 2][k]), 0.26),
        4.66 + k * 0.075, 0.34, pan=-0.4 + 0.1 * k)

# 5) reveal sparkle cluster + bright bells (bars 7-10)
for k, nte in enumerate([84, 88, 91, 96, 93]):
    add(bell(midi(nte), 2.2), 17.05 + k * 0.085, 0.55, pan=-0.3 + 0.15 * k)
BELLS = [(7, [(0.0, 72), (1.0, 76), (2.0, 79), (3.0, 84)]),
         (8, [(0.0, 83), (1.0, 79), (2.0, 76), (3.0, 79)]),
         (9, [(0.0, 81), (1.5, 76), (2.5, 72), (3.0, 69)]),
         (10, [(0.0, 72), (1.0, 76)])]
for b, notes in BELLS:
    t0 = b * BAR
    for bt, nte in notes:
        if t0 + bt * BEAT < DUR:
            add(bell(midi(nte), 2.6), t0 + bt * BEAT, 0.50, pan=0.10)

# 6) pads
add(pad([midi(x) for x in [57, 60, 64]], 9.2), 0.0, 0.55)
add(pad([midi(x) for x in [57, 60, 64, 67]], 7.0), 9.2, 0.55)
add(pad([midi(x) for x in [60, 64, 67, 72]], 4.2), 16.10, 0.85)
add(pad([midi(x) for x in [57, 60, 64, 69]], 3.9), 20.30, 0.80)

# ---------------- reverb ----------------
def reverb(x, wet=0.20, dur=1.1, seed=77):
    n = int(dur * SR)
    rs = np.random.RandomState(seed)
    ir = rs.randn(n) * np.exp(-np.arange(n) / (0.28 * SR))
    ir[0] = 1.0
    ir /= np.abs(ir).sum() / 3.0
    y = np.convolve(x, ir)[:len(x)]
    return (1 - wet) * x + wet * y

L = reverb(L, 0.20, 1.1, 77)
Rr = reverb(Rr, 0.20, 1.1, 78)

# tail fade so the last chord rings out cleanly
fade = np.ones(N)
k = int(0.9 * SR)
fade[-k:] = np.linspace(1, 0, k) ** 1.6
L *= fade; Rr *= fade
# soft-clip + normalise
mx = max(np.abs(L).max(), np.abs(Rr).max())
L = np.tanh(L / mx * 1.25) * 0.86
Rr = np.tanh(Rr / mx * 1.25) * 0.86

out = np.empty(N * 2, dtype=np.int16)
out[0::2] = np.clip(L, -1, 1) * 32000
out[1::2] = np.clip(Rr, -1, 1) * 32000
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'score.wav')
w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(out.tobytes()); w.close()
print('wrote', path, round(DUR, 2), 's')
