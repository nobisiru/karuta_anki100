(() => {
  "use strict";

  const DATA = window.HYAKUSHU_IBUN_DATA;
  const Core = window.HyakushuCore;
  const Art = window.HyakushuArt;
  const ReaderAudio = window.HyakushuRpgAudio;
  const TEST_MODE = Boolean(window.__HYAKUSHU_TEST__);
  const SAVE_KEY = "hyakushu_ibun_save_v2";
  const OLD_SAVE_KEY = "hyakushu_ibun_save_v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];

  const state = {
    save: null,
    battle: null,
    currentScreen: "titleScreen",
    audio: null,
    sessionStartedAt: Date.now(),
    pendingChapter: null,
    pendingRecovery: null,
    raceToken: 0,
    raceTimers: [],
  };

  const normalize = (value) => String(value || "").replace(/[\s　]/g, "");
  const questionByLower = new Map(
    (window.QUESTION_POOL || []).map((item) => {
      const record = Array.isArray(item)
        ? { key: item[0], upper: item[1], lower: item[2] }
        : { key: item.key, upper: item.rest, lower: item.lower };
      return [normalize(record.lower), record];
    }),
  );

  function poem(no) {
    const raw = window.ALL_LOWER?.[Number(no) - 1];
    const lower = normalize(raw?.lower);
    const question = questionByLower.get(lower);
    return {
      no: Number(no),
      lower,
      key: DATA.decisionKeys?.[Number(no) - 1] || question?.key || "？",
      upper: normalize(DATA.upperPoems?.[Number(no) - 1] || question?.upper),
      tags: Core.tagsForCard(Number(no), DATA.links),
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function splitPoem(value) {
    const chars = [...normalize(value)];
    const size = Math.ceil(chars.length / 3);
    return [0, 1, 2].map((index) =>
      chars.slice(index * size, (index + 1) * size).join(""),
    );
  }

  function cardMarkup(no, options = {}) {
    const item = poem(no);
    const level = Core.levelForShards(state.save?.shards?.[no] || 0);
    const tags = item.tags
      .slice(0, 2)
      .map((tag) => DATA.links[tag]?.short)
      .filter(Boolean)
      .join("・");
    return `<div class="uta-card ${options.className || ""}" data-poem="${item.no}">
      <div class="poem">${splitPoem(item.lower)
        .map((part) => `<i>${escapeHtml(part)}</i>`)
        .join("")}</div>
      <div class="card-meta"><span>${item.no}番 ${escapeHtml(tags)}</span><span class="card-level">Lv.${level}</span></div>
    </div>`;
  }

  function hasSave() {
    return Boolean(
      localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_SAVE_KEY),
    );
  }

  function loadSave() {
    let raw = null;
    try {
      raw = JSON.parse(
        localStorage.getItem(SAVE_KEY) ||
          localStorage.getItem(OLD_SAVE_KEY) ||
          "null",
      );
    } catch (_error) {
      raw = null;
    }
    state.save = Core.normalizeSave(raw, DATA);
    if (raw?.version === 1)
      localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
    applySettings();
    refreshTitle();
  }

  function persist() {
    if (!state.save) return;
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - state.sessionStartedAt) / 1000),
    );
    state.save.playSeconds = (Number(state.save.playSeconds) || 0) + elapsed;
    state.sessionStartedAt = Date.now();
    state.save.updatedAt = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
  }

  function applySettings() {
    document.body.classList.toggle(
      "reduced-motion",
      Boolean(state.save?.settings?.reducedMotion),
    );
    $("#soundToggle").checked = state.save?.settings?.sound !== false;
    $("#hapticsToggle").checked = state.save?.settings?.haptics !== false;
    $("#motionToggle").checked = Boolean(state.save?.settings?.reducedMotion);
  }

  function currentChapter() {
    return (
      DATA.campaign.chapters[state.save?.chapterIndex || 0] ||
      DATA.campaign.chapters[0]
    );
  }

  function campaignBattleIndex() {
    const chapterIndex = Number(state.save?.chapterIndex || 0);
    return (
      DATA.campaign.chapters
        .slice(0, chapterIndex)
        .reduce((total, chapter) => total + chapter.encounters.length, 0) +
      Number(state.save?.encounterIndex || 0)
    );
  }

  function refreshTitle() {
    const continueButton = $("#continueButton");
    continueButton.hidden = !hasSave();
    if (!continueButton.hidden) {
      const completed = state.save?.cleared;
      const progress = completed
        ? DATA.campaign.totalBattles
        : campaignBattleIndex();
      $("#continueDetail").textContent = completed
        ? "全4章クリア済み・活動記録を見る"
        : `${currentChapter().name}・${progress}/${DATA.campaign.totalBattles}戦　カケラ ${state.save?.totalShards || 0}`;
    }
  }

  function showScreen(id, label) {
    $$(".screen").forEach((screen) =>
      screen.classList.toggle("active", screen.id === id),
    );
    state.currentScreen = id;
    $("#screenLabel").textContent = label || currentChapter().name;
    window.scrollTo({
      top: 0,
      behavior: state.save?.settings?.reducedMotion ? "auto" : "smooth",
    });
  }

  function startNewGame() {
    state.save = Core.defaultSave(DATA);
    state.pendingChapter = null;
    state.pendingRecovery = null;
    persist();
    refreshTitle();
    showScreen("prologueScreen", "序章　放課後が止まった日");
    playSound("open");
  }

  function continueGame() {
    if (state.save.cleared) {
      renderVictory();
      return;
    }
    renderField();
  }

  function currentEncounter() {
    const chapter = currentChapter();
    const id = chapter.encounters[state.save.encounterIndex];
    return [...DATA.monsters, DATA.boss].find((enemy) => enemy.id === id);
  }

  function renderField() {
    const chapter = currentChapter();
    showScreen("fieldScreen", chapter.name);
    const index = state.save.encounterIndex;
    const encounter = currentEncounter();
    $("#fieldTitle").textContent = chapter.subtitle;
    $("#fieldShards").textContent = state.save.totalShards || 0;
    $("#fieldStep").textContent =
      `${chapter.name}・${index + 1} / ${chapter.encounters.length}`;
    $("#nextEncounterName").textContent = encounter.place;
    $("#fieldMessage").textContent =
      index === 0 ? chapter.intro : encounter.intro;
    $("#encounterButton").textContent = enemyActionLabel(encounter);
    const fieldMap = $("#fieldMap");
    fieldMap.style.setProperty(
      "--chapter-background",
      `url("${chapter.background}")`,
    );
    fieldMap.dataset.chapter = chapter.id;

    const nodes = chapter.encounters.map((id) =>
      [...DATA.monsters, DATA.boss].find((enemy) => enemy.id === id),
    );
    $("#routeNodes").innerHTML = nodes
      .map((monster, nodeIndex) => {
        const status =
          nodeIndex < index
            ? "done"
            : nodeIndex === index
              ? "current"
              : "locked";
        const mark =
          nodeIndex < index
            ? "✓"
            : monster?.boss
              ? "月"
              : monster?.chapterBoss
                ? "封"
                : "異";
        return `<li class="route-node ${status}" aria-label="${escapeHtml(monster?.name || "怪異")} ${status}">${mark}</li>`;
      })
      .join("");
    $("#schoolFloors").innerHTML = DATA.campaign.chapters
      .map((floor, floorIndex) => {
        const complete = state.save.completedChapters.includes(floor.id);
        const active = floorIndex === state.save.chapterIndex;
        const status = complete ? "done" : active ? "current" : "locked";
        return `<li class="school-floor ${status}" ${active ? 'aria-current="step"' : ""}><b>${escapeHtml(floor.label)}</b><span>${escapeHtml(floor.subtitle)}</span><i>${complete ? "✓" : active ? "●" : ""}</i></li>`;
      })
      .join("");
  }

  function enemyActionLabel(enemy) {
    if (enemy.boss) return "百首匣を開く";
    if (enemy.chapterBoss) return "階の封印を破る";
    return "怪異と対峙する";
  }

  function rivalProfile() {
    const profiles = DATA.campaign.rivalSpeeds || [];
    return (
      profiles[campaignBattleIndex()] ||
      profiles[profiles.length - 1] || {
        rank: "かるた入門",
        charMs: 560,
        cpuMs: 9000,
        similarity: 0,
      }
    );
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function raceChoices(correctNo, profile) {
    const correct = poem(correctNo);
    const pool = window.ALL_LOWER.map((_item, index) => index + 1).filter(
      (no) => no !== correctNo,
    );
    const chosen = [];
    const addMatches = (length) => {
      shuffle(pool)
        .filter(
          (no) =>
            poem(no).lower.slice(0, length) === correct.lower.slice(0, length),
        )
        .forEach((no) => {
          if (chosen.length < 5 && !chosen.includes(no)) chosen.push(no);
        });
    };
    if (profile.similarity >= 2) addMatches(2);
    if (profile.similarity >= 1) addMatches(1);
    shuffle(pool).forEach((no) => {
      if (chosen.length < 5 && !chosen.includes(no)) chosen.push(no);
    });
    return shuffle([correctNo, ...chosen.slice(0, 5)]);
  }

  function clearRaceTimers() {
    state.raceToken += 1;
    state.raceTimers.forEach((timer) => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    state.raceTimers = [];
    ReaderAudio?.stop();
  }

  function scheduleRace(callback, milliseconds, preserveInTest = false) {
    const delay =
      TEST_MODE && !preserveInTest ? Math.min(milliseconds, 24) : milliseconds;
    const timer = setTimeout(callback, delay);
    state.raceTimers.push(timer);
    return timer;
  }

  function startEncounter() {
    const enemy = currentEncounter();
    const chapter = currentChapter();
    const isBoss = enemy.boss || enemy.chapterBoss;
    const profile = rivalProfile();
    ReaderAudio?.unlock();
    state.battle = {
      enemy,
      profile,
      seals: enemy.sealPoems.map((poemNo) => ({
        poemNo,
        hp: 1,
        maxHp: 1,
      })),
      phase: "preview",
      currentPoemNo: null,
      counterDamage: isBoss
        ? chapter.difficulty.bossCounter
        : chapter.difficulty.counter,
      playerTakes: 0,
      opponentTakes: 0,
      mistakes: 0,
    };
    showScreen(
      "battleScreen",
      enemy.boss ? "第四章　校長を救え" : `${chapter.label}　${enemy.place}`,
    );
    renderBattle();
    $("#battleLog").innerHTML =
      `<b>${escapeHtml(enemy.intro)}</b><span class="enemy-threat"><i>危</i>${escapeHtml(enemy.threat)}</span>`;
    const stage = $("#enemyStage");
    stage.style.setProperty(
      "--chapter-background",
      `url("${chapter.background}")`,
    );
    updateReaderAudioStatus();
    playSound(isBoss ? "boss" : "encounter");
    vibrate(isBoss ? [40, 50, 80] : [35, 45, 35]);
    startRaceRound();
  }

  function renderBattle() {
    const { enemy, seals } = state.battle;
    $("#enemyPlace").textContent = enemy.place;
    $("#enemyName").textContent = enemy.name;
    $("#enemyEpithet").textContent = enemy.epithet;
    const monsterArt = $("#monsterArt");
    monsterArt.innerHTML = Art.monsterMarkup(enemy);
    const paintedMonster = $(".painted-monster", monsterArt);
    paintedMonster?.addEventListener(
      "error",
      () => {
        monsterArt.innerHTML = Art.monsterSvg(enemy);
      },
      { once: true },
    );
    $("#enemyStage").style.setProperty("--enemy-accent", enemy.palette[2]);
    const current = seals.findIndex((seal) => seal.hp > 0);
    const marks = ["一", "二", "三"];
    $("#sealLayer").innerHTML = seals
      .map((seal, index) => {
        const broken = seal.hp <= 0;
        return `<div class="enemy-seal race-seal ${broken ? "broken" : ""} ${index === current ? "active" : ""}" data-poem="${seal.poemNo}"><span>${broken ? "結" : marks[index]}</span></div>`;
      })
      .join("");
    updateHud();
    updateRivalHud();
  }

  function updateHud() {
    const save = state.save;
    $("#hpText").textContent = `${Math.round(save.hp)} / ${save.maxHp}`;
    $("#hpBar").style.width =
      `${Core.clamp((save.hp / save.maxHp) * 100, 0, 100)}%`;
  }

  function updateRivalHud() {
    const profile = state.battle?.profile || rivalProfile();
    const level = Math.min(
      DATA.campaign.rivalSpeeds.length,
      campaignBattleIndex() + 1,
    );
    $("#rivalRank").textContent = profile.rank;
    $("#speedPips").innerHTML = DATA.campaign.rivalSpeeds
      .map(
        (_item, index) =>
          `<i class="${index < level ? "active" : ""}" aria-hidden="true"></i>`,
      )
      .join("");
    $("#speedPips").setAttribute(
      "aria-label",
      `相手の強さ ${level} / ${DATA.campaign.rivalSpeeds.length}・${profile.rank}`,
    );
  }

  async function updateReaderAudioStatus() {
    const info = (await ReaderAudio?.status?.()) || {
      label: "文字読み・音声はトレーニングで設定",
    };
    if ($("#audioStatusChip")) $("#audioStatusChip").textContent = info.label;
    if ($("#settingsAudioStatus"))
      $("#settingsAudioStatus").textContent = info.label;
  }

  function livingSeals() {
    return state.battle.seals.filter((seal) => seal.hp > 0);
  }

  function currentRaceIndex() {
    return state.battle.seals.findIndex((seal) => seal.hp > 0);
  }

  function raceCardMarkup(no, correctNo) {
    const item = poem(no);
    return `<button class="race-card" type="button" data-race-no="${no}" data-race-correct="${no === correctNo ? "true" : "false"}" aria-label="${escapeHtml(item.lower)}">
      <span class="race-poem">${splitPoem(item.lower)
        .map((part) => `<i>${escapeHtml(part)}</i>`)
        .join("")}</span>
    </button>`;
  }

  function startRaceRound(options = {}) {
    clearRaceTimers();
    if (!state.battle || !livingSeals().length) return;
    const token = state.raceToken;
    const roundIndex = currentRaceIndex();
    const target = state.battle.seals[roundIndex];
    const profile = state.battle.profile;
    state.battle.phase = "preview";
    state.battle.currentPoemNo = target.poemNo;

    const choices = raceChoices(target.poemNo, profile);
    $("#raceCards").innerHTML = choices
      .map((no) => raceCardMarkup(no, target.poemNo))
      .join("");
    $("#raceCards").className = "race-cards waiting";
    $("#raceReader").className = "race-reader previewing";
    $("#raceProgress").textContent =
      `${["一", "二", "三"][roundIndex]}首目 / 三首`;
    $("#raceStatus").textContent = options.retry
      ? "もう一度、六枚を見直そう"
      : "まず六枚の位置を見よう";
    $("#raceHelp").textContent = "読み始めるまであと5秒";
    $("#raceFeedback").textContent =
      options.message || "声に集中して、先に取ろう。";

    $$("[data-race-no]", $("#raceCards")).forEach((button) =>
      button.addEventListener("click", () =>
        takeRaceCard(Number(button.dataset.raceNo), button),
      ),
    );

    let remaining = TEST_MODE ? 0 : 5;
    const tick = () => {
      if (token !== state.raceToken) return;
      if (remaining <= 0) {
        beginRaceReading(token);
        return;
      }
      $("#raceStream").textContent = remaining;
      $("#raceHelp").textContent =
        `読み始めるまであと${remaining}秒・札の位置を覚えよう`;
      remaining -= 1;
      scheduleRace(tick, 1000);
    };
    tick();
  }

  async function beginRaceReading(token) {
    if (token !== state.raceToken || !state.battle) return;
    $("#raceStatus").textContent = "読手が息を吸う――";
    $("#raceStream").textContent = "読";
    $("#raceHelp").textContent = "音声に集中";
    const poemNo = state.battle.currentPoemNo;
    const started = await ReaderAudio?.playPoem?.(poemNo);
    if (token !== state.raceToken) {
      ReaderAudio?.stop();
      return;
    }
    $("#audioStatusChip").classList.toggle("playing", Boolean(started));
    $("#audioStatusChip").textContent = started
      ? "読手音声 再生中"
      : "文字読みで進行中";
    scheduleRace(
      () => beginVisualReading(token),
      started && !TEST_MODE ? 550 : 0,
    );
  }

  function readingMarkup(full, visible, keyLength) {
    return [...full]
      .slice(0, visible)
      .map(
        (char, index) =>
          `<span class="${index < keyLength ? "decision-sound" : ""}">${escapeHtml(char)}</span>`,
      )
      .join("");
  }

  function beginVisualReading(token) {
    if (token !== state.raceToken || !state.battle) return;
    const item = poem(state.battle.currentPoemNo);
    const profile = state.battle.profile;
    let visible = 0;
    let readTimer = null;
    state.battle.phase = "reading";
    $("#raceCards").classList.remove("waiting");
    $("#raceReader").classList.remove("previewing");
    $("#raceReader").classList.add("reading");
    $("#raceStatus").textContent = "読み進行中";
    $("#raceHelp").textContent =
      `${profile.rank}が同じ札を狙っている・札をタップ！`;

    const advance = () => {
      if (token !== state.raceToken) return;
      visible = Math.min(item.upper.length, visible + 1);
      $("#raceStream").innerHTML = readingMarkup(
        item.upper,
        visible,
        item.key.length,
      );
      if (visible >= item.upper.length && readTimer) clearInterval(readTimer);
    };
    advance();
    readTimer = setInterval(advance, TEST_MODE ? 20 : profile.charMs);
    state.raceTimers.push(readTimer);

    const keyDelay = Math.max(0, item.key.length - 1) * profile.charMs;
    const jitter = 0.88 + Math.random() * 0.24;
    const opponentDelay = TEST_MODE
      ? 1000
      : keyDelay + Math.round(profile.cpuMs * jitter);
    scheduleRace(() => opponentTake(token), opponentDelay, TEST_MODE);
  }

  function disableRaceCards() {
    $$("[data-race-no]", $("#raceCards")).forEach((button) => {
      button.disabled = true;
    });
  }

  function takeRaceCard(no, button) {
    if (!state.battle || state.battle.phase !== "reading") return;
    const correctNo = state.battle.currentPoemNo;
    clearRaceTimers();
    state.battle.phase = "resolved";
    disableRaceCards();

    if (no === correctNo) {
      const target = state.battle.seals.find(
        (seal) => seal.poemNo === correctNo && seal.hp > 0,
      );
      if (target) target.hp = 0;
      state.battle.playerTakes += 1;
      button.classList.add("correct");
      $("#raceReader").className = "race-reader won";
      $("#raceStatus").textContent = "あなたが先に取った！";
      $("#raceStream").textContent = poem(correctNo).key;
      $("#raceHelp").textContent = `${correctNo}番・封印を一首接続`;
      $("#raceFeedback").innerHTML =
        `<b>一首接続――${escapeHtml(poem(correctNo).key)}、封印破断！</b>`;
      renderBattle();
      playAttackEffect({ exact: true, damage: 999 });
      if (!livingSeals().length)
        scheduleRace(
          finishBattle,
          state.save.settings.reducedMotion ? 60 : 850,
        );
      else
        scheduleRace(
          () => startRaceRound(),
          state.save.settings.reducedMotion ? 60 : 800,
        );
      return;
    }

    state.battle.mistakes += 1;
    button.classList.add("wrong");
    const correctButton = $('[data-race-correct="true"]', $("#raceCards"));
    correctButton?.classList.add("missed");
    $("#raceReader").className = "race-reader lost";
    $("#raceStatus").textContent = "お手つき！";
    $("#raceStream").textContent = "待";
    $("#raceHelp").textContent = "同じ一首へ、もう一度挑戦";
    $("#raceFeedback").innerHTML =
      `<b>その札ではない。</b> 正解は「${escapeHtml(poem(correctNo).lower)}」。`;
    playSound("error");
    vibrate([24, 35, 24]);
    if (!applyRaceDamage("お手つき"))
      scheduleRace(
        () =>
          startRaceRound({
            retry: true,
            message: "深呼吸。今度は決まり字まで聞いて取ろう。",
          }),
        state.save.settings.reducedMotion ? 80 : 1050,
      );
  }

  function opponentTake(token) {
    if (
      token !== state.raceToken ||
      !state.battle ||
      state.battle.phase !== "reading"
    )
      return;
    const correctNo = state.battle.currentPoemNo;
    clearRaceTimers();
    state.battle.phase = "resolved";
    state.battle.opponentTakes += 1;
    disableRaceCards();
    const correctButton = $('[data-race-correct="true"]', $("#raceCards"));
    correctButton?.classList.add("taken");
    $("#raceReader").className = "race-reader lost";
    $("#raceStatus").textContent = "怪異が先に払った！";
    $("#raceStream").textContent = poem(correctNo).key;
    $("#raceHelp").textContent =
      `${state.battle.profile.rank}の速さ・同じ一首へ再挑戦`;
    $("#raceFeedback").innerHTML =
      `<b>${escapeHtml(state.battle.enemy.name)}が先取。</b> 決まり字は「${escapeHtml(poem(correctNo).key)}」。`;
    $("#effectLayer").innerHTML = '<i class="opponent-hand"></i>';
    const opponentHand = $(".opponent-hand", $("#effectLayer"));
    playSound("counter");
    vibrate([45, 25, 25]);
    setTimeout(
      () => {
        opponentHand?.remove();
      },
      TEST_MODE ? 24 : 500,
    );
    if (!applyRaceDamage("先取"))
      scheduleRace(
        () =>
          startRaceRound({
            retry: true,
            message: "取られた一首は、その場でもう一度取り返せる。",
          }),
        state.save.settings.reducedMotion ? 80 : 1050,
      );
  }

  function applyRaceDamage(reason) {
    const damage = Math.max(
      2,
      state.battle.counterDamage - (state.save.guardBonus || 0),
    );
    state.save.hp = Math.max(0, state.save.hp - damage);
    updateHud();
    const effectLayer = $("#effectLayer");
    effectLayer.insertAdjacentHTML(
      "beforeend",
      `<b class="hp-damage-number">-${damage} HP</b>`,
    );
    const damageNumber = $(".hp-damage-number", effectLayer);
    setTimeout(() => damageNumber?.remove(), TEST_MODE ? 24 : 680);
    const stage = $("#enemyStage");
    stage.classList.add("counter");
    setTimeout(() => stage.classList.remove("counter"), TEST_MODE ? 24 : 420);
    $("#raceFeedback").innerHTML +=
      `<small>${escapeHtml(reason)}で HP -${damage}</small>`;
    if (state.save.hp <= 0) {
      scheduleRace(revive, state.save.settings.reducedMotion ? 80 : 700);
      return true;
    }
    return false;
  }

  function playAttackEffect(outcome) {
    const layer = $("#effectLayer");
    layer.innerHTML = `<i class="slash-effect"></i><b class="damage-number ${outcome.exact ? "exact" : ""}">${outcome.exact ? "一首接続" : outcome.damage}</b>`;
    const stage = $("#enemyStage");
    stage.classList.remove("hit", "exact-hit");
    void stage.offsetWidth;
    stage.classList.toggle("exact-hit", outcome.exact);
    stage.classList.add("hit");
    setTimeout(
      () => {
        layer.innerHTML = "";
        stage.classList.remove("hit", "exact-hit");
      },
      TEST_MODE ? 24 : 900,
    );
    playSound(outcome.exact ? "exact" : "hit");
    vibrate(outcome.exact ? [25, 35, 85] : 35);
  }

  function revive() {
    clearRaceTimers();
    playSound("defeat");
    state.save.hp = state.save.maxHp;
    state.save.mp = state.save.maxMp;
    state.battle.seals.forEach((seal) => {
      seal.hp = seal.maxHp;
    });
    state.battle.phase = "preview";
    renderBattle();
    $("#battleLog").innerHTML =
      "<b>仲間の声が、あなたを勝負の前へ戻した。</b><br>三首とも取り直して、怪異より先に札を払おう。";
    scheduleRace(
      () =>
        startRaceRound({
          message: "すず「大丈夫。札を見て、声を待とう」",
        }),
      state.save.settings.reducedMotion ? 80 : 900,
    );
  }

  function finishBattle() {
    clearRaceTimers();
    const enemy = state.battle.enemy;
    const chapter = currentChapter();
    const hpAtVictory = Math.round(state.save.hp);
    const isChapterEnd =
      state.save.encounterIndex === chapter.encounters.length - 1;
    const rewards = enemy.sealPoems.map((no) => {
      const before = Core.levelForShards(state.save.shards[no] || 0);
      const gain = enemy.boss ? 5 : enemy.chapterBoss ? 4 : 3;
      state.save.shards[no] = (state.save.shards[no] || 0) + gain;
      state.save.totalShards += gain;
      const after = Core.levelForShards(state.save.shards[no]);
      return { no, gain, before, after };
    });
    if (!state.save.defeated.includes(enemy.id))
      state.save.defeated.push(enemy.id);
    state.save.hp = Math.min(state.save.maxHp, state.save.hp + 20);
    state.save.mp = Math.min(state.save.maxMp, state.save.mp + 30);
    state.pendingChapter = null;
    state.pendingRecovery = null;
    if (isChapterEnd) {
      if (!state.save.completedChapters.includes(chapter.id)) {
        state.save.completedChapters.push(chapter.id);
        if (chapter.id === "first_floor") {
          state.save.maxHp += 10;
        } else if (chapter.id === "second_floor") {
          state.save.maxMp += 10;
        } else if (chapter.id === "third_floor") {
          state.save.guardBonus += 2;
        }
      }
      if (enemy.boss) {
        state.save.cleared = true;
      } else {
        state.pendingChapter = chapter;
        state.save.chapterIndex += 1;
        state.save.encounterIndex = 0;
        state.save.hp = state.save.maxHp;
        state.save.mp = state.save.maxMp;
        if (chapter.recoveryEvent) {
          state.pendingRecovery = {
            before: hpAtVictory,
            after: state.save.maxHp,
            amount: Math.max(0, state.save.maxHp - hpAtVictory),
          };
        }
      }
    } else {
      state.save.encounterIndex += 1;
    }
    persist();
    showResult(enemy, rewards);
  }

  function showResult(enemy, rewards) {
    $("#resultTitle").textContent = enemy.boss
      ? "校長を満月から救い出した！"
      : enemy.chapterBoss
        ? "この階の平穏を取り戻した！"
        : "歌を取り戻した！";
    $("#resultSummary").textContent = enemy.boss
      ? "藤原道長の残響がほどけ、校長と学校の記憶が満月から解き放たれた。"
      : enemy.chapterBoss
        ? `${enemy.name}の封印がほどけ、校舎に日常の色が戻り始めた。`
        : `${enemy.name}を鎮め、三つの歌のカケラを取り戻した。`;
    $("#rewardRows").innerHTML = rewards
      .map(
        (reward) => `<div class="reward-row">
      ${cardMarkup(reward.no)}
      <div><b>${reward.no}番　歌のカケラ +${reward.gain}</b><small>${reward.before < reward.after ? `札レベルが ${reward.before} → ${reward.after} に上昇` : `現在 Lv.${reward.after}`}</small></div>
      <strong>${reward.before < reward.after ? "LEVEL UP" : `+${reward.gain}`}</strong>
    </div>`,
      )
      .join("");
    $("#resultDoneButton").textContent = enemy.boss
      ? "いつもの朝へ"
      : enemy.chapterBoss
        ? "戻った学校を見る"
        : "次の場所へ";
    setModal($("#resultModal"), true);
    playSound("victory");
    vibrate([30, 30, 70, 45, 100]);
  }

  function finishResult() {
    setModal($("#resultModal"), false);
    if (state.save.cleared) renderVictory();
    else if (state.pendingChapter)
      renderChapterTransition(state.pendingChapter);
    else renderField();
  }

  function renderChapterTransition(chapter) {
    showScreen("chapterScreen", `${chapter.name}　完`);
    $("#chapterStoryEyebrow").textContent = `${chapter.label} RESTORED`;
    $("#chapterStoryTitle").textContent = chapter.clearTitle;
    $("#chapterStoryText").textContent = chapter.clearText;
    const recovery = chapter.recoveryEvent && state.pendingRecovery;
    $("#chapterRecovery").hidden = !recovery;
    if (recovery) {
      $("#chapterRecoveryTitle").textContent = chapter.recoveryEvent.title;
      $("#chapterRecoveryText").textContent = chapter.recoveryEvent.text;
      $("#chapterRecoveryVoice").textContent = chapter.recoveryEvent.voice;
      $("#chapterRecoveryHp").textContent =
        `${recovery.before} → ${recovery.after}`;
      $("#chapterRecoveryAmount").textContent = recovery.amount
        ? `+${recovery.amount}・全回復`
        : "HP MAX・全回復";
      playSound("recover");
      vibrate([20, 35, 55]);
    }
    $("#chapterContinueButton").textContent = chapter.nextLabel;
    $("#chapterScreen").style.setProperty(
      "--chapter-background",
      `url("${chapter.background}")`,
    );
  }

  function renderVictory() {
    showScreen("victoryScreen", "第四章　学校編　完");
    const leveled = Object.values(state.save.shards).filter(
      (shards) => Core.levelForShards(shards) > 1,
    ).length;
    $("#victoryBattles").textContent = state.save.defeated.length;
    $("#victoryShards").textContent = state.save.totalShards;
    $("#victoryLeveled").textContent = leveled;
    playSound("ending");
  }

  function openCollection() {
    const save = state.save || Core.defaultSave(DATA, 7261);
    $("#archiveShards").textContent = save.totalShards || 0;
    const allEnemies = [...DATA.monsters, DATA.boss];
    $("#archiveMonsters").textContent =
      `${save.defeated?.length || 0} / ${allEnemies.length}`;
    const grown = Object.entries(save.shards || {})
      .map(([no, shards]) => ({ no: Number(no), shards: Number(shards) }))
      .filter((entry) => entry.shards > 0)
      .sort((a, b) => b.shards - a.shards || a.no - b.no);
    $("#cardArchive").innerHTML = grown.length
      ? grown.map((entry) => cardMarkup(entry.no)).join("")
      : '<div class="archive-empty">怪異を倒すと、取り戻した歌珠がここに並びます。</div>';
    $("#monsterArchive").innerHTML = allEnemies
      .map((enemy) => {
        const known = save.defeated?.includes(enemy.id);
        const portrait = known
          ? `<span class="archive-art"><img src="${Art.monsterImage(enemy)}" alt="" loading="lazy" decoding="async"></span>`
          : '<span class="sigil">？</span>';
        return `<div class="archive-monster ${known ? "" : "locked"}">${portrait}<div><b>${known ? escapeHtml(enemy.name) : "未遭遇の校怪"}</b><small>${known ? escapeHtml(enemy.place) : "校舎のどこかに潜んでいる"}</small></div><span>${known ? "解放済" : "未記録"}</span></div>`;
      })
      .join("");
    setModal($("#collectionModal"), true);
  }

  function setModal(modal, open) {
    modal.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) setTimeout(() => $("button, input", modal)?.focus(), 20);
  }

  function vibrate(pattern) {
    if (state.save?.settings?.haptics !== false && navigator.vibrate)
      navigator.vibrate(pattern);
  }

  function audioContext() {
    if (!state.audio) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) state.audio = new AudioCtor();
    }
    return state.audio;
  }

  function tone(frequency, duration, delay = 0, type = "sine", gain = 0.05) {
    if (state.save?.settings?.sound === false) return;
    const context = audioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0.0001, context.currentTime + delay);
    volume.gain.exponentialRampToValueAtTime(
      gain,
      context.currentTime + delay + 0.02,
    );
    volume.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + delay + duration,
    );
    oscillator.connect(volume).connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + duration + 0.03);
  }

  function playSound(type) {
    const patterns = {
      tap: [[540, 0.06, 0]],
      open: [
        [330, 0.16, 0],
        [495, 0.18, 0.09],
      ],
      encounter: [
        [150, 0.32, 0, "triangle", 0.07],
        [112, 0.4, 0.18, "sawtooth", 0.035],
      ],
      boss: [
        [88, 0.55, 0, "sawtooth", 0.045],
        [132, 0.5, 0.24, "triangle", 0.06],
      ],
      bind: [
        [392, 0.14, 0],
        [523, 0.18, 0.1],
      ],
      link: [
        [330, 0.16, 0],
        [440, 0.16, 0.08],
        [660, 0.3, 0.17],
      ],
      hit: [[180, 0.12, 0, "square", 0.045]],
      exact: [
        [294, 0.12, 0],
        [440, 0.18, 0.07],
        [880, 0.4, 0.14, "sine", 0.07],
      ],
      counter: [[115, 0.18, 0, "sawtooth", 0.035]],
      recover: [
        [392, 0.12, 0],
        [587, 0.2, 0.08],
      ],
      error: [
        [170, 0.1, 0, "square", 0.025],
        [150, 0.1, 0.1, "square", 0.02],
      ],
      victory: [
        [392, 0.18, 0],
        [523, 0.18, 0.12],
        [659, 0.18, 0.24],
        [784, 0.4, 0.36],
      ],
      ending: [
        [262, 0.24, 0],
        [392, 0.24, 0.16],
        [523, 0.5, 0.34],
      ],
      defeat: [
        [220, 0.2, 0],
        [174, 0.32, 0.16],
      ],
    };
    (patterns[type] || patterns.tap).forEach((args) => tone(...args));
  }

  function bindEvents() {
    $("#topButton").addEventListener("click", () => {
      clearRaceTimers();
      persist();
      location.href = "index.html";
    });
    $("#newGameButton").addEventListener("click", startNewGame);
    $("#continueButton").addEventListener("click", continueGame);
    $("#startJourneyButton").addEventListener("click", renderField);
    $("#chapterContinueButton").addEventListener("click", () => {
      state.pendingChapter = null;
      state.pendingRecovery = null;
      renderField();
    });
    $("#encounterButton").addEventListener("click", startEncounter);
    $("#resultDoneButton").addEventListener("click", finishResult);
    $("#collectionButton").addEventListener("click", openCollection);
    $("#victoryCollectionButton").addEventListener("click", openCollection);
    $("#returnTopButton").addEventListener("click", () => {
      clearRaceTimers();
      persist();
      location.href = "index.html";
    });
    $("#closeCollectionButton").addEventListener("click", () =>
      setModal($("#collectionModal"), false),
    );

    $("#settingsButton").addEventListener("click", () => {
      updateReaderAudioStatus();
      setModal($("#settingsModal"), true);
    });
    $("#closeSettingsButton").addEventListener("click", () =>
      setModal($("#settingsModal"), false),
    );
    $("#soundToggle").addEventListener("change", (event) => {
      state.save.settings.sound = event.target.checked;
      persist();
    });
    $("#hapticsToggle").addEventListener("change", (event) => {
      state.save.settings.haptics = event.target.checked;
      persist();
    });
    $("#motionToggle").addEventListener("change", (event) => {
      state.save.settings.reducedMotion = event.target.checked;
      applySettings();
      persist();
    });
    $("#resetButton").addEventListener("click", () => {
      if (
        !window.confirm(
          "学校編のセーブデータと歌珠の成長を消して、最初から始めますか？",
        )
      )
        return;
      clearRaceTimers();
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(OLD_SAVE_KEY);
      state.save = Core.defaultSave(DATA, 7261);
      setModal($("#settingsModal"), false);
      refreshTitle();
      showScreen("titleScreen", "花守小学校");
    });
    ["collectionModal", "settingsModal"].forEach((id) => {
      const modal = $("#" + id);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) setModal(modal, false);
      });
    });
    window.addEventListener("pagehide", () => {
      clearRaceTimers();
      persist();
    });
    window.addEventListener("beforeunload", persist);
  }

  function validateData() {
    const missing = [...DATA.monsters, DATA.boss]
      .flatMap((enemy) => enemy.sealPoems)
      .filter(
        (no) =>
          !window.ALL_LOWER?.[no - 1] ||
          poem(no).key === "？" ||
          !poem(no).upper,
      );
    if (missing.length)
      console.warn("百首異聞: 読みデータを確認してください", missing);
  }

  function init() {
    if (!DATA || !Core || !Art || !window.ALL_LOWER?.length) {
      document.body.innerHTML =
        '<main style="padding:24px;color:white">百首データを読み込めませんでした。通信状態を確認して再読み込みしてください。</main>';
      return;
    }
    bindEvents();
    loadSave();
    validateData();
    showScreen("titleScreen", "花守小学校");
  }

  init();
})();
