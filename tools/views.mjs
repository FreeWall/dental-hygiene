export default async function (page, i, outDir) {
  const shot = (n) => page.screenshot({ path: `${outDir}/v${n}.png` });
  await page.click('#btnPlay');
  await page.locator('.level').nth(Number(process.env.LEVEL ?? 4)).click();
  await page.click('#btnBriefGo');
  await page.waitForTimeout(600);
  await shot('0-front');
  const names = ['front', 'right', 'left', 'upper', 'lower', 'palatal', 'lingual'];
  for (const k of (process.env.VIEWS ?? '1,3,4,6').split(',').map(Number)) {
    await page.locator('.view-btn').nth(k).click();
    await page.waitForTimeout(1300);
    await shot(`${k}-${names[k]}`);
  }
}
