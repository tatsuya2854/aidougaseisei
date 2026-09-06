#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate the halloween promo shots with Veo through the Gemini API,
seeded from the 3D render's clean start plates so the motion starts on-model.

    export GEMINI_API_KEY=...            # never paste the key into a prompt
    python3 handoff/veo_generate.py --list-models      # what the key can reach
    python3 handoff/veo_generate.py --dry-run          # show the requests
    python3 handoff/veo_generate.py --shots 8          # generate one shot
    python3 handoff/veo_generate.py                    # all eight
    ./handoff/assemble.sh                              # cut it together

Clips land in handoff/clips/0X.mp4, which is exactly where assemble.sh
looks; any shot without a clip falls back to the 3D render.
Shot 9 (the product cut) is deliberately absent: the package lettering
does not survive a generative pass.
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error, subprocess

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLATES = os.path.join(ROOT, 'handoff', 'plates')
CLIPS  = os.path.join(ROOT, 'handoff', 'clips')
LOGS   = os.path.join(ROOT, 'handoff', 'logs')
HOST   = 'https://generativelanguage.googleapis.com'

STYLE = (
  "3D toy figure render, soft vinyl and matte plastic surfaces, collectible figure aesthetic. "
  "Pastel dusk palette of lavender, soft peach and warm orange. Soft diffused lighting, lifted "
  "shadows, low contrast, shallow depth of field with creamy bokeh. A cute chibi character in an "
  "orange cat-hood halloween costume: stitched cat ears, small bats across the brow, a black floppy "
  "tip with a candy corn, a sleeveless orange top with a black jack-o'-lantern face, black and white "
  "striped sleeves, black shorts with a white cobweb print, white sneakers. "
  "The face must stay exactly as in the input image: closed crescent squinting eyes, thick black "
  "brows, a wide open smile with a pink tongue, round pink blush. Never open the eyes. "
)
NEGATIVE = ("open eyes, realistic eyes, pupils, irises, changed facial expression, extra fingers, "
            "text, letters, watermark, morphing face, distorted logo, photorealistic human skin, "
            "harsh shadows, high contrast")

SHOTS = [
  ("01", "01_landing",     2.70, "The character has just landed on the cobbled street and bounces lightly in place, pom-poms jiggling. Candy pieces drift slowly past the lens. The camera pushes in very slowly. Gentle secondary motion only."),
  ("02", "02_run",         2.70, "The character runs cheerfully toward the camera down the cobbled street, under an arch of glowing pumpkins, with a slight up-and-down bounce and swinging arms. The camera dollies back slowly to hold the framing."),
  ("03", "03_bigpumpkin",  2.40, "The character bobs happily beside a large glowing pumpkin while candle flames flicker in the foreground. Very slow camera drift to the right, warm light flickering softly on the costume."),
  ("04", "04_doorstep",    2.40, "The character leans in and tilts its head, curiously looking down at the pump bottle sitting on the doorstep. Candies rock gently. The camera creeps forward slightly."),
  ("05", "05_pump",        2.20, "Close-up. The character slowly reaches a striped-sleeve arm toward the bottle's pump while the bottle glows faintly. The camera holds nearly still, breathing very slightly."),
  ("06", "06_archjump",    2.40, "The character jumps joyfully under the pumpkin arch, pom-poms flying up, candies bouncing on the ground. Slight low-angle camera rise."),
  ("07", "07_bustup",      2.00, "Bust-up. The character bobs and giggles while bats glide across the sky far behind and bokeh candy drifts past. The camera is almost static with a tiny handheld float."),
  ("08", "08_hero",        2.60, "Hero shot. The character stands on top of a giant pumpkin and proudly raises the bottle higher. Candies float upward around it and the sky glows warmer. The camera arcs slowly around to centre the character."),
]

def api_key():
    for k in ('GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY'):
        if os.environ.get(k):
            return os.environ[k]
    sys.exit("no API key: export GEMINI_API_KEY=... (do not paste it into a chat message)")

def call(path, payload=None, method=None, key=None, timeout=120):
    url = HOST + path + ('&' if '?' in path else '?') + 'key=' + key
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method or ('POST' if data else 'GET'),
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        raise SystemExit("HTTP %s from %s\n%s" % (e.code, path, body[:1200]))

