const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const dom = new JSDOM(
  `<!doctype html><html><head></head><body>
    <main class="app">
      <section id="startScreen" class="page active"><div class="panel"><button id="dashBtn">成績</button></div></section>
    </main>
  </body></html>`,
  { runScripts: "dangerously", url: "https://example.test/" },
);
const { window } = dom;
const document = window.document;
const plays = [];
let stopCount = 0;
let unlockCount = 0;

window.__KARUTA_REVEAL_DELAY_MS__ = 20;
window.__KARUTA_AUDIO_LEAD_MS__ = 10;
window.__KARUTA_CHARACTER_MS__ = 10;
window.__KARUTA_REVEAL_ORDER__ = [
  87,
  ...Array.from({ length: 86 }, (_, index) => index + 1),
  ...Array.from({ length: 13 }, (_, index) => index + 88),
];
window.KarutaLocalAudio = {
  countTracks: async () => 100,
  unlock: () => {
    unlockCount += 1;
  },
  stop: () => {
    stopCount += 1;
  },
  playNumber: async (number, handlers) => {
    plays.push({ number, handlers });
    return true;
  },
};

window.eval(fs.readFileSync(path.join(root, "data.js"), "utf8"));
window.eval(fs.readFileSync(path.join(root, "rpg-data.js"), "utf8"));
window.eval(fs.readFileSync(path.join(root, "listen-reveal-mode.js"), "utf8"));

function click(selector) {
  const element = document.querySelector(selector);
  assert(element, `Missing element: ${selector}`);
  element.click();
  return element;
}

function tick(milliseconds = 0) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

(async () => {
  assert.strictEqual(
    document.querySelectorAll("#listenRevealScreen").length,
    1,
    "single listen and reveal screen",
  );
  assert(document.querySelector("#listenRevealEntry"), "entry button is added");

  click("#listenRevealEntry");
  await tick();
  assert.strictEqual(document.querySelector("#listenStart").disabled, false);
  assert.match(document.querySelector("#listenSource").textContent, /100\/100/);

  click("#listenStart");
  await tick();
  assert.strictEqual(
    unlockCount,
    1,
    "audio is unlocked from the start gesture",
  );
  assert.strictEqual(plays[0].number, 87, "a random upper poem starts first");
  assert.strictEqual(document.querySelector("#listenCardScene").hidden, true);
  assert.strictEqual(document.querySelector("#listenAudioScene").hidden, false);

  await tick(25);
  assert.strictEqual(document.querySelector("#listenCardScene").hidden, false);
  assert.strictEqual(document.querySelector("#listenAudioScene").hidden, true);
  assert.strictEqual(
    [...document.querySelectorAll("#listenFudaGrid .listen-fuda-char")]
      .map((element) => element.textContent)
      .join(""),
    window.ALL_LOWER[86].lower,
    "matching lower card appears at its decision-key timing",
  );
  assert.match(document.querySelector("#listenKimariResult").textContent, /む/);
  assert(
    window.KarutaListenRevealMode.decisionDelay(87) <
      window.KarutaListenRevealMode.decisionDelay(1),
    "one-character poem reveals sooner than a three-character poem",
  );

  await tick(25);
  assert.strictEqual(
    plays[1].number,
    1,
    "next upper poem starts automatically",
  );
  assert.strictEqual(
    document.querySelector("#listenProgress").textContent,
    "2 / 100",
  );

  click("#listenPause");
  assert.match(document.querySelector("#listenPhase").textContent, /一時停止/);
  click("#listenPause");
  await tick();
  assert.strictEqual(
    plays.at(-1).number,
    1,
    "resume restarts the current audio",
  );

  click("#listenNext");
  await tick();
  assert.strictEqual(plays.at(-1).number, 2, "next button skips to next poem");

  click("#listenBack");
  assert(document.querySelector("#startScreen").classList.contains("active"));
  assert(stopCount > 0, "leaving the mode stops audio");

  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const localAudio = fs.readFileSync(path.join(root, "local-audio.js"), "utf8");
  assert.match(indexHtml, /listen-reveal-mode\.js/);
  assert.match(localAudio, /playNumber/);

  dom.window.close();
  console.log("listen-reveal-mode.test.js: all assertions passed");
})().catch((error) => {
  dom.window.close();
  console.error(error);
  process.exitCode = 1;
});
