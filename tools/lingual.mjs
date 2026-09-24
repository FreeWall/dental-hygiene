export default async function (page, i, outDir) {
  await page.click('#btnPlay');
  await page.locator('.level').nth(2).click();
  await page.click('#btnBriefGo');
  await page.waitForTimeout(300);
  await page.locator('.view-btn').nth(6).click();
  await page.waitForTimeout(1200);
  await page.locator('.tool-btn').nth(3).click();
  const vp = page.viewportSize();
  const before = await page.evaluate(() => window.__game.progress.calc);
  for (let row = 0; row < 3; row++) {
    const y = vp.height * (0.42 + row * 0.07);
    await page.mouse.move(vp.width * 0.33, y);
    await page.mouse.down();
    for (let k = 0; k < 50; k++) { await page.mouse.move(vp.width * 0.33 + k * 8, y + Math.sin(k) * 6); await page.waitForTimeout(25); }
    await page.mouse.up();
  }
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ calc: window.__game.progress.calc, water: window.__game.state.water, comfort: window.__game.state.comfort }));
  console.log(JSON.stringify({ before, after }));
}
