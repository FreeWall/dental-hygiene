// Ladicí screenshoty: node tools/shot.mjs <out-dir> <w>x<h> <path1> [path2 ...]
// Volitelně SCRIPT=tools/x.mjs (export default async (page, i) => {}) a WAIT=ms
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';

const [, , outDir, size, ...paths] = process.argv;
const [w, h] = size.split('x').map(Number);
const server = process.env.PREVIEW
  ? await preview({ configFile: 'vite.config.js', preview: { port: 5199, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' })
  : await createServer({ configFile: 'vite.config.js', server: { port: 5199, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
if (!process.env.PREVIEW) await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!process.env.TOUCH });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
let i = 0;
for (const p of paths) {
  await page.goto('http://127.0.0.1:5199' + p);
  try {
    await page.waitForFunction(() => window.__ready, null, { timeout: 40000 });
  } catch {
    logs.push('TIMEOUT ' + p);
  }
  if (process.env.SCRIPT) {
    const fn = (await import(process.cwd() + '/' + process.env.SCRIPT)).default;
    await fn(page, i, outDir);
  }
  await page.waitForTimeout(Number(process.env.WAIT ?? 200));
  await page.screenshot({ path: `${outDir}/shot${i++}.png` });
}
console.log(logs.join('\n'));
await browser.close();
await (server.close ? server.close() : server.httpServer.close());
