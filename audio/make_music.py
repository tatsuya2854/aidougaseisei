# -*- coding: utf-8 -*-
"""
ChenMe x Halloween — original score, fully synthesised.
Fancy / kawaii: music box + glockenspiel + pizzicato, bright major,
light percussion.  125 BPM (beat 0.48s, bar 1.92s).  Accent hits are
placed on the picture cuts, which do not sit on a uniform grid.
"""
import numpy as np, wave, os

SR   = 44100
DUR  = 24.0
N    = int(SR * DUR)
BEAT = 0.48
BAR  = BEAT * 4

L = np.zeros(N); R = np.zeros(N)
def midi(m): return 440.0 * 2.0 ** ((m - 69) / 12.0)

def add(sig, t0, gain=1.0, pan=0.0):
    pan = max(-1.0, min(1.0, pan))
    i = int(t0 * SR)
    if i >= N or i < 0: return
    s = sig[:max(0, N - i)] * gain
    L[i:i+len(s)] += s * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i+len(s)] += s * np.sqrt((1 + pan) / 2) * 1.414

def _t(d): return np.arange(int(d * SR)) / SR

# ---------- instruments ----------
def music_box(f, d=1.6):
    t = _t(d)
    y = (np.sin(2*np.pi*f*t) * np.exp(-t*2.6)
         + 0.34 * np.sin(2*np.pi*f*2*t) * np.exp(-t*4.4)
         + 0.14 * np.sin(2*np.pi*f*3.01*t) * np.exp(-t*7.0)
         + 0.07 * np.sin(2*np.pi*f*5.4*t) * np.exp(-t*11.0))
    hammer = np.random.RandomState(int(f) % 97).randn(len(t)) * np.exp(-t*260) * 0.05
    a = np.minimum(1, t / 0.002)
    return (y + hammer) * a * 0.42

def glock(f, d=1.1):
    t = _t(d)
    y = (np.sin(2*np.pi*f*t) * np.exp(-t*4.0)
         + 0.5 * np.sin(2*np.pi*f*2.76*t) * np.exp(-t*6.5)
         + 0.25 * np.sin(2*np.pi*f*5.4*t) * np.exp(-t*10.0))
    return y * np.minimum(1, t/0.0015) * 0.30

def pizz(f, d=0.34):
    t = _t(d)
    y = np.sin(2*np.pi*f*t) + 0.42*np.sin(2*np.pi*f*2*t) + 0.16*np.sin(2*np.pi*f*3*t)
    return y * np.exp(-t*11.0) * np.minimum(1, t/0.003) * 0.40

def sub(f, d=0.9):
    t = _t(d)
    y = np.sin(2*np.pi*f*t) + 0.18*np.sin(2*np.pi*f*2*t)
    e = np.minimum(1, t/0.01) * np.exp(-t*2.2)
    return y * e * 0.42

def pad(freqs, d):
    t = _t(d); y = np.zeros(len(t))
    for i, f in enumerate(freqs):
        for det in (-0.0035, 0.0, 0.0035):
            y += np.sin(2*np.pi*f*(1+det)*t + i*1.7) / (len(freqs)*3.0)
    z = 0.0; out = np.zeros(len(t))
    for i in range(len(t)):
        z += 0.09*(y[i]-z); out[i] = z
    env = np.minimum(1, t/0.45) * np.minimum(1, (d-t)/0.6) * np.exp(-t*0.10)
    return out * np.clip(env, 0, 1) * 0.26

def kick(d=0.24):
    t = _t(d)
    f = 96*np.exp(-t*30) + 46
    return np.tanh(np.sin(2*np.pi*np.cumsum(f)/SR)*1.2) * np.exp(-t*11) * 0.55

def shaker(d=0.055, seed=1, tone=1.0):
    t = _t(d)
    x = np.random.RandomState(seed).randn(len(t))
    x = np.diff(np.concatenate([[0], x]))
    x = np.diff(np.concatenate([[0], x]))
    return x * np.exp(-t/(d*0.30)) * 0.055 * tone

def snap(seed=5):
    d = 0.22; t = _t(d)
    x = np.random.RandomState(seed).randn(len(t))
    x = np.diff(np.concatenate([[0], x]))
    y = np.zeros(len(t))
    for off, g in ((0.0, 1.0), (0.008, .7), (0.017, .45)):
        i = int(off*SR); y[i:] += x[:len(t)-i]*g
    return y * np.exp(-t*24) * 0.13

