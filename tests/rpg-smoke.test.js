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
  const recommendedNos = [
    ...window.document.querySelectorAll("#pickerGrid [data-pick]"),
  ].map((card) => Number(card.dataset.pick));
  assert.deepEqual(
    recommendedNos,
    [...recommendedNos].sort((a, b) => a - b),
    "今回の候補札が歌番号順に並ぶ",
  );
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
  assert.equal($("#pickerModal").hidden, true, "5枚目で札選択が自動で閉じる");
  assert.equal(
    $("#deckReadyModal").hidden,
    false,
    "5枚目でバトル確認がポップアップする",
  );
  assert.equal(
    $("#slots").querySelectorAll(".uta-card").length,
    5,
    "歌珠を5枚セットできる",
  );
  click("#readyBattleButton");
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
  assert.equal($("#routeNodes").children.length, 3, "一階の3戦が表示される");
  assert.equal($("#schoolFloors").children.length, 4, "校内4章が表示される");

  click("#encounterButton");
  assert.ok($("#battleScreen").classList.contains("active"), "怪異戦へ進む");
  await defeatCurrentEnemy();

  click("#resultDoneButton");
  assert.ok(
    $("#fieldScreen").classList.contains("active"),
    "結果からフィールドへ戻る",
  );
  const save = JSON.parse(window.localStorage.getItem("hyakushu_ibun_save_v2"));
  assert.equal(save.chapterIndex, 0, "1戦目は一階にいる");
  assert.equal(save.encounterIndex, 1, "1戦目の進行が保存される");
  assert.equal(save.totalShards, 9, "歌のカケラが保存される");

  for (let battle = 2; battle <= 11; battle += 1) {
    click("#encounterButton");
    await defeatCurrentEnemy();
    click("#resultDoneButton");
    if ([3, 6, 9].includes(battle)) {
      assert.ok(
        $("#chapterScreen").classList.contains("active"),
        `${battle}戦目で章クリア物語へ進む`,
      );
      click("#chapterContinueButton");
      assert.ok(
        $("#fieldScreen").classList.contains("active"),
        "章間物語から次の階へ進む",
      );
    } else if (battle < 11) {
      assert.ok(
        $("#fieldScreen").classList.contains("active"),
        `${battle}戦目から校内マップへ戻る`,
      );
    }
  }

  assert.ok(
    $("#victoryScreen").classList.contains("active"),
    "道長撃破後に学校編クリア画面へ進む",
  );
  const clearSave = JSON.parse(
    window.localStorage.getItem("hyakushu_ibun_save_v2"),
  );
  assert.equal(clearSave.cleared, true, "学校編4章クリアが保存される");
  assert.equal(clearSave.defeated.length, 11, "怪異10体と道長が記録に残る");
  assert.equal(clearSave.totalShards, 114, "全11戦のカケラが保存される");
  assert.deepEqual(
    clearSave.completedChapters,
    ["first_floor", "second_floor", "third_floor", "staff_room"],
    "一階から教員室まで4章の完了を保存する",
  );
  assert.equal(clearSave.maxHp, 130, "一階報酬で最大HPが上がる");
  assert.equal(clearSave.maxMp, 110, "二階報酬で最大MPが上がる");
  assert.equal(clearSave.guardBonus, 2, "三階報酬で守りが上がる");

  console.log("百首異聞 DOM smoke test: OK");
  dom.window.close();
})().catch((error) => {
  console.error(error);
  dom.window.close();
  process.exitCode = 1;
});
