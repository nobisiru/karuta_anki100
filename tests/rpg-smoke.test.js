const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "hyakushu-ibun.html"), "utf8");
const dom = new JSDOM(html, {
  url: "https://karuta.test/hyakushu-ibun.html",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});

const { window } = dom;
window.scrollTo = () => {};
window.confirm = () => true;
window.navigator.vibrate = () => true;
window.requestAnimationFrame = (callback) => setTimeout(callback, 0);

for (const file of [
  "data.js",
  "rpg-data.js",
  "rpg-core.js",
  "rpg-art.js",
  "hyakushu-ibun.js",
]) {
  window.eval(fs.readFileSync(path.join(root, file), "utf8"));
}

const $ = (selector) => window.document.querySelector(selector);
const click = (selector) => {
  const element = typeof selector === "string" ? $(selector) : selector;
  assert.ok(element, `クリック対象がある: ${selector}`);
  element.click();
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function defeatCurrentEnemy() {
  assert.equal($("#sealLayer").children.length, 3, "決まり字が3枚表示される");
  assert.ok(
    $("#monsterArt .painted-monster"),
    "怪異の画家調アートが描画される",
  );
  click("#openPickerButton");
  const exactNos = [...window.document.querySelectorAll(".enemy-seal")].map(
    (seal) => Number(seal.dataset.poem),
  );
  for (const no of exactNos) click(`[data-pick="${no}"]`);
  while (
    window.document.querySelectorAll('.picker-card[aria-pressed="true"]')
      .length < 5
  ) {
    const next = [
      ...window.document.querySelectorAll('.picker-card[aria-pressed="false"]'),
    ].find((button) => !button.disabled);
    click(next);
  }
  click("#closePickerButton");
  assert.equal(
    $("#slots").querySelectorAll(".uta-card").length,
    5,
    "歌珠を5枚セットできる",
  );
  click("#bindButton");
  for (const no of exactNos) {
    click(`[data-attack="${no}"]`);
    await wait(120);
  }
  await wait(150);
  assert.equal($("#resultModal").hidden, false, "3枚破断で討伐結果が出る");
  assert.equal($("#rewardRows").children.length, 3, "3首へカケラが付与される");
}

(async () => {
  assert.ok(
    $("#titleScreen").classList.contains("active"),
    "タイトル画面から始まる",
  );

  click("#newGameButton");
  assert.ok(
    $("#prologueScreen").classList.contains("active"),
    "新規開始で序章へ進む",
  );
  $("#motionToggle").checked = true;
  $("#motionToggle").dispatchEvent(new window.Event("change"));

  click("#startJourneyButton");
  assert.ok(
    $("#fieldScreen").classList.contains("active"),
    "序章からフィールドへ進む",
  );
  assert.equal(
    $("#routeNodes").children.length,
    5,
    "通常4戦とボスの道が表示される",
  );

  click("#encounterButton");
  assert.ok($("#battleScreen").classList.contains("active"), "怪異戦へ進む");
  await defeatCurrentEnemy();

  click("#resultDoneButton");
  assert.ok(
    $("#fieldScreen").classList.contains("active"),
    "結果からフィールドへ戻る",
  );
  const save = JSON.parse(window.localStorage.getItem("hyakushu_ibun_save_v1"));
  assert.equal(save.routeIndex, 1, "1戦目の進行が保存される");
  assert.equal(save.totalShards, 9, "歌のカケラが保存される");

  for (let battle = 2; battle <= 5; battle += 1) {
    click("#encounterButton");
    await defeatCurrentEnemy();
    click("#resultDoneButton");
    if (battle < 5)
      assert.ok(
        $("#fieldScreen").classList.contains("active"),
        `${battle}戦目から道へ戻る`,
      );
  }

  assert.ok(
    $("#victoryScreen").classList.contains("active"),
    "ボス撃破後に平安編クリア画面へ進む",
  );
  const clearSave = JSON.parse(
    window.localStorage.getItem("hyakushu_ibun_save_v1"),
  );
  assert.equal(clearSave.cleared, true, "平安編クリアが保存される");
  assert.equal(clearSave.defeated.length, 5, "4怪異とボスが討伐記録に残る");
  assert.equal(clearSave.totalShards, 48, "全5戦のカケラが保存される");

  console.log("百首異聞 DOM smoke test: OK");
  dom.window.close();
})().catch((error) => {
  console.error(error);
  dom.window.close();
  process.exitCode = 1;
});
