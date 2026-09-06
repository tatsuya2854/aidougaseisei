import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const MIME={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.json':'application/json','.css':'text/css','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{const p=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
 if(!p.startsWith(ROOT)||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end('x');}
 res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(res);});
await new Promise(r=>server.listen(8097,'127.0.0.1',r));
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,...v]=a.replace(/^--/,'').split('=');return [k,v.join('=')||true];}));
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--force-color-profile=srgb']});
const page=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
page.on('pageerror',e=>console.error('PAGE ERROR:',e.message));
page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE:',m.text());});
await page.goto('http://127.0.0.1:8097/'+(args.page||'render/bottleshot.html'),{waitUntil:'load'});
await page.waitForFunction(()=>window.__ready===true,{timeout:120000});
await page.screenshot({path:args.out||'/tmp/bottle.png',omitBackground:!args.white});
console.log('ok');
await b.close(); server.close();
