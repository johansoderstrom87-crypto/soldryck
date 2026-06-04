import puppeteer from "puppeteer-core";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--window-size=1400,1000"],
  defaultViewport: { width: 1400, height: 1000 },
});
const page = await browser.newPage();
await page.goto("http://localhost:3939/", { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector(".leaflet-marker-pane .marker-dot", { timeout: 30000 });
await sleep(2500);

const trackRect = await page.evaluate(() => {
  const el = document.querySelector(".select-none.touch-none");
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
});
const xOf = (h) => trackRect.left + ((h - 7 + 0.5) / 16) * trackRect.width;
const yMid = trackRect.top + trackRect.height / 2;

const count = async () =>
  page.evaluate(() => {
    const roots = Array.from(document.querySelectorAll(".leaflet-marker-pane .marker-root"));
    let attached = 0, sun = 0, shade = 0, rain = 0;
    for (const root of roots) {
      if (getComputedStyle(root).display === "none") continue;
      const dot = root.querySelector(".marker-dot");
      if (!dot) continue;
      attached++;
      if (dot.classList.contains("marker-sun")) sun++;
      else if (dot.classList.contains("marker-rain")) rain++;
      else shade++;
    }
    return { attached, sun, shade, rain };
  });
const state = async () =>
  page.evaluate(() => ({
    mainHour: document.querySelector(".time-slider-knob--main")?.textContent.trim() ?? null,
    handles: Array.from(document.querySelectorAll(".time-slider-knob--handle")).map((h) => h.textContent.trim()),
  }));

async function drag(fromH, toH) {
  await page.mouse.move(xOf(fromH), yMid);
  await page.mouse.down();
  await sleep(30);
  await page.mouse.move(xOf(toH), yMid, { steps: 12 });
  await sleep(30);
  await page.mouse.up();
  await sleep(1200);
}
async function tap(h) {
  await page.mouse.move(xOf(h), yMid);
  await page.mouse.down();
  await sleep(30);
  await page.mouse.up();
  await sleep(1200);
}

// 1) drag the single knob to hour 14
await drag(20, 14);
console.log("after move->14:", JSON.stringify(await state()), JSON.stringify(await count()));

// 2) tap on knob to split
await tap(14);
console.log("after SPLIT:    ", JSON.stringify(await state()), JSON.stringify(await count()));

// 3) drag the 'to' handle (at 17) out to 21 to widen the interval
await drag(17, 21);
console.log("after drag17->21:", JSON.stringify(await state()), JSON.stringify(await count()));

// 4) drag the 'from' handle (at 14) to 12
await drag(14, 12);
console.log("after drag14->12:", JSON.stringify(await state()), JSON.stringify(await count()));

await browser.close();
