const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "hyakushu-ibun.html"), "utf8");
const launcher = fs.readFileSync(path.join(root, "map-progress.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gameCss = fs.readFileSync(path.join(root, "hyakushu-ibun.css"), "utf8");

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

assert.match(html, /class="game-shell youthful-theme"/, "少女向けテーマを適用");
assert.match(
  html,
  /歌がつなぐ、月夜の約束/,
  "物語の入口を新ペルソナ向けにする",
);
assert.match(html, /旅をはじめる/, "旅をはじめる導線を維持する");
assert.match(gameCss, /UTA GIRL THEME/, "全画面の新ビジュアルテーマが存在する");
assert.match(gameCss, /--sakura: #ee9db6/, "桜色をテーマカラーにする");
assert.match(
  gameCss,
  /\.uta-card[\s\S]*border-color: var\(--green\)/,
  "競技札の緑枠を維持する",
);

console.log("百首異聞 asset tests: OK");
