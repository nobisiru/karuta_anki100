const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "hyakushu-ibun.html"), "utf8");
const launcher = fs.readFileSync(path.join(root, "map-progress.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gameCss = fs.readFileSync(path.join(root, "hyakushu-ibun.css"), "utf8");
const audioBridge = fs.readFileSync(path.join(root, "rpg-audio.js"), "utf8");
const trainingAudio = fs.readFileSync(
  path.join(root, "local-audio.js"),
  "utf8",
);
const trainingGame = fs.readFileSync(path.join(root, "app.js"), "utf8");

const localAssets = [
  ...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g),
].map((match) => match[1]);
assert.ok(localAssets.length >= 6, "本編の分離アセットが列挙される");
localAssets.forEach((asset) =>
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} が存在する`),
);

const monsterIds = [
  "hakumen",
  "sumikurai",
  "tsukibami",
  "tomoshibigumo",
  "sakasawara",
  "mizukagami",
  "momijioni",
  "nemurijika",
  "ayanukiga",
  "kanesemukade",
  "michinaga",
];
monsterIds.forEach((id) => {
  const asset = path.join(root, "assets", "monsters", `${id}.webp`);
  assert.ok(fs.existsSync(asset), `${id}の画家調怪異アートが存在する`);
  assert.ok(fs.statSync(asset).size < 400_000, `${id}の画像がモバイル向け容量`);
});
assert.equal(
  fs.readdirSync(path.join(root, "assets", "monsters")).length,
  monsterIds.length,
  "怪異10体とボス1体の画像が揃う",
);

const schoolAssets = [
  "title-karuta-club.webp",
  "chapter-1-first-floor.webp",
  "chapter-2-second-floor.webp",
  "chapter-3-third-floor.webp",
  "chapter-4-staff-room.webp",
];
schoolAssets.forEach((filename) => {
  const asset = path.join(root, "assets", "school", filename);
  assert.ok(fs.existsSync(asset), `${filename}の学校ビジュアルが存在する`);
  assert.ok(fs.statSync(asset).size < 400_000, `${filename}がモバイル向け容量`);
});

assert.match(index, /map-progress\.js/, "既存TOPがRPGランチャーを読み込む");
assert.match(
  launcher,
  /location\.href='hyakushu-ibun\.html'/,
  "TOPの百首異聞から新本編へ入る",
);
assert.doesNotMatch(
  launcher,
  /location\.href='rpg-monster-v6\.html'/,
  "TOPが旧試作へ戻らない",
);

assert.match(
  html,
  /class="game-shell youthful-theme school-campaign"/,
  "学校青春テーマを適用",
);
assert.match(
  html,
  /放課後かるた部と、消えた百の歌/,
  "学校を守るかるた部の物語を入口にする",
);
assert.match(html, /最初の六枚へ/, "6枚取りで学校編を始める導線がある");
assert.match(html, /id="raceCards"/, "6枚取りバトルの札場がある");
assert.doesNotMatch(html, /id="pickerModal"/, "旧5枚デッキ選択を撤去する");
assert.match(html, /rpg-audio\.js/, "トレーニングの読手音声を共用する");
for (const sharedKey of ["karuta_local_audio_v1", "karuta_audio_enabled_v1"]) {
  assert.match(
    audioBridge,
    new RegExp(sharedKey),
    `${sharedKey}をRPGが参照する`,
  );
  assert.match(
    trainingAudio,
    new RegExp(sharedKey),
    `${sharedKey}をトレーニングが参照する`,
  );
}
assert.match(
  trainingGame,
  /master:\{name:'名人',ms:320,similarity:2,cpu:1200\}/,
  "トレーニングの名人速度が基準として存在する",
);
assert.match(gameCss, /UTA GIRL THEME/, "全画面の新ビジュアルテーマが存在する");
assert.match(
  gameCss,
  /HANAMORI SCHOOL CAMPAIGN/,
  "学校キャンペーンの専用ビジュアルが存在する",
);
assert.match(gameCss, /--sakura: #ee9db6/, "桜色をテーマカラーにする");
assert.match(
  gameCss,
  /\.uta-card[\s\S]*border-color: var\(--green\)/,
  "競技札の緑枠を維持する",
);

console.log("百首異聞 asset tests: OK");
