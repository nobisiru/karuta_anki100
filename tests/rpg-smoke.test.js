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
window.__HYAKUSHU_TEST__ = true;
window.scrollTo = () => {};
window.confirm = () => true;
window.navigator.vibrate = () => true;
window.requestAnimationFrame = (callback) => setTimeout(callback, 0);

for (const file of [
  "data.js",
  "rpg-data.js",
  "rpg-core.js",
  "rpg-art.js",
  "rpg-audio.js",
]) {
  window.eval(fs.readFileSync(path.join(root, file), "utf8"));
}

const readerCalls = [];
window.HyakushuRpgAudio.playPoem = async (no) => {
  readerCalls.push(Number(no));
  return false;
};
window.HyakushuRpgAudio.stop = () => {};
window.HyakushuRpgAudio.unlock = () => {};
window.HyakushuRpgAudio.status = async () => ({
  enabled: true,
  count: 100,
  label: "読手音声 ON・100/100首",
});

window.eval(fs.readFileSync(path.join(root, "hyakushu-ibun.js"), "utf8"));

const $ = (selector) => window.document.querySelector(selector);
const click = (selector) => {
  const element = typeof selector === "string" ? $(selector) : selector;
  assert.ok(element, "クリック対象がある");
  element.click();
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(predicate, message, timeout = 800) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return;
    await wait(8);
  }
  assert.fail(message);
}

let mistakeChecked = false;
let opponentChecked = false;
let carryDamageChecked = false;
let carriedHp = null;

