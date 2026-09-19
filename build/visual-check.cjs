const { chromium } = require('./browser-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true});
  const reports = [];
  for (const [label,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,740]]) {
    const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    const errors = [];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`)});
    await page.goto('http://127.0.0.1:8088/',{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(__dirname,`invitation-${label}-intro.png`)});
    await page.locator('[data-open-invitation]').click();
    await page.waitForTimeout(2900);
    await page.screenshot({path:path.join(__dirname,`invitation-${label}-hero.png`)});
    for (const [name,selector] of [['date','#our-date'],['story','#our-story'],['events','#celebrations'],['venue','#venue']]) {
      await page.locator(selector).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
      await page.waitForTimeout(1100);
      await page.screenshot({path:path.join(__dirname,`invitation-${label}-${name}.png`)});
    }
    const fullHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
    for(let y=0;y<fullHeight;y+=700){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(100);}
    await page.waitForTimeout(900);
    await page.screenshot({path:path.join(__dirname,`invitation-${label}-full.png`),fullPage:true});
    const metrics = await page.evaluate(()=>({
      width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
      font:getComputedStyle(document.querySelector('.name')).fontFamily,
      brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),
      unseen:[...document.querySelectorAll('.reveal')].filter(e=>!e.classList.contains('is-visible')).length,
      events:document.querySelectorAll('.event-card').length,
      photos:document.querySelectorAll('.polaroid').length,
      bytes:performance.getEntriesByType('resource').reduce((n,e)=>n+e.transferSize,0),
      resources:performance.getEntriesByType('resource').map(e=>({name:e.name,size:e.transferSize}))
    }));
    reports.push({label,errors,...metrics});
    await page.close();
  }
  fs.writeFileSync(path.join(__dirname,'visual-report.json'),JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports,null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
