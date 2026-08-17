(function (global) {
  "use strict";

  const MAX_LEVEL = 5;
  const LEVEL_SHARDS = [0, 0, 3, 7, 12, 18];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function finiteOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function levelForShards(shards) {
    const value = Math.max(0, Number(shards) || 0);
    let level = 1;
    for (let next = 2; next <= MAX_LEVEL; next += 1) {
      if (value >= LEVEL_SHARDS[next]) level = next;
    }
    return level;
  }

  function tagsForCard(poemNo, linkDefinitions) {
    const no = Number(poemNo);
    return Object.values(linkDefinitions)
      .filter((link) => link.poemNos.includes(no))
      .map((link) => link.id);
  }

  function calculateLinks(selected, linkDefinitions) {
    const counts = {};
    selected.filter(Boolean).forEach((no) => {
      tagsForCard(no, linkDefinitions).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.values(linkDefinitions)
      .filter((link) => (counts[link.id] || 0) >= 2)
      .map((link) => ({ ...link, count: counts[link.id] }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
  }

  function battleModifiers(selected, linkDefinitions) {
    const active = calculateLinks(selected, linkDefinitions);
    const count = (id) => active.find((link) => link.id === id)?.count || 0;
    return {
      active,
      damageBonus: count("autumn") * 5,
      mpReduction:
        count("moon") >= 2 ? Math.min(10, (count("moon") - 1) * 5) : 0,
      healOnAttack: count("love") >= 2 ? count("love") * 2 : 0,
      guard: count("water") >= 2 ? Math.min(6, count("water") * 2) : 0,
      exactRecovery: count("sacred") >= 2 ? 8 + count("sacred") * 2 : 0,
    };
  }

  function attackOutcome({
    cardNo,
    sealPoemNo,
    selected,
    shards,
    links,
    boss = false,
  }) {
    const exact = Number(cardNo) === Number(sealPoemNo);
    const level = levelForShards(shards?.[cardNo] || 0);
    const modifiers = battleModifiers(selected, links);
    const baseDamage = boss ? 21 : 25;
    const damage = exact ? 999 : baseDamage + level * 4 + modifiers.damageBonus;
    const mpCost = exact ? 0 : Math.max(8, 20 - modifiers.mpReduction);
    const counterDamage = Math.max(2, (boss ? 13 : 9) - modifiers.guard);
    return {
      exact,
      level,
      damage,
      mpCost,
      counterDamage,
      heal: modifiers.healOnAttack + (exact ? modifiers.exactRecovery : 0),
      mpRecovery: exact ? modifiers.exactRecovery : 0,
      activeLinks: modifiers.active,
    };
  }

  function seededRoute(monsters, count, seed) {
    let value = (Number(seed) || Date.now()) >>> 0;
    const random = () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
    const pool = [...monsters];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool
      .slice(0, clamp(count, 1, pool.length))
      .map((monster) => monster.id);
  }

  function defaultSave(data, seed = Date.now()) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      chapter: data.chapter.id,
      route: seededRoute(data.monsters, data.chapter.normalBattlesPerRun, seed),
      routeIndex: 0,
      defeated: [],
      hp: 120,
      maxHp: 120,
      mp: 100,
      maxMp: 100,
      shards: {},
      totalShards: 0,
      bossUnlocked: false,
      cleared: false,
      playSeconds: 0,
      settings: { sound: true, haptics: true, reducedMotion: false },
    };
  }

  function normalizeSave(raw, data) {
    const fresh = defaultSave(data, 7261);
    if (!raw || typeof raw !== "object" || raw.version !== 1) return fresh;
    const validIds = new Set(data.monsters.map((monster) => monster.id));
    const route = Array.isArray(raw.route)
      ? raw.route.filter((id) => validIds.has(id))
      : [];
    return {
      ...fresh,
      ...raw,
      route:
        route.length === data.chapter.normalBattlesPerRun ? route : fresh.route,
      routeIndex: clamp(
        Number(raw.routeIndex) || 0,
        0,
        data.chapter.normalBattlesPerRun,
      ),
      hp: clamp(
        finiteOr(raw.hp, fresh.maxHp),
        0,
        finiteOr(raw.maxHp, fresh.maxHp),
      ),
      mp: clamp(
        finiteOr(raw.mp, fresh.maxMp),
        0,
        finiteOr(raw.maxMp, fresh.maxMp),
      ),
      shards: raw.shards && typeof raw.shards === "object" ? raw.shards : {},
      defeated: Array.isArray(raw.defeated) ? raw.defeated : [],
      settings: { ...fresh.settings, ...(raw.settings || {}) },
    };
  }

  const api = {
    MAX_LEVEL,
    LEVEL_SHARDS,
    clamp,
    levelForShards,
    tagsForCard,
    calculateLinks,
    battleModifiers,
    attackOutcome,
    seededRoute,
    defaultSave,
    normalizeSave,
  };

  global.HyakushuCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
