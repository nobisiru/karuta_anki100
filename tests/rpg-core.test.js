const assert = require("node:assert/strict");

global.window = global;
global.addEventListener = () => {};

require("../data.js");
require("../rpg-data.js");
const Core = require("../rpg-core.js");

const data = global.HYAKUSHU_IBUN_DATA;

assert.equal(global.ALL_LOWER.length, 100, "既存の下の句データは100首ある");
assert.equal(data.monsters.length, 10, "学校編の怪異は10体ある");
assert.equal(data.boss.id, "michinaga", "学校編の最終ボスが設定されている");
assert.equal(
  new Set(data.monsters.map((monster) => monster.id)).size,
  10,
  "怪異IDは重複しない",
);

for (const enemy of [...data.monsters, data.boss]) {
  assert.equal(enemy.sealPoems.length, 3, `${enemy.name}は3枚の決まり字を持つ`);
  assert.ok(enemy.story.length >= 20, `${enemy.name}に怪異描写がある`);
  assert.ok(enemy.intro.length >= 10, `${enemy.name}に登場演出文がある`);
  assert.ok(enemy.threat.length >= 20, `${enemy.name}に討伐すべき脅威がある`);
  enemy.sealPoems.forEach((no) =>
    assert.ok(no >= 1 && no <= 100, `${enemy.name}の札番号が有効`),
  );
}

assert.equal(data.decisionKeys.length, 100, "RPG用の決まり字は100首分ある");
for (const enemy of [...data.monsters, data.boss]) {
  enemy.sealPoems.forEach((no) => {
    assert.ok(
      data.decisionKeys[no - 1],
      `${enemy.name}の${no}番に決まり字がある`,
    );
  });
}

assert.equal(Core.levelForShards(0), 1);
assert.equal(Core.levelForShards(3), 2);
assert.equal(Core.levelForShards(7), 3);
assert.equal(Core.levelForShards(999), 5);

const autumnLinks = Core.calculateLinks([1, 5, 10, 40, 57], data.links);
assert.ok(
  autumnLinks.some((link) => link.id === "autumn" && link.count === 3),
  "秋札3枚で秋風共鳴",
);

const exact = Core.attackOutcome({
  cardNo: 17,
  sealPoemNo: 17,
  selected: [17, 5, 87, 1, 10],
  shards: {},
  links: data.links,
});
assert.equal(exact.exact, true);
assert.equal(exact.damage, 999);
assert.equal(exact.mpCost, 0);

const normal = Core.attackOutcome({
  cardNo: 1,
  sealPoemNo: 17,
  selected: [1, 5, 10, 40, 57],
  shards: { 1: 3 },
  links: data.links,
});
assert.equal(normal.exact, false);
assert.ok(normal.damage > 25, "札レベルと共鳴で通常ダメージが増える");
assert.ok(normal.mpCost > 0, "通常攻撃はMPを使う");

const lateChapterCounter = Core.attackOutcome({
  cardNo: 1,
  sealPoemNo: 17,
  selected: [1, 5, 10, 40, 57],
  shards: {},
  links: data.links,
  counterBase: 14,
  guardBonus: 2,
});
assert.ok(
  lateChapterCounter.counterDamage <= 12,
  "章報酬の守りが反撃を軽減する",
);

const routeA = Core.seededRoute(data.monsters, 4, 12345);
const routeB = Core.seededRoute(data.monsters, 4, 12345);
assert.deepEqual(routeA, routeB, "同じseedなら同じ道のり");
assert.equal(routeA.length, 4);
assert.equal(new Set(routeA).size, 4, "一周の怪異は重複しない");

const save = Core.defaultSave(data, 777);
assert.equal(save.version, 2);
assert.equal(save.campaign, "hanamori_school");
assert.equal(save.chapterIndex, 0);
assert.equal(save.encounterIndex, 0);
assert.equal(save.hp, 120);
assert.equal(save.mp, 100);
assert.equal(save.cleared, false);

const repaired = Core.normalizeSave(
  {
    version: 2,
    chapterIndex: 99,
    encounterIndex: 99,
    hp: 999,
    mp: -5,
  },
  data,
);
assert.ok(repaired.hp <= repaired.maxHp, "壊れたHPを補正する");
assert.equal(repaired.mp, 0, "MP 0を正しく維持する");
assert.equal(repaired.chapterIndex, 3, "章番号を4章以内へ補正する");
assert.equal(repaired.encounterIndex, 1, "遭遇番号を章内へ補正する");

const migrated = Core.normalizeSave(
  {
    version: 1,
    shards: { 17: 7 },
    totalShards: 7,
    defeated: ["hakumen"],
    cleared: true,
    settings: { sound: false },
  },
  data,
);
assert.equal(migrated.version, 2, "旧セーブを学校編形式へ移行する");
assert.equal(migrated.shards[17], 7, "旧版の札成長を保持する");
assert.equal(migrated.totalShards, 7, "旧版のカケラを保持する");
assert.equal(migrated.settings.sound, false, "旧版の設定を保持する");
assert.equal(migrated.chapterIndex, 0, "学校編は一階から始まる");
assert.equal(migrated.legacy.originalCleared, true, "旧版クリア記録を保持する");

assert.equal(data.campaign.chapters.length, 4, "一階から教員室まで4章ある");
assert.equal(data.campaign.totalBattles, 11, "全11戦で4章を完結する");
assert.deepEqual(
  data.campaign.chapters.map((chapter) => chapter.encounters.length),
  [3, 3, 3, 2],
  "章ごとの戦闘数が3・3・3・2",
);
assert.equal(
  new Set(data.campaign.chapters.flatMap((chapter) => chapter.encounters)).size,
  11,
  "怪異11体を重複なく物語へ配置する",
);

console.log("百首異聞 core tests: OK");
