// Proklikání hry: úvod -> pacient -> ošetření
export default async function (page, i, outDir) {
  const shot = (n) => page.screenshot({ path: `${outDir}/p${n}.png` });
  await page.waitForTimeout(300);
  await shot('0-start');
  await page.click('#btnPlay');
  await page.waitForTimeout(200);
  await shot('1-levels');
  const lvl = Number(process.env.LEVEL ?? 2);
  await page.locator('.level').nth(lvl).click();
  await page.waitForTimeout(300);
  await shot('2-brief');
  await page.click('#btnBriefGo');
  await page.waitForTimeout(800);
  await shot('3-hud');
  // obarvit plak
  await page.locator('.tool-btn').nth(1).click();
  await page.waitForTimeout(1500);
  await shot('4-disclosed');
  // ultrazvuk: tahy přes horní řezáky
  await page.locator('.tool-btn').nth(3).click();
  const vp = page.viewportSize();
  const cx = vp.width / 2, cy = vp.height * 0.33;
  await page.mouse.move(cx - 60, cy);
  await page.mouse.down();
  for (let k = 0; k < 40; k++) {
    await page.mouse.move(cx - 60 + k * 3, cy + Math.sin(k / 3) * 12);
    await page.waitForTimeout(30);
  }
  await shot('5-scaling');
  await page.mouse.up();
  // airflow
  await page.locator('.tool-btn').nth(2).click();
  await page.mouse.move(cx - 80, cy + 10);
  await page.mouse.down();
  for (let k = 0; k < 40; k++) {
    await page.mouse.move(cx - 80 + k * 4, cy + 10 + Math.sin(k / 2) * 10);
    await page.waitForTimeout(30);
  }
  await shot('6-airflow');
  await page.mouse.up();
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => JSON.stringify({ p: window.__game.progress, s: { water: window.__game.state.water, comfort: window.__game.state.comfort } }));
  console.log(info);
}
