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

Clips land in handoff/clips/0X.mp4, which is exactly where assemble_ref.sh
looks; any shot without a clip falls back to a slow push on its seed plate.

The seed plates are the reference video's own key frames with every visible
bottle label swapped for the "?" label (handoff/make_ref_plates.py). The
illustrator's bottle is never sent to the model: shot 08 ends on the "?"
bottle and handoff/product_end.py composites the real one over it.
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error, subprocess

ROOT   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLATES = os.path.join(ROOT, 'handoff', 'plates_ref')
CLIPS  = os.path.join(ROOT, 'handoff', 'clips')
LOGS   = os.path.join(ROOT, 'handoff', 'logs')
HOST   = 'https://generativelanguage.googleapis.com'
# Vertex is a Cloud service billed through Cloud Billing, so a Google Cloud
# free-trial credit pays for it. The AI Studio Gemini API has its own prepay
# wallet that the trial credit does NOT cover, hence --vertex.
TOKENFILE = os.path.expanduser('~/.gcp_access_token')

STYLE = (
  "3D toy figure render, soft vinyl and matte plastic surfaces, collectible designer-toy aesthetic, "
  "high quality, clean and smooth. Pastel dusk palette of lavender, soft peach and warm orange. "
  "Soft diffused lighting, lifted shadows, low contrast, shallow depth of field with creamy bokeh. "
  "A cute chibi character in an orange cat-hood halloween costume: a round yellow-orange hood with "
  "stitched cat ears and small black bats across the brow, a dark brown twin-tail with a candy corn "
  "and a bat clip, a sleeveless orange vest with a black jack-o'-lantern face, black and white "
  "striped sleeves, dark grey shorts with a white cobweb print, white sneakers with a ghost face. "
  "The white pump bottle in the scene has a pastel lavender-to-peach label with a big glowing "
  "question mark, tiny bats, a ghost, a jack-o'-lantern and a black cat; keep that label exactly as "
  "in the input image, never redraw it and never add text to it. "
  "The face must stay exactly as in the input image: closed crescent squinting eyes, thick black "
  "brows, round pink blush. Never open the eyes, never draw pupils. Keep the character's design, "
  "proportions and colours identical to the input image in every frame. "
)
NEGATIVE = ("open eyes, realistic eyes, pupils, irises, changed facial expression, extra fingers, "
            "text, letters, watermark, morphing face, distorted logo, photorealistic human skin, "
            "harsh shadows, high contrast, changed label, new label artwork")

# Published per-second rates, Sep 2026. Verify against the current pricing page
# before a big run: these move, and they are the whole basis of the estimate.
RATES = {
  'veo-3.1-lite-generate-preview': (0.03, 0.05),   # Gemini API ids
  'veo-3.1-fast-generate-preview': (0.15, 0.15),
  'veo-3.1-generate-preview':      (0.40, 0.40),
  'veo-3.1-lite-generate-001':     (0.03, 0.05),   # Vertex ids
  'veo-3.1-fast-generate-001':     (0.15, 0.15),
  'veo-3.1-generate-001':          (0.40, 0.40),
}
CLIP_SECONDS = 8            # Veo returns a fixed-length clip; we trim it afterwards

