import puppeteer from "puppeteer-core";
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--no-sandbox","--window-size=1400,1000"],defaultViewport:{width:1400,height:1000}});
const page=await b.newPage();
await page.goto("http://localhost:3939/",{waitUntil:"networkidle2",timeout:60000});
await page.waitForSelector(".select-none.touch-none",{timeout:30000});
await sleep(2000);
const info=await page.evaluate(()=>{
  const el=document.querySelector(".select-none.touch-none");
  const r=el.getBoundingClientRect();
  const cx=r.left+r.width*0.5, cy=r.top+r.height/2;
  const top=document.elementFromPoint(cx,cy);
  const cls=(n)=>!n?null:n.tagName+"|"+((typeof n.className==="string"?n.className:n.className?.baseVal)||"");
  let isAnc=false,p=top;while(p){if(p===el){isAnc=true;break;}p=p.parentElement;}
  // chain from top
  const chain=[];let q=top;for(let i=0;i<6&&q;i++){chain.push(cls(q)+" pe="+getComputedStyle(q).pointerEvents);q=q.parentElement;}
  return {rect:{l:r.left,t:r.top,w:r.width,h:r.height}, cx, cy, trackAncestorOfHit:isAnc, chain};
});
console.log(JSON.stringify(info,null,2));
await b.close();
