const { chromium } = require('./browser-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}, deviceScaleFactor:1});
  await page.goto('https://invifest-demo.vercel.app/', {waitUntil:'networkidle', timeout:45000});
  await page.screenshot({path:path.join(__dirname,'reference-intro.png')});
  console.log('INTRO:', (await page.locator('body').innerText()).slice(0,3500));
  console.log('BUTTONS:', await page.locator('button').allTextContents());
  await page.mouse.click(720,500);
  await page.waitForTimeout(14000);
  await page.screenshot({path:path.join(__dirname,'reference-open.png')});
  console.log('OPEN:', (await page.locator('body').innerText()).slice(0,7000));
  console.log('MEDIA:', await page.locator('img,video,audio').evaluateAll(els=>els.map(e=>({tag:e.tagName,src:e.currentSrc||e.src,alt:e.alt}))));
  const canvases = page.locator('canvas');
  console.log('CANVASES:', await canvases.count());
  for (let i=0;i<await canvases.count();i++) {
    const canvas = canvases.nth(i);
    const before = await canvas.boundingBox();
    if (!before || before.width > 500) continue;
    await canvas.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForTimeout(800);
    const box = await canvas.boundingBox();
    for(let y=12;y<box.height-5;y+=15) {
      await page.mouse.move(box.x+5,box.y+y);
      await page.mouse.down();
      await page.mouse.move(box.x+box.width-5,box.y+y,{steps:12});
      await page.mouse.up();
    }
  }
  await page.waitForTimeout(1500);
  console.log('REVEALED:', (await page.locator('body').innerText()).slice(0,12000));
  console.log('ALL MEDIA:', await page.locator('img').evaluateAll(els=>els.map(e=>({src:e.currentSrc||e.src,alt:e.alt}))));
  const height = await page.evaluate(()=>document.documentElement.scrollHeight);
  for (let y=0;y<height;y+=750) {await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(150);}
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(__dirname,'reference-full.png'),fullPage:true});
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