def plate_jpeg(name, tag='start', width=720):
    """Downscale the 1080x1920 plate to a small JPEG for upload."""
    src = os.path.join(PLATES, '%s_%s.png' % (name, tag))
    if not os.path.exists(src):
        sys.exit("missing plate: " + src)
    dst = os.path.join(LOGS, '%s_%s_%d.jpg' % (name, tag, width))
    os.makedirs(LOGS, exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src,
                    '-vf', 'scale=%d:-2' % width, '-q:v', '3', dst], check=True)
    return dst

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', default=os.environ.get('VEO_MODEL', 'auto'),
                    help="'auto' asks the key which Veo models it can see and picks the newest")
    ap.add_argument('--shots', default='all', help='e.g. 1,3,8')
    ap.add_argument('--aspect', default='9:16')
    ap.add_argument('--resolution', default='1080p')
    ap.add_argument('--last-frame', action='store_true',
                    help='also send the shot end plate (only some models accept it)')
    ap.add_argument('--no-audio', action='store_true',
                    help='ask the model to skip audio (we mix our own score); some models reject it')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--list-models', action='store_true')
    ap.add_argument('--poll', type=int, default=15)
    ap.add_argument('--timeout', type=int, default=900)
    a = ap.parse_args()

    key = None if a.dry_run else api_key()
    os.makedirs(CLIPS, exist_ok=True); os.makedirs(LOGS, exist_ok=True)

    def veo_models():
        got = call('/v1beta/models?pageSize=200', key=key)
        names = [m['name'].split('/')[-1] for m in got.get('models', [])]
        return names, [n for n in names if 'veo' in n.lower()]

    if a.list_models:
        names, veo = veo_models()
        print("veo models this key can see:")
        for n in veo: print("  ", n)
        if not veo:
            print("  (none)")
            print("  -> this key has no Veo access. Veo is paid-tier only, and a")
            print("     Google AI Pro / Flow subscription is NOT the same thing as")
            print("     API access: enable billing on the key's project.")
            print("all visible models:", ', '.join(names[:30]), '...')
        return

    if a.model == 'auto' and not a.dry_run:
        _, veo = veo_models()
        if not veo:
            sys.exit("this key cannot see any Veo model. Run --list-models for detail.")
        rank = lambda n: (('3.1' in n) * 3 + ('3.0' in n or 'veo-3' in n) * 2 + ('2' in n) * 1,
                          'generate' in n, n)
        a.model = sorted(veo, key=rank, reverse=True)[0]
        print("model: %s (auto-selected from what the key can see)" % a.model)
    elif a.model == 'auto':
        a.model = 'veo-3.1-generate-preview'

    want = [s for s in SHOTS if a.shots == 'all' or s[0].lstrip('0') in
            [x.strip().lstrip('0') for x in a.shots.split(',')]]
    if not want: sys.exit("no shot matched --shots")

    for num, name, dur, motion in want:
        out = os.path.join(CLIPS, '%s.mp4' % num)
        if os.path.exists(out):
            print("shot %s: already generated, skipping" % num); continue
        prompt = STYLE + motion
        body = {
            "instances": [{"prompt": prompt}],
            "parameters": {"aspectRatio": a.aspect, "resolution": a.resolution,
                           "negativePrompt": NEGATIVE, "sampleCount": 1}
        }
        if a.no_audio: body["parameters"]["generateAudio"] = False
        if a.dry_run:
            body["instances"][0]["image"] = {"bytesBase64Encoded": "<%s_start.jpg>" % name,
                                             "mimeType": "image/jpeg"}
            if a.last_frame:
                body["parameters"]["lastFrame"] = {"bytesBase64Encoded": "<%s_end.jpg>" % name,
                                                   "mimeType": "image/jpeg"}
            print("\n--- shot %s -> %s:predictLongRunning (trim to %.2fs) ---" % (num, a.model, dur))
            print(json.dumps(body, ensure_ascii=False, indent=2)[:1400])
            continue

        img = plate_jpeg(name, 'start')
        body["instances"][0]["image"] = {
            "bytesBase64Encoded": base64.b64encode(open(img, 'rb').read()).decode(),
            "mimeType": "image/jpeg"}
        if a.last_frame:
            last = plate_jpeg(name, 'end')
            body["parameters"]["lastFrame"] = {
                "bytesBase64Encoded": base64.b64encode(open(last, 'rb').read()).decode(),
                "mimeType": "image/jpeg"}

        print("shot %s: submitting to %s ..." % (num, a.model))
        op = call('/v1beta/models/%s:predictLongRunning' % a.model, body, key=key)
        opname = op.get('name')
        if not opname: sys.exit("no operation name in response:\n" + json.dumps(op)[:800])
        json.dump(op, open(os.path.join(LOGS, '%s_submit.json' % num), 'w'), indent=2)

        t0 = time.time()
        while True:
            time.sleep(a.poll)
            st = call('/v1beta/' + opname, key=key)
            if st.get('done'):
                break
            if time.time() - t0 > a.timeout:
                sys.exit("shot %s: timed out after %ds (operation %s)" % (num, a.timeout, opname))
            print("   ... %ds" % int(time.time() - t0))
        json.dump(st, open(os.path.join(LOGS, '%s_done.json' % num), 'w'), indent=2)
        if 'error' in st:
            sys.exit("shot %s failed: %s" % (num, json.dumps(st['error'])[:600]))

        # the payload shape has moved around between Veo releases; look for a uri or inline bytes
        blob = json.dumps(st)
        uri = None
        for k in ('"uri": "', '"videoUri": "', '"fileUri": "'):
            if k in blob:
                uri = blob.split(k, 1)[1].split('"', 1)[0]; break
        if uri:
            u = uri + ('&' if '?' in uri else '?') + 'key=' + key
            with urllib.request.urlopen(u, timeout=600) as r, open(out, 'wb') as f:
                f.write(r.read())
        else:
            b64 = None
            for k in ('"bytesBase64Encoded": "', '"videoBytes": "'):
                if k in blob:
                    b64 = blob.split(k, 1)[1].split('"', 1)[0]; break
            if not b64:
                sys.exit("shot %s: no video in the response, see handoff/logs/%s_done.json" % (num, num))
            open(out, 'wb').write(base64.b64decode(b64))
        print("shot %s -> %s  (assemble.sh will trim it to %.2fs)" % (num, out, dur))

    if not a.dry_run:
        print("\ndone. now run:  ./handoff/assemble.sh")

if __name__ == '__main__':
    main()
