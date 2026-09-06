import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true];
}));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json',
  '.css': 'text/css', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404); return res.end('nope');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(8099, '127.0.0.1', r));

const PAGE = args.page || 'render/scene3d.html';
const FPS = Number(args.fps || 30);
const OUT = args.out || path.join(ROOT, 'frames3d');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--force-device-scale-factor=1', '--hide-scrollbars',
         '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none',
         '--js-flags=--max-old-space-size=3072']
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGE ERROR:', e.message, e.stack ? String(e.stack).split('\n')[1] : ''));
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });

await page.goto('http://127.0.0.1:8099/' + PAGE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
const DUR = await page.evaluate(() => window.__DUR);

if (args.probe) {
  for (const t of String(args.probe).split(',').map(Number)) {
    await page.evaluate(v => window.render(v), t);
    const f = path.join(OUT, 'probe_' + t.toFixed(2).replace('.', '_') + '.png');
    await page.screenshot({ path: f });
    console.log('probe', t);
  }
} else {
  const total = Math.round(DUR * FPS);
  const from = args.from !== undefined ? Number(args.from) : 0;
  const to = args.to !== undefined ? Number(args.to) : total - 1;
  const t0 = Date.now();
  for (let i = from; i <= to; i++) {
    await page.evaluate(v => window.render(v), i / FPS);
    await page.screenshot({ path: path.join(OUT, 'f' + String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 });
    if ((i - from) % 30 === 0) {
      const el = (Date.now() - t0) / 1000, done = i - from + 1, left = to - i;
      console.log(`frame ${i}/${to}  ${el.toFixed(0)}s  ${(el / done).toFixed(2)}s/f  eta ${(el / done * left / 60).toFixed(1)}min`);
    }
  }
  console.log('done in', ((Date.now() - t0) / 1000 / 60).toFixed(1), 'min');
}
await browser.close();
server.close();
