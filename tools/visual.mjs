export default async function (page, i, outDir) {
  const shot = (n) => page.screenshot({ path: `${outDir}/x${n}.png` });
  await page.click('#btnPlay');
  await page.locator('.level').nth(1).click();
  await page.click('#btnBriefGo');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const g = window.__game;
    g.selectTool('disclose');
    // vyčistit a vyleštit polovinu zubů (levá strana pacienta), fluorid na horní
    for (const t of g.mouth.teeth) {
      if (t.sigma > 0) {
        for (let k = 0; k < t.n; k++) { t.dirt[k*4]=0; t.dirt[k*4+1]=0; t.dirt[k*4+2]=0; t.dirt[k*4+3]=0; t.care[k*4]=1; if (t.jaw==='upper') t.care[k*4+1]=1; }
        t.dirty = true; t.dirtAttr.needsUpdate = true; t.careAttr.needsUpdate = true;
      }
    }
    g.rig.set({ target: new (g.rig.target.constructor)(0, 2, 22), yaw: 0.25, pitch: 0.1, dist: 55 }, true);
  });
  await page.waitForTimeout(1500);
  await shot('0-half');
  await page.click('#btnReveal');
  await page.waitForTimeout(250);
  await shot('1-reveal');
}
