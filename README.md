# 百人一首かるた／百首異聞

GitHub Pagesで動く、百人一首の読み取りトレーニングとRPG「百首異聞」です。

- `index.html`: 読み取りトレーニングのTOP
- `hyakushu-ibun.html`: RPG「百首異聞」第一章・平安編
- `data.js`: 既存の100首下の句データ
- `rpg-data.js`: 怪異、ボス、決まり字、共鳴データ
- `rpg-core.js`: 戦闘・育成・セーブの純粋ロジック
- `rpg-art.js`: 10怪異＋ボスのSVG描画
- `hyakushu-ibun.js`: RPGの画面進行と操作

## ローカル確認

```bash
python3 -m http.server 8000
```

`http://localhost:8000/` を開き、TOPの「百首異聞」から開始します。

## テスト

```bash
npm install
npm test
npm run lint
```

開発方針と第1ゴールは [RPG_DEVELOPMENT.md](RPG_DEVELOPMENT.md) を参照してください。