def chime_cluster(root, n=5, seed=3, spread=0.075, gain=1.0):
    rs = np.random.RandomState(seed)
    scale = [0, 2, 4, 7, 9, 12, 14, 16, 19]
    out = []
    for i in range(n):
        out.append((i*spread + rs.rand()*0.02,
                    midi(root + scale[rs.randint(len(scale))]), gain*(0.9 - i*0.06)))
    return out

def harp_run(root, n=10, step=0.045, up=True, gain=0.55):
    scale = [0, 2, 4, 7, 9]
    ev = []
    for i in range(n):
        k = i if up else (n - 1 - i)
        ev.append((i*step, midi(root + scale[k % 5] + 12*(k//5)), gain))
    return ev

def whoosh(d=0.55, seed=7, up=True):
    t = _t(d)
    x = np.random.RandomState(seed).randn(len(t))
    a = np.linspace(0.03, 0.40, len(t)) if up else np.linspace(0.40, 0.03, len(t))
    y = np.zeros(len(t)); z = 0.0
    for i in range(len(t)):
        z += a[i]*(x[i]-z); y[i] = z
    e = (t/d)**2 if up else np.exp(-t*6.0)
    return y * e * 0.30

def riser(d=1.9, seed=11):
    t = _t(d)
    x = np.random.RandomState(seed).randn(len(t))
    a = np.linspace(0.01, 0.5, len(t))
    y = np.zeros(len(t)); z = 0.0
    for i in range(len(t)):
        z += a[i]*(x[i]-z); y[i] = z
    tone = np.sin(2*np.pi*np.cumsum(np.linspace(500, 2300, len(t)))/SR) * 0.20
    return (y*0.8 + tone) * (t/d)**2.4 * 0.32

# ---------- arrangement ----------
# I - V - vi - IV in C, two bars of each pair; bright and simple
CH = [[48,55,64,67],[43,50,59,67],[45,52,60,64],[41,48,57,65]]   # C, G, Am, F
NB = int(DUR / BAR) + 1

def chord(b): return CH[b % 4]

# pad bed
for b in range(0, NB, 2):
    c = chord(b)
    add(pad([midi(x+12) for x in c], BAR*2 + 0.4), b*BAR, 0.55)

# pizzicato bass + light kit
for b in range(NB):
    t0 = b*BAR
    if t0 > DUR: break
    root = midi(chord(b)[0] - 12)
    fifth = midi(chord(b)[1] - 12)
    lively = 1.4 <= t0 < 19.4
    add(sub(root, BEAT*3.6), t0, 0.55 if lively else 0.34)
    if lively:
        for k, f, g in ((0, root, 1.0), (1.5, fifth, .7), (2, root, .95), (3, fifth, .65), (3.5, root, .5)):
            add(pizz(f*2, BEAT*0.8), t0 + k*BEAT, 0.55*g, pan=-0.12)
        add(kick(), t0, 0.55); add(kick(), t0 + 2*BEAT, 0.45)
        add(snap(seed=20+b), t0 + BEAT, 0.85); add(snap(seed=40+b), t0 + 3*BEAT, 0.85)
    for k in range(8):
        g = (1.0 if k % 2 == 0 else 0.55) * (1.0 if lively else 0.45)
        add(shaker(seed=60+k+b*8, tone=1+0.25*(k % 3)), t0 + k*BEAT/2, g, pan=0.3 if k % 2 else -0.3)

# glockenspiel 16th sparkle from bar 4 on
for b in range(4, NB):
    t0 = b*BAR
    if t0 > 19.0: break
    c = chord(b)
    seq = [c[2]+12, c[3]+12, c[2]+24, c[3]+12, c[1]+24, c[3]+12, c[2]+24, c[3]+24]
    for k, n in enumerate(seq):
        add(glock(midi(n), 0.7), t0 + k*BEAT/2, 0.30 if k % 2 == 0 else 0.19,
            pan=-0.4 + 0.8*((k % 4)/3))

# music-box melody
MEL = [  # (bar, beat, midi, dur beats)
 (0,0,76,1),(0,1,79,1),(0,2,81,1),(0,3,79,1),
 (1,0,74,1.5),(1,2,71,1),(1,3,74,1),
 (2,0,72,1),(2,1,76,1),(2,2,74,1),(2,3,72,1),
 (3,0,69,2),(3,2,72,2),
 (4,0,76,1),(4,1,79,1),(4,2,84,1.5),(4,3.5,83,0.5),
 (5,0,81,1.5),(5,2,79,1),(5,3,76,1),
 (6,0,77,1),(6,1,81,1),(6,2,79,1),(6,3,77,1),
 (7,0,74,2),(7,2,79,2),
 (8,0,76,1),(8,1,79,1),(8,2,81,1),(8,3,84,1),
 (9,0,83,1.5),(9,2,79,1),(9,3,81,1),
]
for (b, be, n, dl) in MEL:
    t0 = b*BAR + be*BEAT
    if t0 >= 19.2: continue
    add(music_box(midi(n), max(0.9, dl*BEAT + 1.0)), t0, 0.95, pan=0.10)
    add(music_box(midi(n-12), max(0.8, dl*BEAT + 0.7)), t0, 0.28, pan=-0.14)

# ---------- picture-cut accents ----------
CUTS = [2.70, 5.40, 7.80, 10.20, 12.40, 14.80, 16.80]
for i, c in enumerate(CUTS):
    add(whoosh(0.5, seed=30+i, up=True), c-0.36, 0.55, pan=-0.25 if i % 2 else 0.25)
    for (dt, f, g) in chime_cluster(84 + (i % 3)*2, n=3, seed=50+i, spread=0.055, gain=0.5):
        add(glock(f, 1.0), c + dt, g, pan=0.2)

# jump / bounce pops
for t0 in (0.60, 1.14, 13.06, 13.86, 14.66):
    add(pizz(midi(88), 0.24), t0, 0.5, pan=0.1)
    add(pizz(midi(93), 0.20), t0 + 0.055, 0.35, pan=-0.1)

# ---------- the reveal ----------
add(riser(1.3, seed=13), 17.55, 0.40)                       # lifting into the hero shot
add(whoosh(0.7, seed=91, up=True), 19.06, 0.42)             # cut to the product cut

# magic gathers around the mystery bottle, peaking exactly on the flash
for (dt, f, g) in harp_run(72, n=12, step=0.040, up=True, gain=0.6):
    add(glock(f, 1.2), 19.50 + dt, g*0.72, pan=-0.35 + dt*4)
add(riser(0.95, seed=23), 19.26, 0.62)
add(riser(0.52, seed=24), 19.70, 0.58)
add(sub(midi(36), 0.9), 19.88, 0.30)

# the flash: bright cluster, low whump, then the product blooms
for (dt, f, g) in chime_cluster(84, n=10, seed=77, spread=0.052, gain=1.0):
    add(glock(f, 2.2), 20.20 + dt, g*0.85, pan=0.1)
add(whoosh(1.3, seed=92, up=False), 20.18, 0.46)
add(kick(0.30), 20.20, 0.55)
add(pizz(midi(88), 0.24), 20.21, 0.42, pan=0.1)

# closing bells: C major, then a warm resolve
CLOSE = [(20.24, [72, 76, 79]), (21.10, [74, 77, 81]),
         (22.00, [72, 76, 84]), (22.92, [67, 72, 76, 79])]
for (t0, notes) in CLOSE:
    for j, n in enumerate(notes):
        add(music_box(midi(n), 2.6), t0 + j*0.07, 0.85, pan=-0.2 + j*0.16)
        add(glock(midi(n+12), 1.6), t0 + j*0.07 + 0.02, 0.22, pan=0.2 - j*0.14)
add(pad([midi(x) for x in [60, 64, 67, 72]], 4.6), 20.16, 0.88)
for i, t0 in enumerate([20.62, 21.45, 22.25, 23.05, 23.55]):
    add(glock(midi([88, 91, 84, 93, 88][i]), 1.6), t0, 0.24, pan=[-0.3, 0.3, -0.15, 0.25, 0][i])

# ---------- space + master ----------
def reverb(x, wet=0.24, dur=1.5, seed=5):
    n = int(dur*SR)
    ir = np.random.RandomState(seed).randn(n) * np.exp(-np.arange(n)/(0.36*SR))
    ir[0] = 1.0; ir /= np.abs(ir).sum()/3.2
    L2 = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, L2) * np.fft.rfft(ir, L2), L2)[:len(x)]
    return (1-wet)*x + wet*y

L = reverb(L, 0.24, 1.5, 5); R = reverb(R, 0.24, 1.5, 6)
fade = np.ones(N); k = int(1.1*SR)
fade[-k:] = np.linspace(1, 0, k)**1.5
fi = int(0.05*SR); fade[:fi] *= np.linspace(0, 1, fi)
L *= fade; R *= fade
mx = max(np.abs(L).max(), np.abs(R).max())
L = np.tanh(L/mx*1.22)*0.84; R = np.tanh(R/mx*1.22)*0.84

out = np.empty(N*2, dtype=np.int16)
out[0::2] = np.clip(L, -1, 1)*32000
out[1::2] = np.clip(R, -1, 1)*32000
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'score.wav')
w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(out.tobytes()); w.close()
print('wrote', path)