# (number, seed plate, seconds kept in the cut, motion prompt, last-frame plate or None,
#  [extra negative terms for this shot only])
# Durations follow the reference video beat for beat.
SHOTS = [
  ("01", "01_face",  1.40, "Close-up. The character giggles and tilts her head with a small happy bounce, "
        "the hood's cat ears wobbling, then glances down toward something below frame with a curious smile. "
        "Blurred jack-o'-lanterns glow behind her. The camera pushes in very slowly.", None),
  ("02", "02_stone", 2.60, "Top-down view. The character crouches over the small white pump bottle lying on the mossy "
        "cobblestones among scattered candies, leans in curiously and reaches a hand toward it, then tilts her "
        "head. A candy rocks slightly. The whole frame stays sharp and clear: nothing passes in front of the "
        "lens, no foreground objects, no blurred shapes crossing the camera. The camera drifts down very slowly.",
        None, "foreground bokeh, large blurred circles, out-of-focus blobs over the frame, lens flare, "
              "objects passing in front of the camera, floating orbs, white glare"),
  ("03", "03_hands", 2.00, "Close-up. Two small hands in striped sleeves hold the white pump bottle with the glowing "
        "question-mark label steady in front of the camera and tilt it very slightly to catch the warm pumpkin "
        "light. Both hands keep a calm, relaxed grip and stay wrapped around the bottle the whole time; the "
        "fingers do not change shape or let go. Candle flames flicker on the jack-o'-lanterns behind. "
        "The camera holds nearly still.", None,
        "deformed hand, claw hand, clenched fist, curled fingers, missing fingers, extra fingers, "
        "hand letting go, melting fingers"),
  ("04", "04_raise", 2.20, "The character stands on a giant pumpkin and holds the pump bottle high with one arm, "
        "beaming, then bounces on her toes and sways it proudly. Wrapped candies float gently upward around her "
        "in the pastel dusk sky. The camera arcs slowly around her.", None),
  ("05", "05_pump",  2.20, "Macro. A small finger presses the pump and a swirl of soft white cream is dispensed onto "
        "an open palm, thick and glossy, then the finger lifts. Bokeh pumpkins glow warmly in the background. "
        "The camera holds still with a tiny drift.", None),
  ("06", "06_sit",   2.80, "The character sits on top of a big pumpkin with giant candy lollipops behind her, both hands "
        "resting on her knee, and gently rubs her knee in slow soothing circles, swaying softly and tilting her "
        "head, looking content. The frame stays exactly as in the input image: nothing new enters the shot, "
        "no bottle, no container, no packaging, no product of any kind, the foreground stays empty. "
        "The camera drifts in very slowly.", None,
        "bottle, pump bottle, plastic bottle, container, jar, tube, product packaging, label, new object entering frame"),
  ("07", "07_hug",   1.80, "Close-up. The character hugs the pump bottle tightly to her cheek with both arms, "
        "squeezes it happily and sways side to side. Small candies and sparkles drift down around her. "
        "The camera holds nearly still.", None),
  ("08", "08_stand", 2.00, "Product shot. The white pump bottle with the glowing question-mark label stands on a "
        "glossy reflective floor among lit jack-o'-lanterns. The bottle stays perfectly still and centred; only "
        "the candle flames inside the pumpkins flicker and faint sparkles drift. Locked-off camera, absolutely "
        "no camera movement, no zoom.", "08_stand"),
]

KEYFILE = os.path.expanduser('~/.gemini_api_key')

def api_key():
    for k in ('GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_API_KEY'):
        if os.environ.get(k):
            return os.environ[k].strip()
    if os.path.exists(KEYFILE):
        return open(KEYFILE).read().strip()
    sys.exit("no API key. Either export GEMINI_API_KEY=... or put the key in %s (chmod 600)."
             % KEYFILE)

def vertex_host(loc):
    return 'https://%s-aiplatform.googleapis.com' % loc

def access_token():
    if os.environ.get('GOOGLE_ACCESS_TOKEN'):
        return os.environ['GOOGLE_ACCESS_TOKEN'].strip()
    if os.path.exists(TOKENFILE):
        return open(TOKENFILE).read().strip()
    sys.exit("no access token. In Cloud Shell run `gcloud auth print-access-token`\n"
             "and put it in %s (it expires in about an hour)." % TOKENFILE)