async function defeatCurrentEnemy(battleNumber) {
  assert.equal($("#sealLayer").children.length, 3, "三本勝負が表示される");
  assert.ok(
    $("#monsterArt .painted-monster"),
    "怪異の画家調アートが描画される",
  );
  assert.equal(
    window.document.querySelectorAll("#speedPips .active").length,
    battleNumber,
    "戦う順に相手の速度段階が上がる",
  );

  for (let round = 0; round < 3; round += 1) {
    await waitFor(
      () =>
        !$("#raceCards").classList.contains("waiting") &&
        $("#raceCards").children.length === 6,
      "6枚が解禁されて読みが始まる",
    );
    const cards = [...$("#raceCards").querySelectorAll("[data-race-no]")];
    assert.equal(cards.length, 6, "毎問6枚の取り札が並ぶ");
    assert.equal(
      new Set(cards.map((card) => card.dataset.raceNo)).size,
      6,
      "6枚に重複がない",
    );
    assert.equal(
      cards.filter((card) => card.dataset.raceCorrect === "true").length,
      1,
      "正解札は1枚だけ",
    );

    if (!mistakeChecked) {
      mistakeChecked = true;
      const failedPoemNo = Number(
        cards.find((card) => card.dataset.raceCorrect === "true").dataset
          .raceNo,
      );
      const hpBefore = Number($("#hpText").textContent.split("/")[0]);
      click(cards.find((card) => card.dataset.raceCorrect === "false"));
      assert.match($("#raceStatus").textContent, /お手つき/, "誤札を判定する");
      assert.match(
        $("#effectLayer .hp-damage-number").textContent,
        /-\d+ HP/,
        "お手つきのHPダメージを大きく表示する",
      );
      assert.ok(
        Number($("#hpText").textContent.split("/")[0]) < hpBefore,
        "お手つきでHPが減る",
      );
      await waitFor(
        () =>
          !$("#raceCards").classList.contains("waiting") &&
          $("#raceCards").children.length === 6 &&
          $("#raceStatus").textContent === "読み進行中",
        "別の一首を6枚で再挑戦できる",
      );
      assert.notEqual(
        Number($('#raceCards [data-race-correct="true"]').dataset.raceNo),
        failedPoemNo,
        "お手つき後は同じ札ではなく別の歌を読む",
      );
    }

    if (!opponentChecked) {
      opponentChecked = true;
      const takenPoemNo = Number(
        $('#raceCards [data-race-correct="true"]').dataset.raceNo,
      );
      const hpBefore = Number($("#hpText").textContent.split("/")[0]);
      await waitFor(
        () => /怪異が先に払った/.test($("#raceStatus").textContent),
        "時間切れで怪異が正解札を先取する",
        1200,
      );
      assert.match(
        $("#effectLayer .hp-damage-number").textContent,
        /-\d+ HP/,
        "怪異の先取でもHPダメージを大きく表示する",
      );
      assert.ok(
        Number($("#hpText").textContent.split("/")[0]) < hpBefore,
        "怪異の先取でHPが減る",
      );
      await waitFor(
        () =>
          !$("#raceCards").classList.contains("waiting") &&
          $("#raceStatus").textContent === "読み進行中",
        "怪異に取られた後は次の問題へ進める",
      );
      assert.notEqual(
        Number($('#raceCards [data-race-correct="true"]').dataset.raceNo),
        takenPoemNo,
        "怪異に取られた後は同じ札ではなく別の歌を読む",
      );
    }

    if (battleNumber === 4 && !carryDamageChecked) {
      carryDamageChecked = true;
      const failedPoemNo = Number(
        $('#raceCards [data-race-correct="true"]').dataset.raceNo,
      );
      const wrong = [
        ...$("#raceCards").querySelectorAll("[data-race-no]"),
      ].find((card) => card.dataset.raceCorrect === "false");
      click(wrong);
      carriedHp = Number($("#hpText").textContent.split("/")[0]);
      await waitFor(
        () =>
          !$("#raceCards").classList.contains("waiting") &&
          $("#raceStatus").textContent === "読み進行中",
        "二階でもお手つき後に次の問題へ進む",
      );
      assert.notEqual(
        Number($('#raceCards [data-race-correct="true"]').dataset.raceNo),
        failedPoemNo,
        "二階でもお手つき後の歌を差し替える",
      );
    }

    const correct = $('#raceCards [data-race-correct="true"]');
    click(correct);
    assert.equal(
      window.document.querySelectorAll("#sealLayer .broken").length,
      round + 1,
      "正解するたび封印が一つ結ばれる",
    );

    if (round < 2) {
      await waitFor(
        () =>
          !$("#raceCards").classList.contains("waiting") &&
          $("#raceStatus").textContent === "読み進行中",
        "次の一首が自動で始まる",
      );
    }
  }

  await waitFor(
    () => $("#resultModal").hidden === false,
    "三首先取で討伐結果が出る",
  );
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

  for (let battle = 1; battle <= 11; battle += 1) {
    click("#encounterButton");
    assert.ok($("#battleScreen").classList.contains("active"), "怪異戦へ進む");
    if (battle === 11) {
      assert.equal($("#rivalRank").textContent, "名人級", "最終戦は名人級");
      assert.match(
        $("#enemyName").textContent,
        /校長.*藤原道長/,
        "藤原道長に憑依された校長と戦う",
      );
    }

    await defeatCurrentEnemy(battle);
    if (battle === 1) {
      const damageSave = JSON.parse(
        window.localStorage.getItem("hyakushu_ibun_save_v2"),
      );
      assert.ok(
        damageSave.hp < damageSave.maxHp,
        "戦闘終了後も受けたダメージを自動回復しない",
      );
    }
    click("#resultDoneButton");

    if ([3, 6, 9].includes(battle)) {
      assert.ok(
        $("#chapterScreen").classList.contains("active"),
        "章クリア物語へ進む",
      );
      if (battle === 3) {
        assert.equal(
          $("#chapterRecovery").hidden,
          false,
          "一階クリア後にHP回復イベントが起きる",
        );
        assert.match(
          $("#chapterRecoveryAmount").textContent,
          /全回復/,
          "回復イベントでHP全回復を表示する",
        );
        const floorClearSave = JSON.parse(
          window.localStorage.getItem("hyakushu_ibun_save_v2"),
        );
        assert.equal(
          floorClearSave.hp,
          floorClearSave.maxHp,
          "一階クリア時にHPを最大値まで回復する",
        );
      } else {
        assert.equal(
          $("#chapterRecovery").hidden,
          true,
          "HP回復イベントは一階クリア時だけ表示する",
        );
        if (battle === 6) {
          const secondFloorSave = JSON.parse(
            window.localStorage.getItem("hyakushu_ibun_save_v2"),
          );
          assert.equal(
            secondFloorSave.hp,
            carriedHp,
            "二階で受けたダメージを戦闘間・章間とも持ち越す",
          );
          assert.ok(
            secondFloorSave.hp < secondFloorSave.maxHp,
            "二階終了時に自動全回復しない",
          );
        }
      }
      click("#chapterContinueButton");
      assert.ok(
        $("#fieldScreen").classList.contains("active"),
        "章間物語から次の階へ進む",
      );
    } else if (battle < 11) {
      assert.ok(
        $("#fieldScreen").classList.contains("active"),
        "討伐後に校内マップへ戻る",
      );
    }
  }

  assert.ok(
    $("#victoryScreen").classList.contains("active"),
    "道長から校長を救って学校編クリア画面へ進む",
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
  assert.equal(clearSave.maxMp, 110, "二階報酬の成長も旧セーブ互換で残る");
  assert.equal(clearSave.guardBonus, 2, "三階報酬で守りが上がる");
  assert.equal(
    readerCalls.length,
    36,
    "全33首と2回のお手つき・怪異先取で音声を呼ぶ",
  );
  assert.ok(readerCalls.every((no) => no >= 1 && no <= 100));

  console.log("百首異聞 6枚取り DOM smoke test: OK");
  dom.window.close();
})().catch((error) => {
  console.error(error);
  dom.window.close();
  process.exitCode = 1;
});
