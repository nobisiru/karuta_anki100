const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "hyakushu-ibun.html"), "utf8");
const launcher = fs.readFileSync(path.join(root, "map-progress.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const localAssets = [
  ...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g),
].map((match) => match[1]);
assert.ok(localAssets.length >= 6, "本編の分離アセットが列挙される");
localAssets.forEach((asset) =>
  assert.ok(fs.existsSync(path.join(root, asset)), `${asset} が存在する`),
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

console.log("百首異聞 asset tests: OK");
