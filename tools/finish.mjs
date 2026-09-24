// Rychlé ověření konce hry: vyčistí vše programově a projde výsledky + kvíz
export default async function (page, i, outDir) {
  const shot = (n) => page.screenshot({ path: `${outDir}/f${n}.png` });
  await page.click('#btnPlay');
  await page.locator('.level').nth(Number(process.env.LEVEL ?? 0)).click();
  await page.click('#btnBriefGo');
  await page.waitForTimeout(500);
  await shot('0-tutorial');
  await page.evaluate(() => {
    const g = window.__game;
    g.selectTool('disclose');
    for (const t of g.mouth.teeth) {
      for (let k = 0; k < t.n; k++) { t.dirt[k*4]=0; t.dirt[k*4+1]=0; t.dirt[k*4+2]=0; t.dirt[k*4+3]=0; t.care[k*4]=1; t.care[k*4+1]=1; }
      t.dirty = true; t.dirtAttr.needsUpdate = true; t.careAttr.needsUpdate = true;
      if (t.hasCaries) { t.cariesFound = true; g.state.cariesFound++; }
    }
  });
  await page.waitForTimeout(1200);
  await shot('1-clean');
  await page.click('#btnChart');
  await page.waitForTimeout(300);
  await shot('2-chart');
  await page.click('#btnChartClose');
  await page.click('#btnFinish');
  await page.waitForTimeout(400);
  await shot('3-result');
  await page.click('#btnResNext');
  await page.waitForTimeout(300);
  await page.locator('.qa').first().click();
  await page.waitForTimeout(300);
  await shot('4-quiz');
  await page.click('#btnQuizNext');
  await page.waitForTimeout(300);
  await page.locator('.qa').nth(1).click();
  await page.waitForTimeout(200);
  await shot('5-quiz2');
  await page.click('#btnQuizNext');
  await page.waitForTimeout(300);
  await shot('6-levels');
}
