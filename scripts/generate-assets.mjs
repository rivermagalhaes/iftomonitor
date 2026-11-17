// Gerador visual: usa os mesmos caminhos do componente LogoIF; nao executa build.
import { chromium } from 'playwright';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const source = 'src/assets/android', res = 'android/app/src/main/res';
const s = JSON.parse(await readFile(join(source, 'symbol.json'), 'utf8'));
const tokens = await readFile('src/tokens.css', 'utf8');
const color = name => tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`))[1];
const primary = color('primary'), white = color('white'), red = color('danger');
s.colors = { primary, white, red };
await writeFile(join(source, 'symbol.json'), JSON.stringify(s, null, 2) + '\n');
const path = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const circle = `<circle cx="${s.dot.cx}" cy="${s.dot.cy}" r="${s.dot.r}" fill="${red}"/>`;
const bus = path(s.wheels, white) + path(s.mirrors, white) + path(s.body, white) + path(s.panelFrame, primary) + path(s.panel, white) + path(s.letterI, primary) + path(s.letterF, primary) + circle + path(s.headlights, primary);
const svg = (round = false, foreground = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108" viewBox="0 0 108 108">${foreground ? '' : round ? `<circle cx="54" cy="54" r="54" fill="${primary}"/>` : `<rect width="108" height="108" fill="${primary}"/>`}${bus}</svg>`;
const vectorPath = (d, fill, extra = '') => `<path android:fillColor="${fill}" android:pathData="${d}" ${extra}/>`;
const dotPath = `M${s.dot.cx+s.dot.r} ${s.dot.cy}A${s.dot.r} ${s.dot.r} 0 1 1 ${s.dot.cx-s.dot.r} ${s.dot.cy}A${s.dot.r} ${s.dot.r} 0 1 1 ${s.dot.cx+s.dot.r} ${s.dot.cy}Z`;
const vector = content => `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">${content}</vector>\n`;
const foreground = vector(vectorPath(s.wheels, white) + vectorPath(s.mirrors, white) + vectorPath(s.body, white) + vectorPath(s.panelFrame, primary) + vectorPath(s.panel, white) + vectorPath(s.letterI, primary) + vectorPath(s.letterF, primary) + vectorPath(dotPath, red) + vectorPath(s.headlights, primary));
const monochrome = vector(vectorPath(s.wheels, white) + vectorPath(s.mirrors, white) + vectorPath([s.body,s.panelFrame,s.panel,s.letterI,s.letterF,dotPath,s.headlights].join(' '), white, 'android:fillType="evenOdd"'));
await writeFile(join(res, 'drawable/ic_launcher_foreground.xml'), foreground);
await writeFile(join(res, 'drawable-v24/ic_launcher_foreground.xml'), foreground);
await writeFile(join(res, 'drawable/ic_launcher_monochrome.xml'), monochrome);
const adaptive = '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@drawable/ic_launcher_foreground"/><monochrome android:drawable="@drawable/ic_launcher_monochrome"/></adaptive-icon>\n';
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) await writeFile(join(res, 'mipmap-anydpi-v26', name), adaptive);
await writeFile(join(source, 'icon.svg'), svg());
const browser = await chromium.launch({ headless: true });
let count = 0;
try {
 const page = await browser.newPage({ deviceScaleFactor: 1 });
 async function raster(file, content, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<html><body style="margin:0;width:${width}px;height:${height}px">${content.replace('width="108" height="108"', `width="${width}" height="${height}"`)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true }); count++;
 }
 const splash = (width,height) => { const size=Math.min(width,height)*.75; return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${primary}"/><svg x="${(width-size)/2}" y="${(height-size)/2}" width="${size}" height="${size}" viewBox="0 0 108 108">${bus}</svg></svg>`; };
 for (const directory of await readdir(res)) {
  if (!directory.startsWith('mipmap-') && !directory.startsWith('drawable')) continue;
  for (const name of await readdir(join(res,directory))) {
   if (!name.endsWith('.png')) continue;
   const file=join(res,directory,name), data=await readFile(file), width=data.readUInt32BE(16), height=data.readUInt32BE(20);
   if (name.startsWith('ic_launcher')) await raster(file, svg(name.includes('round'),name.includes('foreground')), width,height);
   else if (name==='splash.png') await raster(file,splash(width,height),width,height);
  }
 }
 await raster(join(source,'icon.png'),svg(),1024,1024);
 await raster(join(source,'splash.png'),splash(2732,2732),2732,2732);
} finally { await browser.close(); }
console.log(`Simbolo IF: vetores Android, adaptativos, monocromatico e ${count} PNGs atualizados.`);
