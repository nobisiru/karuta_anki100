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

window.eval(fs.readFileSync(path.join(root, "data.js"), "utf8"));
window.eval(fs.readFileSync(path.join(root, "voice-mode.js"), "utf8"));

function click(selector) {
  const element = document.querySelector(selector);
  assert(element, `Missing element: ${selector}`);
  element.click();
  return element;
}

function answerCurrent(rating = "yes") {
  click("#vNext");
  click("#vNext");
  click("#vReveal");
  click(`.voice-self [data-rate="${rating}"]`);
}

function answerSeven(rating = "yes") {
  for (let count = 0; count < 7; count += 1) answerCurrent(rating);
}

assert.strictEqual(
  window.KarutaVoiceMode.oneCards().length,
  7,
  "one-character pool",
);
assert.strictEqual(
  window.KarutaVoiceMode.twoCards().length,
  42,
  "two-character pool",
);
assert.strictEqual(
  document.querySelectorAll("#voiceScreen").length,
  1,
  "single voice screen",
);

click("#voiceEntry");
assert.strictEqual(
  document.querySelector("#voiceSetup").hidden,
  false,
  "setup opens first",
);
assert(
  document
    .querySelector('.voice-mode-option[data-kind="one"]')
    .classList.contains("selected"),
);

click('.voice-mode-option[data-kind="two"]');
assert(document.querySelector("#voiceGroups").classList.contains("show"));
assert.strictEqual(
  document.querySelectorAll(".voice-group").length,
  6,
  "six groups of seven",
);
assert.strictEqual(
  document.querySelector("#voiceGroupPreview").textContent,
  "あし・たご・おく・かさ・これ・つく・みち",
);

click(".voice-group:nth-child(6)");
assert.strictEqual(
  document.querySelector("#voiceGroupPreview").textContent,
  "おお・なげ・わす・あら・もも・きり・ひと",
);
click("#voiceStart");
assert.strictEqual(document.querySelector("#voiceKey").textContent, "おお");
assert.strictEqual(
  document.querySelector("#voiceProgress").textContent,
  "1 / 7",
);
answerSeven();
assert(document.querySelector("#voiceSummary").classList.contains("show"));
assert.strictEqual(document.querySelector("#voiceBig").textContent, "7 / 7");
assert.strictEqual(
  document.querySelector("#voiceSummaryMode").textContent,
  "二字決まり・第6組",
);
assert.strictEqual(document.querySelector("#voiceNextGroup").hidden, true);

click("#voiceChoose");
click(".voice-group:nth-child(1)");
click("#voiceStart");
assert.strictEqual(document.querySelector("#voiceKey").textContent, "あし");
answerSeven();
assert.strictEqual(document.querySelector("#voiceNextGroup").hidden, false);
click("#voiceNextGroup");
assert.strictEqual(document.querySelector("#voiceKey").textContent, "たち");
assert.strictEqual(
  document.querySelector("#voiceProgress").textContent,
  "1 / 7",
);

click("#voiceBack");
click("#voiceEntry");
click('.voice-mode-option[data-kind="one"]');
click("#voiceStart");
assert.strictEqual(document.querySelector("#voiceKey").textContent, "む");
answerCurrent("no");
answerCurrent("yes");
answerCurrent("yes");
assert.strictEqual(document.querySelector("#voiceKey").textContent, "む");
assert.strictEqual(
  document.querySelector("#voiceProgress").textContent,
  "1 / 7・復習",
);

dom.window.close();
console.log("voice-mode.test.js: all assertions passed");
