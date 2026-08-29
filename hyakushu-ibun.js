(() => {
  "use strict";

  const DATA = window.HYAKUSHU_IBUN_DATA;
  const Core = window.HyakushuCore;
  const Art = window.HyakushuArt;
  const SAVE_KEY = "hyakushu_ibun_save_v2";
  const OLD_SAVE_KEY = "hyakushu_ibun_save_v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];

  const state = {
    save: null,
    battle: null,
    selected: [],
    pickerView: "recommended",
    currentScreen: "titleScreen",
    audio: null,
    sessionStartedAt: Date.now(),
    pendingChapter: null,
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
      upper: normalize(question?.upper),
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
    state.selected = [];
    state.pendingChapter = null;
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

  function startEncounter() {
    const enemy = currentEncounter();
    const chapter = currentChapter();
    const isBoss = enemy.boss || enemy.chapterBoss;
    const maxSealHp = isBoss
      ? chapter.difficulty.bossSealHp
      : chapter.difficulty.sealHp;
    state.battle = {
      enemy,
      seals: enemy.sealPoems.map((poemNo) => ({
        poemNo,
        hp: maxSealHp,
        maxHp: maxSealHp,
      })),
      busy: false,
      turn: 1,
      counterDamage: isBoss
        ? chapter.difficulty.bossCounter
        : chapter.difficulty.counter,
    };
    state.selected = [];
    showScreen(
      "battleScreen",
      enemy.boss ? "第四章　百首匣" : `${chapter.label}　${enemy.place}`,
    );
    $("#setupPanel").hidden = false;
    $("#fightPanel").hidden = true;
    renderBattle();
    renderSlots();
    $("#battleLog").innerHTML =
      `<b>${escapeHtml(enemy.intro)}</b><br>${escapeHtml(enemy.story)}<span class="enemy-threat"><i>危</i>${escapeHtml(enemy.threat)}</span>`;
    const stage = $("#enemyStage");
    stage.style.setProperty(
      "--chapter-background",
      `url("${chapter.background}")`,
    );
    playSound(isBoss ? "boss" : "encounter");
    vibrate(isBoss ? [40, 50, 80] : [35, 45, 35]);
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
    $("#sealLayer").innerHTML = seals
      .map((seal) => {
        const item = poem(seal.poemNo);
        const broken = seal.hp <= 0 ? "broken" : "";
        return `<div class="enemy-seal ${broken}" data-poem="${seal.poemNo}" data-hp="${Math.max(0, seal.hp)}" data-max="${seal.maxHp}">${escapeHtml(item.key)}</div>`;
      })
      .join("");
    updateHud();
  }

  function updateHud() {
    const save = state.save;
    $("#hpText").textContent = `${Math.round(save.hp)} / ${save.maxHp}`;
    $("#mpText").textContent = `${Math.round(save.mp)} / ${save.maxMp}`;
    $("#hpBar").style.width =
      `${Core.clamp((save.hp / save.maxHp) * 100, 0, 100)}%`;
    $("#mpBar").style.width =
      `${Core.clamp((save.mp / save.maxMp) * 100, 0, 100)}%`;
  }

  function renderSlots() {
    const slots = Array.from(
      { length: 5 },
      (_, index) => state.selected[index] || null,
    );
    $("#slots").innerHTML = slots
      .map((no) =>
        no
          ? `<button class="card-slot" type="button" data-remove="${no}" aria-label="${no}番を外す">${cardMarkup(no)}</button>`
          : '<button class="card-slot empty" type="button" data-open-picker aria-label="歌珠を選ぶ"></button>',
      )
      .join("");
    $("#slotCount").textContent = `${state.selected.length} / 5`;
    $("#bindButton").disabled = state.selected.length !== 5;
    renderLinks($("#linkPreview"), state.selected);

    $$("[data-remove]", $("#slots")).forEach((button) => {
      button.addEventListener("click", () => {
        state.selected = state.selected.filter(
          (no) => no !== Number(button.dataset.remove),
        );
        renderSlots();
      });
    });
    $$("[data-open-picker]", $("#slots")).forEach((button) =>
      button.addEventListener("click", openPicker),
    );
  }

  function renderLinks(container, selected) {
    const active = Core.calculateLinks(selected, DATA.links);
    container.innerHTML = active.length
      ? active
          .map(
            (link) =>
              `<span class="link-chip" style="--chip:${link.color}"><i></i>${escapeHtml(link.name)} ×${link.count}</span>`,
          )
          .join("")
      : '<span class="link-empty">同じテーマの札を2枚以上入れると共鳴します</span>';
  }

  function recommendedCards() {
    const exact = state.battle.enemy.sealPoems;
    const exactTags = new Set(
      exact.flatMap((no) => Core.tagsForCard(no, DATA.links)),
    );
    const linked = window.ALL_LOWER.map((_item, index) => index + 1)
      .filter((no) => !exact.includes(no))
      .map((no) => ({
        no,
        score: Core.tagsForCard(no, DATA.links).filter((tag) =>
          exactTags.has(tag),
        ).length,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.no - b.no)
      .slice(0, 9)
      .map((entry) => entry.no);
    return [...new Set([...exact, ...linked])]
      .slice(0, 12)
      .sort((a, b) => a - b);
  }

  function openPicker() {
    state.pickerView = "recommended";
    $("#pickerSearch").value = "";
    setModal($("#pickerModal"), true);
    renderPicker();
  }

  function renderPicker() {
    $$(".picker-tab").forEach((button) =>
      button.classList.toggle(
        "active",
        button.dataset.view === state.pickerView,
      ),
    );
    $("#pickerSearchWrap").hidden = state.pickerView !== "all";
    $("#pickerHint").textContent =
      state.pickerView === "all"
        ? "小倉百人一首1〜100番。番号または下の句で検索できます。"
        : "正解札3枚と、共鳴を組みやすい札が含まれています。";
    const query = normalize($("#pickerSearch").value).toLowerCase();
    let cards =
      state.pickerView === "recommended"
        ? recommendedCards()
        : window.ALL_LOWER.map((_item, index) => index + 1);
    if (query)
      cards = cards.filter(
        (no) => String(no).includes(query) || poem(no).lower.includes(query),
      );
    $("#pickerGrid").innerHTML = cards
      .map((no) => {
        const selected = state.selected.includes(no);
        const disabled = state.selected.length >= 5 && !selected;
        return `<button class="picker-card ${selected ? "selected" : ""}" type="button" data-pick="${no}" ${disabled ? "disabled" : ""} aria-pressed="${selected}">${cardMarkup(no)}</button>`;
      })
      .join("");
    $$("[data-pick]", $("#pickerGrid")).forEach((button) =>
      button.addEventListener("click", () =>
        toggleCard(Number(button.dataset.pick)),
      ),
    );
  }

  function toggleCard(no) {
    if (state.selected.includes(no))
      state.selected = state.selected.filter((value) => value !== no);
    else if (state.selected.length < 5) state.selected.push(no);
    playSound("tap");
    vibrate(12);
    renderSlots();
    renderPicker();
    if (state.selected.length === 5) {
      setModal($("#pickerModal"), false);
      renderLinks($("#readyLinks"), state.selected);
      setModal($("#deckReadyModal"), true);
      playSound("link");
      vibrate([15, 25, 45]);
    }
  }

  function bindDeck() {
    if (state.selected.length !== 5) return;
    setModal($("#deckReadyModal"), false);
    $("#setupPanel").hidden = true;
    $("#fightPanel").hidden = false;
    $("#actionCards").innerHTML = state.selected
      .map(
        (no) =>
          `<button class="action-card" type="button" data-attack="${no}" aria-label="${no}番で攻撃">${cardMarkup(no)}</button>`,
      )
      .join("");
    renderLinks($("#activeLinks"), state.selected);
    const active = Core.calculateLinks(state.selected, DATA.links);
    $("#battleLog").innerHTML = active.length
      ? `<b>《${active.map((link) => link.name).join("・")}》発動！</b><br>五首が光の糸で結ばれた。攻撃する歌珠を選べ。`
      : "五首を展開した。怪異の決まり字に対応する札なら、封印を一撃で破壊できる。";
    $$("[data-attack]", $("#actionCards")).forEach((button) =>
      button.addEventListener("click", () =>
        attack(Number(button.dataset.attack)),
      ),
    );
    playSound(active.length ? "link" : "bind");
    vibrate(active.length ? [15, 25, 45] : 20);
  }

  function livingSeals() {
    return state.battle.seals.filter((seal) => seal.hp > 0);
  }

  function attack(cardNo) {
    if (state.battle.busy) return;
    const exactTarget = livingSeals().find((seal) => seal.poemNo === cardNo);
    const target = exactTarget || livingSeals()[0];
    if (!target) return;
    const outcome = Core.attackOutcome({
      cardNo,
      sealPoemNo: target.poemNo,
      selected: state.selected,
      shards: state.save.shards,
      links: DATA.links,
      boss: state.battle.enemy.boss || state.battle.enemy.chapterBoss,
      counterBase: state.battle.counterDamage,
      guardBonus: state.save.guardBonus,
    });
    if (!outcome.exact && state.save.mp < outcome.mpCost) {
      $("#battleLog").innerHTML =
        "<b>MPが足りない。</b><br>『息を整える』でMPを回復しよう。";
      playSound("error");
      vibrate([20, 30, 20]);
      return;
    }

    state.battle.busy = true;
    state.save.mp = Core.clamp(
      state.save.mp - outcome.mpCost + outcome.mpRecovery,
      0,
      state.save.maxMp,
    );
    state.save.hp = Core.clamp(
      state.save.hp + outcome.heal,
      0,
      state.save.maxHp,
    );
    target.hp = Math.max(0, target.hp - outcome.damage);
    renderBattle();
    playAttackEffect(outcome);

    const targetKey = poem(target.poemNo).key;
    $("#battleLog").innerHTML = outcome.exact
      ? `<b>一首接続――${escapeHtml(targetKey)}、封印破断！</b><br>${cardNo}番の下の句が決まり字へつながった。MP消費なし。`
      : `<b>${outcome.damage} DAMAGE</b><br>${cardNo}番・Lv.${outcome.level}の共鳴攻撃。封印「${escapeHtml(targetKey)}」HP ${target.hp}/${target.maxHp}。`;

    if (!livingSeals().length) {
      setTimeout(finishBattle, state.save.settings.reducedMotion ? 60 : 900);
      return;
    }

    setTimeout(
      () => enemyCounter(outcome.counterDamage),
      state.save.settings.reducedMotion ? 60 : 650,
    );
  }

  function playAttackEffect(outcome) {
    const layer = $("#effectLayer");
    layer.innerHTML = `<i class="slash-effect"></i><b class="damage-number ${outcome.exact ? "exact" : ""}">${outcome.exact ? "一首接続" : outcome.damage}</b>`;
    const stage = $("#enemyStage");
    stage.classList.remove("hit", "exact-hit");
    void stage.offsetWidth;
    stage.classList.toggle("exact-hit", outcome.exact);
    stage.classList.add("hit");
    setTimeout(() => {
      layer.innerHTML = "";
      stage.classList.remove("hit", "exact-hit");
    }, 900);
    playSound(outcome.exact ? "exact" : "hit");
    vibrate(outcome.exact ? [25, 35, 85] : 35);
  }

  function enemyCounter(damage) {
    state.save.hp = Math.max(0, state.save.hp - damage);
    updateHud();
    const stage = $("#enemyStage");
    stage.classList.add("counter");
    setTimeout(() => stage.classList.remove("counter"), 420);
    playSound("counter");
    vibrate([45, 25, 25]);
    if (state.save.hp <= 0) {
      setTimeout(revive, state.save.settings.reducedMotion ? 50 : 550);
      return;
    }
    state.battle.turn += 1;
    $("#turnLabel").textContent = `${state.battle.turn}手目`;
    $("#battleLog").innerHTML += `<br>怪異の反撃――HP -${damage}。`;
    state.battle.busy = false;
  }

  function recover() {
    if (state.battle.busy) return;
    state.battle.busy = true;
    state.save.mp = Math.min(state.save.maxMp, state.save.mp + 25);
    updateHud();
    $("#battleLog").innerHTML =
      "<b>息を整え、歌の流れを取り戻した。MP +25。</b>";
    playSound("recover");
    setTimeout(
      () =>
        enemyCounter(
          Math.max(2, state.battle.counterDamage - state.save.guardBonus),
        ),
      state.save.settings.reducedMotion ? 60 : 550,
    );
  }

  function revive() {
    playSound("defeat");
    state.save.hp = state.save.maxHp;
    state.save.mp = state.save.maxMp;
    state.battle.seals.forEach((seal) => {
      seal.hp = seal.maxHp;
    });
    state.battle.busy = false;
    state.battle.turn = 1;
    state.selected = [];
    $("#setupPanel").hidden = false;
    $("#fightPanel").hidden = true;
    renderBattle();
    renderSlots();
    $("#battleLog").innerHTML =
      "<b>百首の加護があなたを戦いの前へ戻した。</b><br>札の組み合わせを変えて、もう一度挑もう。";
  }

  function finishBattle() {
    const enemy = state.battle.enemy;
    const chapter = currentChapter();
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
      }
    } else {
      state.save.encounterIndex += 1;
    }
    persist();
    showResult(enemy, rewards);
  }

  function showResult(enemy, rewards) {
    $("#resultTitle").textContent = enemy.boss
      ? "月の支配を破った！"
      : enemy.chapterBoss
        ? "この階の平穏を取り戻した！"
        : "歌を取り戻した！";
    $("#resultSummary").textContent = enemy.boss
      ? "百首と学校の記憶が、満月から解き放たれた。"
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
      persist();
      location.href = "index.html";
    });
    $("#newGameButton").addEventListener("click", startNewGame);
    $("#continueButton").addEventListener("click", continueGame);
    $("#startJourneyButton").addEventListener("click", renderField);
    $("#chapterContinueButton").addEventListener("click", () => {
      state.pendingChapter = null;
      renderField();
    });
    $("#encounterButton").addEventListener("click", startEncounter);
    $("#openPickerButton").addEventListener("click", openPicker);
    $("#bindButton").addEventListener("click", bindDeck);
    $("#readyBattleButton").addEventListener("click", bindDeck);
    $("#readyEditButton").addEventListener("click", () => {
      setModal($("#deckReadyModal"), false);
      openPicker();
    });
    $("#recoverButton").addEventListener("click", recover);
    $("#resultDoneButton").addEventListener("click", finishResult);
    $("#collectionButton").addEventListener("click", openCollection);
    $("#victoryCollectionButton").addEventListener("click", openCollection);
    $("#returnTopButton").addEventListener("click", () => {
      persist();
      location.href = "index.html";
    });
    $("#closePickerButton").addEventListener("click", () =>
      setModal($("#pickerModal"), false),
    );
    $("#closeCollectionButton").addEventListener("click", () =>
      setModal($("#collectionModal"), false),
    );
    $("#pickerSearch").addEventListener("input", renderPicker);
    $$(".picker-tab").forEach((button) =>
      button.addEventListener("click", () => {
        state.pickerView = button.dataset.view;
        renderPicker();
      }),
    );

    $("#settingsButton").addEventListener("click", () =>
      setModal($("#settingsModal"), true),
    );
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
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(OLD_SAVE_KEY);
      state.save = Core.defaultSave(DATA, 7261);
      setModal($("#settingsModal"), false);
      refreshTitle();
      showScreen("titleScreen", "花守小学校");
    });
    [
      "pickerModal",
      "collectionModal",
      "settingsModal",
      "deckReadyModal",
    ].forEach((id) => {
      const modal = $("#" + id);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) setModal(modal, false);
      });
    });
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
  }

  function validateData() {
    const missing = [...DATA.monsters, DATA.boss]
      .flatMap((enemy) => enemy.sealPoems)
      .filter((no) => !window.ALL_LOWER?.[no - 1] || poem(no).key === "？");
    if (missing.length)
      console.warn("百首異聞: 決まり字対応を確認してください", missing);
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
