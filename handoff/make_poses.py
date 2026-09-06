#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate extra poses of the halloween character with gemini-2.5-flash-image
on Vertex, seeded with the supplied render so the design carries over.

The reference image is passed in every request, and the prompt asks only for
a pose change on a flat background we can key out. The product bottle is
never described or drawn: that artwork is composited from the source file.
"""
import base64, json, os, sys, urllib.request, urllib.error, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF  = os.path.join(ROOT, 'assets', 'build', 'char_hw.png')
OUT  = os.path.join(ROOT, 'assets', 'poses')
TOKENFILE = os.path.expanduser('~/.gcp_access_token')
MODEL = 'gemini-2.5-flash-image'

KEEP = (
  "Keep the character EXACTLY as in the reference image: the same orange cat-hood with "
  "stitched ears, the black bats on the brow, the black floppy tip with the candy corn, the "
  "same orange top with the black jack-o'-lantern face, the same black-and-white striped "
  "sleeves, the same black shorts with the white cobweb print, the same white sneakers, the "
  "same skin tone, and the same soft 3D toy-figure shading and proportions. Do not restyle "
  "and do not change any colour. "
  "THE EYES MUST STAY CLOSED IN EVERY IMAGE — drawn as simple closed curved lines, exactly "
  "the closed squinting eyes of the reference. Never open the eyes, never draw pupils, irises, "
  "sclera or eyeballs of any kind. "
  "The BROWS, MOUTH and BLUSH may change to carry the expression asked for. "
  "REMOVE the pinwheel pom-poms entirely: the character holds nothing at all. Both hands are "
  "bare, empty, small and rounded in the same toy style, with no object of any kind in them. "
  "Full body, facing the camera, centred, on a plain flat bright green screen background with "
  "no shadow, no floor, no props and absolutely no text, letters, numbers or watermarks."
)

POSES = {
  'stand':  "Pose: standing upright, both feet on the ground, arms relaxed at its sides, empty hands. "
            "Expression: a calm closed-mouth smile, brows relaxed, soft blush.",
  'jump':   "Pose: leaping with both arms thrown up above its head, both legs tucked, empty hands. "
            "Expression: delighted, laughing with the mouth wide open and the tongue showing, brows raised high.",
  'reach':  "Pose: leaning forward and reaching one arm down and out toward something on the ground in "
            "front of it, head tilted down, the other arm relaxed, both hands empty. "
            "Expression: curious and surprised, a small round open mouth, one brow raised higher than the other.",
  'sit':    "Pose: sitting with its knees drawn up and both empty hands resting on its knees, seen from the front. "
            "Expression: serene and content, a small closed-mouth smile, brows softly lowered, strong blush.",
  'present':"Pose: standing, with its right arm stretched straight up high above its head, well above the hood, "
            "the open empty palm facing forward as if holding something up for everyone to see; the left arm "
            "hangs relaxed at its side, both hands empty. "
            "Expression: proud and beaming, a big open smile, brows raised.",
  'wave':   "Pose: standing and waving one raised hand next to its head, the other arm relaxed, both hands empty. "
            "Expression: cheerful and friendly, an open smile with the tongue showing, brows raised.",
  'hold2':  "Pose: standing with both arms raised in front of its chest, both palms open and facing up side by "
            "side, as if about to receive something, both hands empty. "
            "Expression: excited anticipation, mouth open in a small round 'oh', brows raised high.",
  'shy':    "Pose: standing with both hands brought up near its cheeks, empty hands. "
            "Expression: bashful and pleased, a small wavy closed mouth, brows tilted up in the middle, very strong blush.",
}

def token():
    if os.environ.get('GOOGLE_ACCESS_TOKEN'): return os.environ['GOOGLE_ACCESS_TOKEN'].strip()
    if os.path.exists(TOKENFILE): return open(TOKENFILE).read().strip()
    sys.exit("no access token in %s" % TOKENFILE)

def gen(project, location, name, instruction, tok, tries=3):
    url = ('https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s'
           '/publishers/google/models/%s:generateContent' % (location, project, location, MODEL))
    ref = base64.b64encode(open(REF, 'rb').read()).decode()
    body = {
      "contents": [{"role": "user", "parts": [
          {"inlineData": {"mimeType": "image/png", "data": ref}},
          {"text": KEEP + " " + instruction}]}],
      "generationConfig": {"responseModalities": ["IMAGE"]}
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST',
            headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            d = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        if e.code == 429 and tries > 0:
            wait = 20 * (4 - tries)
            print("  %s: rate limited, retrying in %ds" % (name, wait))
            import time as _t; _t.sleep(wait)
            return gen(project, location, name, instruction, tok, tries - 1)
        print("  %s: HTTP %s %s" % (name, e.code, body[:300]))
        return None
    for c in d.get('candidates', []):
        for part in c.get('content', {}).get('parts', []):
            b = part.get('inlineData', {}).get('data')
            if b:
                p = os.path.join(OUT, '%s.png' % name)
                open(p, 'wb').write(base64.b64decode(b))
                return p
    print("  %s: no image in response (%s)" % (name, json.dumps(d)[:200]))
    return None

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--project', required=True)
    ap.add_argument('--location', default='us-central1')
    ap.add_argument('--poses', default='all')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    tok = token()
    want = list(POSES) if a.poses == 'all' else [p.strip() for p in a.poses.split(',')]
    for n in want:
        if n not in POSES: print('unknown pose', n); continue
        print('generating', n, '...')
        p = gen(a.project, a.location, n, POSES[n], tok)
        if p: print('  ->', p)