def vcall(url, payload, token, timeout=120, _tries=0):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST',
                                 headers={'Content-Type': 'application/json',
                                          'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        if e.code == 400 and _tries < 5 and 'parameters' in payload:
            import re as _re
            m = _re.search(r"[`'\"]([A-Za-z]+)[`'\"][^.]{0,60}(not supported|isn't supported|Unknown|unknown)", body)
            bad = m.group(1) if m else None
            if bad and bad in payload['parameters']:
                payload['parameters'].pop(bad)
                print("   (model rejects `%s`, dropping it and retrying)" % bad)
                return vcall(url, payload, token, timeout, _tries + 1)
        if e.code in (401, 403):
            raise SystemExit("HTTP %s from Vertex.\n%s\n"
                             "The token may have expired (they last about an hour) or the\n"
                             "Vertex AI API may not be enabled on the project." % (e.code, body[:600]))
        raise SystemExit("HTTP %s from Vertex\n%s" % (e.code, body[:1200]))

def call(path, payload=None, method=None, key=None, timeout=120, _tries=0):
    """Veo variants accept different parameter sets; drop what a model rejects and retry."""
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(HOST + path, data=data,
                                 method=method or ('POST' if data else 'GET'),
                                 headers={'Content-Type': 'application/json',
                                          'x-goog-api-key': key})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        if e.code == 400 and "isn't supported by this model" in body and _tries < 4 and payload:
            bad = body.split('`', 2)[1] if '`' in body else None
            params = payload.get('parameters', {})
            if bad and bad in params:
                params.pop(bad)
                print("   (model rejects `%s`, dropping it and retrying)" % bad)
                return call(path, payload, method, key, timeout, _tries + 1)
        if e.code == 429:
            raise SystemExit(
                "HTTP 429 RESOURCE_EXHAUSTED from %s\n"
                "The key is valid but has no Veo quota: Veo is paid-tier only.\n"
                "Enable billing on the key's project (aistudio.google.com/apikey -> the\n"
                "project's billing setup), then re-run. Nothing was generated or charged.\n" % path)
        raise SystemExit("HTTP %s from %s\n%s" % (e.code, path, body[:1200]))

def plate_jpeg(name, width=720):
    """Downscale the 1080x1920 plate to a small JPEG for upload."""
    src = os.path.join(PLATES, '%s.png' % name)
    if not os.path.exists(src):
        sys.exit("missing plate: %s (run handoff/make_ref_plates.py)" % src)
    dst = os.path.join(LOGS, '%s_%d.jpg' % (name, width))
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
    ap.add_argument('--last-frame', nargs='?', const=True, default='auto',
                    help="send a last frame too: 'auto' (default) only for shots that declare one, "
                         "or pass the flag to force it for every shot (reuses the start plate)")
    ap.add_argument('--no-audio', action='store_true',
                    help='ask the model to skip audio (we mix our own score); some models reject it')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--list-models', action='store_true')
    ap.add_argument('--estimate', action='store_true',
                    help='print what a run would cost and exit')
    ap.add_argument('--vertex', action='store_true',
                    help='use Vertex AI, which a Google Cloud free-trial credit pays for')
    ap.add_argument('--project', default=os.environ.get('GCP_PROJECT', ''))
    ap.add_argument('--location', default=os.environ.get('GCP_LOCATION', 'us-central1'))
    ap.add_argument('--poll', type=int, default=15)
    ap.add_argument('--timeout', type=int, default=900)
    a = ap.parse_args()

    if a.vertex and not a.dry_run and not a.project:
        sys.exit("--vertex needs --project <project-id> (e.g. gen-lang-client-0924303510)")
    key = None if a.dry_run else (access_token() if a.vertex else api_key())
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

    if a.model == 'auto' and a.vertex:
        a.model = 'veo-3.1-lite-generate-001'   # Vertex uses -001, the Gemini API uses -preview
        print("model: %s (Vertex default; override with --model)" % a.model)
    elif a.model == 'auto' and not a.dry_run:
        _, veo = veo_models()
        if not veo:
            sys.exit("this key cannot see any Veo model. Run --list-models for detail.")
        def rank(n):
            gen = 3 if '3.1' in n else (2 if 'veo-3' in n else 1)
            tier = 0 if 'lite' in n else (1 if 'fast' in n else 2)   # full > fast > lite
            return (gen, tier, n)
        a.model = sorted(veo, key=rank, reverse=True)[0]
        print("model: %s (auto-selected from what the key can see)" % a.model)
    elif a.model == 'auto':
        a.model = 'veo-3.1-generate-preview'

    want = [s for s in SHOTS if a.shots == 'all' or s[0].lstrip('0') in
            [x.strip().lstrip('0') for x in a.shots.split(',')]]
    if not want: sys.exit("no shot matched --shots")

    if a.estimate:
        secs = len(want) * CLIP_SECONDS
        print("%d shot(s) x %ds billed output = %d seconds" % (len(want), CLIP_SECONDS, secs))
        print("(Veo bills the clip it returns, not the %.1fs we trim it to)"
              % sum(s[2] for s in want))
        for m, (lo, hi) in RATES.items():
            rng = ("$%.2f" % (secs * lo)) if lo == hi else ("$%.2f-%.2f" % (secs * lo, secs * hi))
            print("  %-32s %s" % (m.replace('-generate-preview', ''), rng))
        print("rates as published Sep 2026 - check the current pricing page before a big run")
        return

    for row in want:
        num, name, dur, motion, last_name = row[:5]
        extra_neg = row[5] if len(row) > 5 else ''

        out = os.path.join(CLIPS, '%s.mp4' % num)
        use_last = bool(last_name) if a.last_frame == 'auto' else a.last_frame
        if os.path.exists(out):
            print("shot %s: already generated, skipping" % num); continue
        prompt = STYLE + motion
        body = {
            "instances": [{"prompt": prompt}],
            "parameters": {"aspectRatio": a.aspect, "resolution": a.resolution,
                           "negativePrompt": NEGATIVE + (", " + extra_neg if extra_neg else ""),
                           "sampleCount": 1}
        }
        if a.no_audio: body["parameters"]["generateAudio"] = False
        if a.dry_run:
            body["instances"][0]["image"] = {"bytesBase64Encoded": "<%s.jpg>" % name,
                                             "mimeType": "image/jpeg"}
            if use_last:
                lf = {"bytesBase64Encoded": "<%s.jpg>" % (last_name or name), "mimeType": "image/jpeg"}
                (body["instances"][0] if a.vertex else body["parameters"])["lastFrame"] = lf
            print("\n--- shot %s -> %s:predictLongRunning (trim to %.2fs) ---" % (num, a.model, dur))
            shown = json.loads(json.dumps(body)); shown["instances"][0]["prompt"] = prompt[:160] + " ... " + motion[-120:]
            print(json.dumps(shown, ensure_ascii=False, indent=2))
            continue

        img = plate_jpeg(name)
        body["instances"][0]["image"] = {
            "bytesBase64Encoded": base64.b64encode(open(img, 'rb').read()).decode(),
            "mimeType": "image/jpeg"}
        if use_last:
            last = plate_jpeg(last_name or name)
            lf = {"bytesBase64Encoded": base64.b64encode(open(last, 'rb').read()).decode(),
                  "mimeType": "image/jpeg"}
            # Vertex takes the last frame inside the instance, the Gemini API in parameters
            (body["instances"][0] if a.vertex else body["parameters"])["lastFrame"] = lf

        print("shot %s: submitting to %s ..." % (num, a.model))
        if a.vertex:
            base = '%s/v1/projects/%s/locations/%s/publishers/google/models/%s' % (
                vertex_host(a.location), a.project, a.location, a.model)
            body['parameters']['sampleCount'] = 1
            op = vcall(base + ':predictLongRunning', body, key)
            opname = op.get('name')
            if not opname: sys.exit("no operation name:\n" + json.dumps(op)[:800])
            json.dump(op, open(os.path.join(LOGS, '%s_submit.json' % num), 'w'), indent=2)
            t0 = time.time()
            while True:
                time.sleep(a.poll)
                st = vcall(base + ':fetchPredictOperation', {'operationName': opname}, key)
                if st.get('done'): break
                if time.time() - t0 > a.timeout:
                    sys.exit("shot %s: timed out after %ds" % (num, a.timeout))
                print("   ... %ds" % int(time.time() - t0))
        else:
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
            hdr = ({'Authorization': 'Bearer ' + key} if a.vertex
                   else {'x-goog-api-key': key})
            dl = urllib.request.Request(uri, headers=hdr)
            with urllib.request.urlopen(dl, timeout=600) as r, open(out, 'wb') as f:
                f.write(r.read())
        else:
            b64 = None
            for k in ('"bytesBase64Encoded": "', '"videoBytes": "'):
                if k in blob:
                    b64 = blob.split(k, 1)[1].split('"', 1)[0]; break
            if not b64:
                sys.exit("shot %s: no video in the response, see handoff/logs/%s_done.json" % (num, num))
            open(out, 'wb').write(base64.b64decode(b64))
        print("shot %s -> %s  (assemble_ref.sh will trim it to %.2fs)" % (num, out, dur))

    if not a.dry_run:
        print("\ndone. now run:  ./handoff/assemble_ref.sh")

if __name__ == '__main__':
    main()
