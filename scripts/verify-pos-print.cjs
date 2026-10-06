const { chromium } = require(process.env.POS_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../native/sunmi-v3/build/packaged/assets/pos');
(async()=>{
 const browser=await chromium.launch({channel:process.env.POS_BROWSER_CHANNEL || 'msedge',headless:true});
 const width=Number(process.env.POS_TEST_WIDTH || 360);
 const page=await browser.newPage({viewport:{width,height:720},isMobile:width<600,deviceScaleFactor:2});
 page.setDefaultTimeout(5000);
 try {
 page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await page.route('**/*', async route=>{
  const u=new URL(route.request().url());
  if(u.hostname!=='pos.volta.invalid')return route.fulfill({json:{}});
  const f=path.join(base,u.pathname==='/'?'index.html':u.pathname);
  if(!fs.existsSync(f))return route.fulfill({status:404,body:''});
  await route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':'image/png'});
 });
 await page.addInitScript(()=>{
  window.__calls=[];
  const order={id:772,code:'WEB-85FA47F2CB107A2A4021FDA74',createdAt:new Date().toISOString(),date:new Date().toISOString(),total:4.94,status:'PAID',delivery:'PICKUP',customerData:{name:'Prueba local',paymentMode:'cash',paymentStatus:'cash_pending'},products:[{name:'Pizza prueba',quantity:1,price:4.94}]};
  window.VoltaNative={call(id,operation,raw){
   const p=JSON.parse(raw);window.__calls.push({operation,path:p.path});
   let data={};
   if(operation==='restore')data={storeId:2,storeName:'vigoCity',partnerId:1,partnerName:'Prueba',deviceName:'SUNMI V3'};
   if(operation==='printerStatus')data={realConnected:true,label:'SUNMI V3'};
   if(operation==='updateStatus')data={state:'idle',versionName:'0.3.20'};
   if(operation==='request'){
    if(p.path.includes('/pending'))data={items:[order]};
    else if(p.path.includes('/presence/'))data={presence:{activeVisitors:0}};
    else if(p.path.includes('/stores/'))data={id:2,active:true,acceptingOrders:true,operationsPaused:false,storeName:'vigoCity'};
    else data={items:[]};
   }
   setTimeout(()=>window.__voltaResult(id,{status:200,data}),50);
  }};
 });
 await page.goto('https://pos.volta.invalid/');
 await page.waitForTimeout(1300);
 await page.locator('.pos-syncChip').click();
 await page.waitForTimeout(1000);
 console.log('loaded');
 await page.locator('.pos-newOrderAcceptBtn').click({force:true});
 console.log('accepted');
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.locator('.pos-orderCard').click();
 await page.getByRole('button',{name:'Imprimir',exact:true}).scrollIntoViewIfNeeded();
 const metrics=()=>page.evaluate(()=>({x:scrollX,y:scrollY,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,shell:document.querySelector('.pos-shell').getBoundingClientRect().toJSON(),dialog:document.querySelector('.pos-noticeDialog').getBoundingClientRect().toJSON()}));
 console.log('before',await metrics());
 await page.screenshot({path:path.join(base,'../pos-before-print.png')});
 await page.getByRole('button',{name:'Imprimir',exact:true}).click();
 await page.waitForTimeout(300);
 console.log('after',await metrics());
 const actual=await metrics();
 require('assert').strictEqual(actual.width,width,'Viewport must not grow beyond the terminal screen');
 require('assert').strictEqual(actual.scrollWidth,width,'Ticket must not overflow horizontally');
 require('assert').strictEqual(actual.x,0,'Printing must not shift the screen');
 require('assert').strictEqual(await page.locator('dialog[open]').count(),0,'Printing must not open a blocking dialog');
 await page.locator('.pos-printStatus--success').waitFor();
 await page.screenshot({path:path.join(base,'../pos-after-print.png')});
 await page.getByRole('button',{name:'Imprimir',exact:true}).click();
 await page.locator('.pos-printStatus--success').waitFor();
 require('assert').strictEqual(await page.evaluate(()=>window.__calls.filter(c=>c.operation==='print').length),2);
 await page.getByRole('button',{name:'Cola',exact:true}).click();
 await page.locator('.pos-orderCard').waitFor();
 console.log('PASS print twice and return to queue',width);
 } catch(e){ console.log('failure',e.message); console.log((await page.locator('body').innerText()).slice(0,1800)); await page.screenshot({path:path.join(base,'../pos-failure.png')});throw e; }
 finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});



