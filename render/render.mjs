import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PAGE = 'file://' + path.join(ROOT, 'render', 'scene.html');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.join('=') || true];
}));

const FPS = Number(args.fps || 30);
const OUT = args.out || path.join(ROOT, 'frames');
const probes = args.probe ? String(args.probe).split(',').map(Number) : null;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--force-device-scale-factor=1', '--disable-lcd-text', '--font-render-hinting=none',
         '--hide-scrollbars', '--force-color-profile=srgb', '--disable-gpu-vsync']
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); });
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });

await page.goto(PAGE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
// make sure every image decoded
await page.evaluate(async () => {
  await Promise.all([...document.images].map(i => i.complete ? Promise.resolve() : i.decode().catch(() => {})));
});
const DUR = await page.evaluate(() => window.__DUR);

if (probes) {
  for (const t of probes) {
    await page.evaluate(v => window.render(v), t);
    const f = path.join(OUT, 'probe_' + t.toFixed(2).replace('.', '_') + '.png');
    await page.screenshot({ path: f });
    console.log('probe', t, '->', f);
  }
} else {
  const total = Math.round(DUR * FPS);
  const from = args.from !== undefined ? Number(args.from) : 0;
  const to = args.to !== undefined ? Number(args.to) : total - 1;
  const t0 = Date.now();
  for (let i = from; i <= to; i++) {
    const t = i / FPS;
    await page.evaluate(v => window.render(v), t);
    await page.screenshot({
      path: path.join(OUT, 'f' + String(i).padStart(5, '0') + '.jpg'),
      type: 'jpeg', quality: 95
    });
    if (i % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`frame ${i}/${to}  ${el.toFixed(1)}s`);
    }
  }
  console.log('done', total, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
}
await browser.close();
