(() => {
  "use strict";

  if (window.KarutaListenRevealMode) return;

  const $ = (selector) => document.querySelector(selector);
  const TOTAL_POEMS = 100;
  const configuredRevealDelay = Number(window.__KARUTA_REVEAL_DELAY_MS__);
  const configuredAudioLead = Number(window.__KARUTA_AUDIO_LEAD_MS__);
  const configuredCharacterMs = Number(window.__KARUTA_CHARACTER_MS__);
  const REVEAL_MS = Number.isFinite(configuredRevealDelay)
    ? Math.max(20, configuredRevealDelay)
    : 2200;
  const AUDIO_LEAD_MS = Number.isFinite(configuredAudioLead)
    ? Math.max(0, configuredAudioLead)
    : 550;
  const CHARACTER_MS = Number.isFinite(configuredCharacterMs)
    ? Math.max(1, configuredCharacterMs)
    : 320;

  let page;
  let order = [];
  let index = 0;
  let currentNumber = 1;
  let phase = "setup";
  let running = false;
  let paused = false;
  let sessionToken = 0;
  let revealTimer = null;

  function audioBridge() {
    return window.KarutaLocalAudio;
  }

  function decisionKeys() {
    return window.HYAKUSHU_IBUN_DATA && window.HYAKUSHU_IBUN_DATA.decisionKeys;
  }

  function decisionKey(number) {
    const keys = decisionKeys();
    return (keys && keys[number - 1]) || "";
  }

  function decisionDelay(number, durationSeconds) {
    const length = Math.max(1, [...decisionKey(number)].length);
    const upperPoems =
      window.HYAKUSHU_IBUN_DATA && window.HYAKUSHU_IBUN_DATA.upperPoems;
    const upper = (upperPoems && upperPoems[number - 1]) || "";
    const durationMs = Number(durationSeconds) * 1000;
    if (
      !Number.isFinite(configuredCharacterMs) &&
      Number.isFinite(durationMs) &&
      durationMs > AUDIO_LEAD_MS + 500 &&
      upper.length
    ) {
      const spokenMs = Math.max(500, durationMs - AUDIO_LEAD_MS - 250);
      const measuredCharacterMs = Math.max(
        180,
        Math.min(520, spokenMs / [...upper].length),
      );
      return AUDIO_LEAD_MS + length * measuredCharacterMs;
    }
    return AUDIO_LEAD_MS + length * CHARACTER_MS;
  }

  function shuffledPoemNumbers() {
    if (
      Array.isArray(window.__KARUTA_REVEAL_ORDER__) &&
      window.__KARUTA_REVEAL_ORDER__.length === TOTAL_POEMS
    ) {
      return [...window.__KARUTA_REVEAL_ORDER__];
    }
    const numbers = Array.from({ length: TOTAL_POEMS }, (_, item) => item + 1);
    for (let item = numbers.length - 1; item > 0; item -= 1) {
      const target = Math.floor(Math.random() * (item + 1));
      [numbers[item], numbers[target]] = [numbers[target], numbers[item]];
    }
    return numbers;
  }

  function clean(text) {
    return String(text || "").replace(/[\s　]/g, "");
  }

  function distribute(text) {
    const value = clean(text);
    const first = Math.ceil(value.length / 3);
    const second = Math.ceil((value.length - first) / 2);
    return [
      value.slice(0, first),
      value.slice(first, first + second),
      value.slice(first + second),
    ];
  }

  function clearRevealTimer() {
    if (revealTimer) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
  }

  function stopAudio() {
    const bridge = audioBridge();
    if (bridge && typeof bridge.stop === "function") bridge.stop();
  }

  function injectStyles() {
    if ($("#listenRevealStyles")) return;
    const style = document.createElement("style");
    style.id = "listenRevealStyles";
    style.textContent = `
.listen-entry{width:100%;border:0;border-radius:13px;background:linear-gradient(135deg,#315f42,#477c5b);color:#fff;padding:14px 8px;font-size:16px;font-weight:900;margin-top:9px;box-shadow:0 5px 14px rgba(49,95,66,.18)}
.listen-page{min-height:calc(100dvh - 24px)}.listen-panel{background:rgba(255,255,255,.72);border-radius:18px;padding:15px 12px;min-height:calc(100dvh - 30px)}
.listen-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.listen-back{border:0;background:#fff;color:#5f5a52;border-radius:10px;padding:8px 11px;font-weight:800}.listen-progress{font-size:12px;color:#746f66;font-weight:900}
.listen-kicker{text-align:center;color:#a77a20;font-size:10px;font-weight:900;letter-spacing:.16em;margin-top:9px}.listen-title{text-align:center;font-size:23px;font-weight:900;margin:4px 0}.listen-lead{text-align:center;color:#6f695f;font-size:12px;line-height:1.65;margin:0 auto 13px;max-width:330px}
.listen-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:5px;background:#fffaf0;border:1px solid #eadfcd;border-radius:15px;padding:12px 8px;margin:12px 0}.listen-flow-step{text-align:center;font-size:10px;color:#5d574f;font-weight:900;line-height:1.45}.listen-flow-step b{display:block;font-size:20px;margin-bottom:3px}.listen-flow-arrow{color:#a77a20;font-weight:900}.listen-source{background:#fff;border-radius:12px;padding:11px;margin:10px 0;font-size:11px;line-height:1.6;color:#625d55}.listen-source strong{color:#315f42}.listen-source.ready{box-shadow:inset 4px 0 #315f42}.listen-source.missing{box-shadow:inset 4px 0 #b43b30}.listen-start{width:100%;border:0;border-radius:13px;background:#315f42;color:#fff;padding:15px 8px;font-size:17px;font-weight:900}.listen-start:disabled{opacity:.42}
.listen-stage{background:linear-gradient(160deg,#fffdf7,#f3ead8);border-radius:20px;min-height:430px;padding:17px 10px 14px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden}.listen-number{position:absolute;left:13px;top:12px;background:#315f42;color:#fff;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:900}.listen-phase{font-size:12px;color:#746f66;font-weight:900;letter-spacing:.09em;margin-bottom:12px}.listen-audio-visual{width:176px;height:176px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#fff 0 35%,#dce9df 36% 55%,#eff5f0 56%);color:#315f42;font-size:58px;box-shadow:0 12px 28px rgba(49,95,66,.14);animation:listenPulse 1.8s ease-in-out infinite}.listen-audio-visual.is-paused{animation:none;filter:grayscale(.5);opacity:.65}.listen-audio-copy{font-size:15px;color:#315f42;font-weight:900;margin-top:16px}.listen-audio-note{font-size:10px;color:#857e73;margin-top:5px}
.listen-fuda{width:min(205px,58vw);aspect-ratio:.72;background:#315f42;padding:7px;border-radius:3px;box-shadow:0 11px 23px rgba(0,0,0,.18);animation:listenReveal .3s ease-out}.listen-fuda-inner{height:100%;background:#fffef9;padding:10% 5% 6%;overflow:hidden}.listen-fuda-grid{height:100%;display:grid;grid-template-columns:repeat(3,1fr);direction:rtl}.listen-fuda-col{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:clamp(22px,6.4vw,29px);line-height:1.08;display:flex;flex-direction:column;align-items:center;white-space:nowrap}.listen-fuda-char{height:1.08em}.listen-lower-label{font-size:12px;color:#a77a20;font-weight:900;margin-bottom:10px}.listen-kimari-result{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:20px;color:#315f42;font-weight:900;margin-top:10px}.listen-next-note{font-size:11px;color:#746f66;margin-top:5px;font-weight:800}
.listen-error{display:none;background:#fff2ef;color:#9e342b;border-radius:12px;padding:10px;margin:9px 0;font-size:11px;line-height:1.55}.listen-error.show{display:block}.listen-controls{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:9px}.listen-controls button{border:1px solid #d7d0c5;background:#fff;color:#5f5a52;border-radius:11px;padding:11px 3px;font-size:11px;font-weight:900}.listen-controls .pause{background:#315f42;color:#fff;border-color:#315f42}.listen-controls button:disabled{opacity:.45}
.listen-summary{text-align:center;padding:25px 6px}.listen-complete{font-size:56px;margin:10px 0}.listen-summary h2{font-size:24px;margin:5px}.listen-summary p{font-size:12px;color:#6f695f;line-height:1.7}.listen-summary-actions{display:grid;gap:8px;margin-top:18px}.listen-summary-actions button{border:0;border-radius:13px;padding:14px;font-weight:900}.listen-again{background:#315f42;color:#fff}.listen-home{background:#ece7de;color:#5f5a52}
@keyframes listenPulse{0%,100%{transform:scale(.96);box-shadow:0 8px 20px rgba(49,95,66,.1)}50%{transform:scale(1);box-shadow:0 15px 34px rgba(49,95,66,.22)}}@keyframes listenReveal{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
@media(max-width:420px){.listen-panel{padding:12px 9px}.listen-stage{min-height:410px}.listen-flow{padding:10px 5px}.listen-flow-step{font-size:9px}}
`;
    document.head.appendChild(style);
  }

  function makePage() {
    page = $("#listenRevealScreen");
    if (page) return;
    page = document.createElement("section");
    page.id = "listenRevealScreen";
    page.className = "page listen-page";
    page.innerHTML = `
      <div class="listen-panel">
        <div class="listen-top">
          <button id="listenBack" class="listen-back" type="button">← 戻る</button>
          <div id="listenProgress" class="listen-progress"></div>
        </div>

        <div id="listenSetup">
          <div class="listen-kicker">LISTEN &amp; REVEAL</div>
          <div class="listen-title">決まり字フラッシュ</div>
          <div class="listen-lead">試合で分からない札を減らすため、上の句を聞き、その歌が確定する最速の決まり字で下の句札を表示します。</div>
          <div class="listen-flow" aria-label="練習の流れ">
            <div class="listen-flow-step"><b>🎧</b>上の句を聞く</div>
            <div class="listen-flow-arrow">→</div>
            <div class="listen-flow-step"><b>決</b>決まり字で表示</div>
            <div class="listen-flow-arrow">→</div>
            <div class="listen-flow-step"><b>↻</b>自動で次へ</div>
          </div>
          <div id="listenSource" class="listen-source" aria-live="polite">音源を確認しています…</div>
          <button id="listenStart" class="listen-start" type="button" disabled>100首ランダムを始める</button>
        </div>

        <div id="listenPlay" hidden>
          <div class="listen-stage">
            <div id="listenNumber" class="listen-number"></div>
            <div id="listenPhase" class="listen-phase" aria-live="polite"></div>
            <div id="listenAudioScene">
              <div id="listenAudioVisual" class="listen-audio-visual" aria-hidden="true">♪</div>
              <div class="listen-audio-copy">上の句に集中</div>
              <div class="listen-audio-note">その歌が確定する決まり字まで聞きます</div>
            </div>
            <div id="listenCardScene" hidden>
              <div class="listen-lower-label">対応する下の句札</div>
              <div id="listenFuda" class="listen-fuda">
                <div class="listen-fuda-inner"><div id="listenFudaGrid" class="listen-fuda-grid"></div></div>
              </div>
              <div id="listenKimariResult" class="listen-kimari-result"></div>
              <div class="listen-next-note">約2秒後、次の上の句へ</div>
            </div>
          </div>
          <div id="listenError" class="listen-error" role="alert"></div>
          <div class="listen-controls">
            <button id="listenReplay" type="button">↶ もう一度</button>
            <button id="listenPause" class="pause" type="button">Ⅱ 一時停止</button>
            <button id="listenNext" type="button">次へ ›</button>
          </div>
        </div>

        <div id="listenSummary" class="listen-summary" hidden>
          <div class="listen-kicker">100 POEMS COMPLETE</div>
          <div class="listen-complete">◎</div>
          <h2>百首を一周しました</h2>
          <p>100首すべてを、決まり字の最速タイミングで下の句札につなげました。</p>
          <div class="listen-summary-actions">
            <button id="listenAgain" class="listen-again" type="button">もう一周する</button>
            <button id="listenHome" class="listen-home" type="button">設定へ戻る</button>
          </div>
        </div>
      </div>`;
    document.querySelector(".app").appendChild(page);

    $("#listenBack").onclick = exitMode;
    $("#listenStart").onclick = startSession;
    $("#listenAgain").onclick = startSession;
    $("#listenHome").onclick = exitMode;
    $("#listenReplay").onclick = replayCurrent;
    $("#listenPause").onclick = togglePause;
    $("#listenNext").onclick = skipCurrent;
  }

  function installEntry() {
    const panel = $("#startScreen .panel");
    if (!panel || $("#listenRevealEntry")) return;
    const button = document.createElement("button");
    button.id = "listenRevealEntry";
    button.className = "listen-entry";
    button.type = "button";
    button.textContent = "⚡ 決まり字で下の句札を表示";
    const dashboard = $("#dashBtn");
    dashboard
      ? panel.insertBefore(button, dashboard)
      : panel.appendChild(button);
    button.onclick = showSetup;
  }

  function showPage() {
    document
      .querySelectorAll(".page, .voice-page")
      .forEach((element) => element.classList.remove("active"));
    page.classList.add("active");
  }

  async function showSetup() {
    sessionToken += 1;
    running = false;
    paused = false;
    phase = "setup";
    clearRevealTimer();
    stopAudio();
    showPage();
    $("#listenProgress").textContent = "";
    $("#listenSetup").hidden = false;
    $("#listenPlay").hidden = true;
    $("#listenSummary").hidden = true;
    const source = $("#listenSource");
    const start = $("#listenStart");
    source.className = "listen-source";
    source.textContent = "音源を確認しています…";
    start.disabled = true;

    const bridge = audioBridge();
    const count = bridge && (await bridge.countTracks().catch(() => 0));
    if (!page.classList.contains("active") || phase !== "setup") return;
    if (count === TOTAL_POEMS) {
      source.className = "listen-source ready";
      source.innerHTML =
        "<strong>a音源 100/100曲を確認しました。</strong><br>100首をランダムに出題し、決まり字で札を自動表示します。";
      start.disabled = false;
    } else {
      source.className = "listen-source missing";
      source.innerHTML = `<strong>a音源が ${count || 0}/100曲です。</strong><br>戻って「読手MP3〈a音源〉」から a001〜a100 を読み込んでください。`;
    }
  }

  function startSession() {
    const bridge = audioBridge();
    if (!bridge) return;
    if (typeof bridge.unlock === "function") bridge.unlock();
    clearRevealTimer();
    stopAudio();
    order = shuffledPoemNumbers();
    index = 0;
    currentNumber = order[0];
    phase = "audio";
    running = true;
    paused = false;
    $("#listenSetup").hidden = true;
    $("#listenSummary").hidden = true;
    $("#listenPlay").hidden = false;
    $("#listenError").classList.remove("show");
    showPage();
    const token = ++sessionToken;
    playCurrent(token);
  }

  function updateProgress() {
    $("#listenProgress").textContent = `${index + 1} / ${TOTAL_POEMS}`;
    $("#listenNumber").textContent = `第${index + 1}問`;
  }

  function renderFuda(number) {
    const poem = window.ALL_LOWER && window.ALL_LOWER[number - 1];
    const grid = $("#listenFudaGrid");
    grid.innerHTML = "";
    distribute(poem ? poem.lower : "").forEach((part) => {
      const column = document.createElement("div");
      column.className = "listen-fuda-col";
      [...part].forEach((character) => {
        const item = document.createElement("span");
        item.className = "listen-fuda-char";
        item.textContent = character;
        column.appendChild(item);
      });
      grid.appendChild(column);
    });
  }

  async function playCurrent(token) {
    if (!running || paused || token !== sessionToken) return;
    clearRevealTimer();
    stopAudio();
    currentNumber = order[index];
    phase = "audio";
    updateProgress();
    $("#listenPhase").textContent = "上の句の音声を聞く";
    $("#listenAudioScene").hidden = false;
    $("#listenCardScene").hidden = true;
    $("#listenAudioVisual").classList.remove("is-paused");
    $("#listenError").classList.remove("show");
    $("#listenPause").disabled = false;
    $("#listenPause").textContent = "Ⅱ 一時停止";

    const bridge = audioBridge();
    let duration = null;
    const started = await bridge.playNumber(currentNumber, {
      onStarted: (audioInfo) => {
        duration = audioInfo && audioInfo.duration;
      },
      onEnded: () => revealCurrent(token),
      onError: () => showPlaybackError(token),
    });
    if (token !== sessionToken || paused || !running) return;
    if (!started) {
      showPlaybackError(token);
      return;
    }
    revealTimer = setTimeout(
      () => revealCurrent(token),
      decisionDelay(currentNumber, duration),
    );
  }

  function revealCurrent(token) {
    if (!running || paused || token !== sessionToken || phase !== "audio")
      return;
    clearRevealTimer();
    stopAudio();
    phase = "reveal";
    renderFuda(currentNumber);
    const key = decisionKey(currentNumber);
    $("#listenPhase").textContent = "決まり字で下の句札が確定";
    $("#listenNumber").textContent = `${currentNumber}番`;
    $("#listenKimariResult").textContent = `決まり字「${key}」`;
    $("#listenAudioScene").hidden = true;
    $("#listenCardScene").hidden = false;
    revealTimer = setTimeout(() => advance(token), REVEAL_MS);
  }

  function advance(token) {
    if (!running || paused || token !== sessionToken) return;
    clearRevealTimer();
    index += 1;
    if (index >= TOTAL_POEMS) {
      finishSession();
      return;
    }
    playCurrent(token);
  }

  function showPlaybackError(token) {
    if (token !== sessionToken || !running) return;
    paused = true;
    clearRevealTimer();
    stopAudio();
    $("#listenAudioVisual").classList.add("is-paused");
    $("#listenPhase").textContent = "音声を再生できませんでした";
    const error = $("#listenError");
    error.textContent = `a${String(currentNumber).padStart(3, "0")} の音声を確認し、「もう一度」を押してください。`;
    error.classList.add("show");
    $("#listenPause").disabled = true;
  }

  function replayCurrent() {
    if (!running) return;
    const bridge = audioBridge();
    if (bridge && typeof bridge.unlock === "function") bridge.unlock();
    paused = false;
    const token = ++sessionToken;
    playCurrent(token);
  }

  function togglePause() {
    if (!running) return;
    if (paused) {
      paused = false;
      const token = ++sessionToken;
      $("#listenPause").textContent = "Ⅱ 一時停止";
      if (phase === "reveal") revealCurrentFromPause(token);
      else playCurrent(token);
      return;
    }

    paused = true;
    sessionToken += 1;
    clearRevealTimer();
    stopAudio();
    $("#listenAudioVisual").classList.add("is-paused");
    $("#listenPhase").textContent = "一時停止中";
    $("#listenPause").textContent = "▶ 再開";
  }

  function revealCurrentFromPause(token) {
    phase = "reveal";
    renderFuda(currentNumber);
    updateProgress();
    const key = decisionKey(currentNumber);
    $("#listenPhase").textContent = "決まり字で下の句札が確定";
    $("#listenNumber").textContent = `${currentNumber}番`;
    $("#listenKimariResult").textContent = `決まり字「${key}」`;
    $("#listenAudioScene").hidden = true;
    $("#listenCardScene").hidden = false;
    $("#listenAudioVisual").classList.remove("is-paused");
    revealTimer = setTimeout(() => advance(token), REVEAL_MS);
  }

  function skipCurrent() {
    if (!running) return;
    paused = false;
    clearRevealTimer();
    stopAudio();
    index += 1;
    const token = ++sessionToken;
    if (index >= TOTAL_POEMS) finishSession();
    else playCurrent(token);
  }

  function finishSession() {
    clearRevealTimer();
    stopAudio();
    running = false;
    paused = false;
    phase = "complete";
    sessionToken += 1;
    $("#listenPlay").hidden = true;
    $("#listenSummary").hidden = false;
    $("#listenProgress").textContent = "100 / 100";
  }

  function exitMode() {
    sessionToken += 1;
    running = false;
    paused = false;
    phase = "setup";
    clearRevealTimer();
    stopAudio();
    page.classList.remove("active");
    $("#startScreen").classList.add("active");
  }

  function init() {
    if (
      !window.ALL_LOWER ||
      !decisionKeys() ||
      !audioBridge() ||
      !$("#startScreen")
    ) {
      setTimeout(init, 100);
      return;
    }
    injectStyles();
    makePage();
    installEntry();
  }

  window.KarutaListenRevealMode = {
    showSetup,
    startSession,
    decisionDelay,
  };
  init();
})();
