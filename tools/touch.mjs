// Emulace dotyků přes CDP: tah jedním prstem po zubech + pinch
export default async function (page, i, outDir) {
  const shot = (n) => page.screenshot({ path: `${outDir}/t${n}.png` });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, id) => ({ x: p[0], y: p[1], id })) });
  await page.tap('#btnPlay');
  await page.locator('.level').nth(2).tap();
  await page.tap('#btnBriefGo');
  await page.waitForTimeout(400);
  await page.locator('.tool-btn').nth(1).tap();
  await page.locator('.tool-btn').nth(2).tap();
  const vp = page.viewportSize();
  const x0 = vp.width * 0.4, y0 = vp.height * 0.36 + 64; // prst pod pracovním bodem
  await touch('touchStart', [[x0, y0]]);
  for (let k = 0; k < 30; k++) {
    await touch('touchMove', [[x0 + k * 4, y0 + Math.sin(k / 2) * 6]]);
    await page.waitForTimeout(30);
  }
  await shot('0-drag');
  await touch('touchEnd', []);
  const p1 = await page.evaluate(() => window.__game.progress.plaque);
  // pinch zoom
  const d0 = await page.evaluate(() => window.__game.rig.goal.dist);
  await touch('touchStart', [[vp.width / 2 - 40, vp.height / 2], [vp.width / 2 + 40, vp.height / 2]]);
  for (let k = 0; k < 10; k++) {
    await touch('touchMove', [[vp.width / 2 - 40 - k * 10, vp.height / 2], [vp.width / 2 + 40 + k * 10, vp.height / 2]]);
    await page.waitForTimeout(20);
  }
  await touch('touchEnd', []);
  const d1 = await page.evaluate(() => window.__game.rig.goal.dist);
  // orbit tahem mimo zuby
  const y1 = await page.evaluate(() => window.__game.rig.goal.yaw);
  await touch('touchStart', [[40, vp.height * 0.5]]);
  for (let k = 0; k < 10; k++) { await touch('touchMove', [[40 + k * 10, vp.height * 0.5]]); await page.waitForTimeout(20); }
  await touch('touchEnd', []);
  const y2 = await page.evaluate(() => window.__game.rig.goal.yaw);
  await page.waitForTimeout(600);
  await shot('1-after');
  console.log(JSON.stringify({ plaqueAfterDrag: p1, distBefore: d0, distAfter: d1, yawBefore: y1, yawAfter: y2 }));
}
