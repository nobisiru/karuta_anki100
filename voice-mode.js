(() => {
  if (window.KarutaVoiceMode) return;

  const $ = (selector) => document.querySelector(selector);
  const GROUP_SIZE = 7;
  const TWO_GROUP_KEY = "karuta_voice_two_group_v1";

  let page;
  let queue = [];
  let index = 0;
  let current = null;
  let phase = "see";
  let results = {};
  let requeues = {};
  let autoTimer = null;
  let selectedKind = "one";
  let selectedGroup = readStoredGroup();
  let sessionCards = [];

  function readStoredGroup() {
    try {
      const value = Number(localStorage.getItem(TWO_GROUP_KEY));
      return Number.isInteger(value) && value >= 0 ? value : 0;
    } catch (_error) {
      return 0;
    }
  }

  function storeGroup() {
    try {
      localStorage.setItem(TWO_GROUP_KEY, String(selectedGroup));
    } catch (_error) {
      // The mode still works when private browsing blocks storage.
    }
  }

  function oneCards() {
    return window.QUESTION_POOL.filter((poem) => [...poem.key].length === 1);
  }

  function twoCards() {
    return window.QUESTION_POOL.filter((poem) => [...poem.key].length === 2);
  }

  function twoGroupCount() {
    return Math.ceil(twoCards().length / GROUP_SIZE);
  }

  function cardsForSelection() {
    if (selectedKind === "one") return oneCards();
    const start = selectedGroup * GROUP_SIZE;
    return twoCards().slice(start, start + GROUP_SIZE);
  }

  function selectionLabel() {
    if (selectedKind === "one") return "一字決まり・全7首";
    return `二字決まり・第${selectedGroup + 1}組`;
  }

  function clean(text) {
    return String(text || "").replace(/[\s　]/g, "");
  }

  function distribute(text) {
    const length = text.length;
    const first = Math.ceil(length / 3);
    const second = Math.ceil((length - first) / 2);
    return [
      text.slice(0, first),
      text.slice(first, first + second),
      text.slice(first + second),
    ];
  }

  function injectStyles() {
    if ($("#voiceModeStyles")) return;
    const styles = document.createElement("style");
    styles.id = "voiceModeStyles";
    styles.textContent = `
.voice-entry{width:100%;border:0;border-radius:13px;background:#a77a20;color:#fff;padding:14px 8px;font-size:17px;font-weight:900;margin-top:9px}.voice-page{display:none;min-height:calc(100dvh - 24px)}.voice-page.active{display:block}.voice-panel{background:rgba(255,255,255,.7);border-radius:18px;padding:16px 13px;min-height:calc(100dvh - 30px)}.voice-top{display:flex;justify-content:space-between;align-items:center}.voice-back{border:0;background:#fff;color:#5f5a52;border-radius:10px;padding:8px 11px;font-weight:800}.voice-progress{font-size:12px;color:#746f66;font-weight:800}.voice-kicker{text-align:center;color:#a77a20;font-size:10px;font-weight:900;letter-spacing:.17em;margin-top:4px}.voice-title{text-align:center;font-size:23px;font-weight:900;margin:4px 0}.voice-lead{text-align:center;color:#746f66;font-size:12px;line-height:1.55;margin-bottom:8px}.voice-setup{margin-top:12px}.voice-setup-label{font-size:11px;color:#746f66;font-weight:900;margin:12px 2px 7px}.voice-mode-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}.voice-mode-option{border:2px solid transparent;border-radius:15px;background:#fff;padding:13px 8px;color:#4f4a43;text-align:left;min-height:83px}.voice-mode-option.selected{border-color:#315f42;background:#f2f7f2}.voice-mode-option b{display:block;font-size:17px;color:#315f42;margin-bottom:5px}.voice-mode-option span{display:block;font-size:10px;line-height:1.4;color:#746f66}.voice-groups{display:none}.voice-groups.show{display:block}.voice-group-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.voice-group{border:1px solid #ddd5c9;border-radius:11px;background:#fff;padding:9px 4px;color:#615b52;font-weight:900}.voice-group.selected{background:#315f42;border-color:#315f42;color:#fff}.voice-group-preview{background:#fffaf0;border-radius:12px;margin-top:8px;padding:10px;text-align:center;font-family:"Yu Mincho","Hiragino Mincho ProN",serif;font-weight:900;color:#315f42;letter-spacing:.05em}.voice-start{width:100%;margin-top:13px}.voice-card{background:#fffaf0;border-radius:18px;padding:12px 8px;text-align:center;min-height:350px;display:flex;flex-direction:column;justify-content:center;align-items:center}.voice-step{font-size:11px;color:#746f66;font-weight:900;letter-spacing:.08em;margin-bottom:7px}.voice-key{font-family:"Yu Mincho","Hiragino Mincho ProN",serif;font-size:54px;line-height:1;font-weight:900;color:#315f42;margin:3px 0 8px}.voice-fuda{width:min(185px,52vw);aspect-ratio:.72;background:#315f42;padding:7px;border-radius:3px;box-shadow:0 8px 18px rgba(0,0,0,.18);transition:.2s}.voice-fuda-inner{height:100%;background:#fffef9;padding:10% 5% 6%;overflow:hidden}.voice-fuda-grid{height:100%;display:grid;grid-template-columns:repeat(3,1fr);direction:rtl}.voice-fuda-col{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:clamp(20px,6vw,28px);line-height:1.08;display:flex;flex-direction:column;align-items:center;white-space:nowrap}.voice-fuda-char{height:1.08em}.voice-fuda.masked .voice-fuda-inner{background:#f3efe5}.voice-fuda.masked .voice-fuda-grid{visibility:hidden}.voice-cue{font-size:14px;color:#5d574f;font-weight:800;margin-top:9px}.voice-timer{font-size:12px;color:#8b8378;margin-top:5px;min-height:18px}.voice-actions{display:grid;gap:8px;margin-top:9px}.voice-main{border:0;border-radius:13px;background:#315f42;color:#fff;padding:14px;font-weight:900;font-size:16px}.voice-main.gold{background:#a77a20}.voice-main.soft{background:#ece7de;color:#5f5a52}.voice-self{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.voice-self button{border:1px solid #d8d0c4;background:#fff;border-radius:12px;padding:12px 4px;font-weight:900;font-size:13px}.voice-self .yes{color:#16804d}.voice-self .maybe{color:#a77a20}.voice-self .no{color:#b43b30}.voice-note{text-align:center;color:#746f66;font-size:10px;line-height:1.55;margin-top:8px}.voice-summary{display:none;text-align:center}.voice-summary.show{display:block}.voice-summary-mode{font-size:13px;color:#746f66;font-weight:900;margin-top:8px}.voice-big{font-size:48px;font-weight:900;color:#315f42;margin:8px 0}.voice-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:12px 0}.voice-stat{background:#fff;border-radius:12px;padding:11px 4px}.voice-stat b{display:block;font-size:23px}.voice-stat span{font-size:9px;color:#746f66}.voice-review{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:12px 0}.voice-dot{border-radius:8px;padding:9px 1px;background:#ece7de;font-family:"Yu Mincho",serif;font-weight:900;font-size:17px}.voice-dot.ok{background:#315f42;color:#fff}.voice-dot.mid{background:#d7c083;color:#fff}.voice-dot.ng{background:#b66a61;color:#fff}.voice-summary-actions{display:grid;gap:8px}.voice-next{background:#a77a20}@media(max-width:420px){.voice-panel{padding:12px 9px}.voice-card{min-height:340px}.voice-key{font-size:48px}.voice-fuda{width:min(170px,49vw)}}`;
    document.head.appendChild(styles);
  }

  function renderFuda(text, masked = false) {
    const card = $("#voiceFuda");
    card.className = `voice-fuda${masked ? " masked" : ""}`;
    const grid = $("#voiceFudaGrid");
    grid.innerHTML = "";
    distribute(clean(text)).forEach((part) => {
      const column = document.createElement("div");
      column.className = "voice-fuda-col";
      [...part].forEach((character) => {
        const item = document.createElement("span");
        item.className = "voice-fuda-char";
        item.textContent = character;
        column.appendChild(item);
      });
      grid.appendChild(column);
    });
  }

  function makePage() {
    page = $("#voiceScreen");
    if (page) return;

    page = document.createElement("section");
    page.id = "voiceScreen";
    page.className = "voice-page";
    page.innerHTML = `
      <div class="voice-panel">
        <div class="voice-top">
          <button id="voiceBack" class="voice-back" type="button">← 戻る</button>
          <div id="voiceProgress" class="voice-progress"></div>
        </div>
        <div class="voice-kicker">VOICE SHADOWING</div>
        <div class="voice-title">声出し暗記</div>
        <div class="voice-lead">決まり字を見て、実物に近い取り札を声に出して覚える。</div>

        <div id="voiceSetup" class="voice-setup">
          <div class="voice-setup-label">覚える決まり字</div>
          <div class="voice-mode-options">
            <button class="voice-mode-option" data-kind="one" type="button">
              <b>一字決まり</b><span>む・す・め・ふ・さ・ほ・せ<br>全7首</span>
            </button>
            <button class="voice-mode-option" data-kind="two" type="button">
              <b>二字決まり</b><span>42首を7首ずつ<br>6組に分けて練習</span>
            </button>
          </div>
          <div id="voiceGroups" class="voice-groups">
            <div class="voice-setup-label">練習する7首</div>
            <div id="voiceGroupGrid" class="voice-group-grid"></div>
            <div id="voiceGroupPreview" class="voice-group-preview"></div>
          </div>
          <button id="voiceStart" class="voice-main voice-start" type="button">この7首を始める</button>
        </div>

        <div id="voicePlay" hidden>
          <div class="voice-card">
            <div id="voiceStep" class="voice-step"></div>
            <div id="voiceKey" class="voice-key"></div>
            <div id="voiceFuda" class="voice-fuda">
              <div class="voice-fuda-inner"><div id="voiceFudaGrid" class="voice-fuda-grid"></div></div>
            </div>
            <div id="voiceCue" class="voice-cue"></div>
            <div id="voiceTimer" class="voice-timer"></div>
          </div>
          <div id="voiceActions" class="voice-actions"></div>
          <div class="voice-note">声に出したあと、自分で「言えた／あやしい／言えない」を判定します。</div>
        </div>

        <div id="voiceSummary" class="voice-summary">
          <div class="voice-kicker">SESSION COMPLETE</div>
          <div id="voiceSummaryMode" class="voice-summary-mode"></div>
          <div class="voice-big" id="voiceBig"></div>
          <div id="voiceStats" class="voice-stats"></div>
          <div id="voiceReview" class="voice-review"></div>
          <div class="voice-summary-actions">
            <button id="voiceNextGroup" class="voice-main voice-next" type="button">次の7首へ</button>
            <button id="voiceAgain" class="voice-main" type="button">同じ7首をもう一度</button>
            <button id="voiceChoose" class="voice-main soft" type="button">札を選び直す</button>
            <button id="voiceHome" class="voice-main gold" type="button">設定へ戻る</button>
          </div>
        </div>
      </div>`;
    document.querySelector(".app").appendChild(page);

    $("#voiceBack").onclick = exitVoice;
    $("#voiceStart").onclick = startVoice;
    $("#voiceAgain").onclick = startVoice;
    $("#voiceChoose").onclick = showSetup;
    $("#voiceHome").onclick = exitVoice;
    $("#voiceNextGroup").onclick = () => {
      if (selectedKind !== "two" || selectedGroup >= twoGroupCount() - 1)
        return;
      selectedGroup += 1;
      storeGroup();
      startVoice();
    };
    document.querySelectorAll(".voice-mode-option").forEach((button) => {
      button.onclick = () => {
        selectedKind = button.dataset.kind;
        renderSetup();
      };
    });
  }

  function installEntry() {
    const start = $("#startScreen .panel");
    if (!start || $("#voiceEntry")) return;
    const button = document.createElement("button");
    button.id = "voiceEntry";
    button.className = "voice-entry";
    button.type = "button";
    button.textContent = "🗣 声出し暗記";
    const dashboard = $("#dashBtn");
    dashboard
      ? start.insertBefore(button, dashboard)
      : start.appendChild(button);
    button.onclick = showSetup;
  }

  function showVoice() {
    document
      .querySelectorAll(".page, .voice-page")
      .forEach((element) => element.classList.remove("active"));
    page.classList.add("active");
  }

  function exitVoice() {
    clearInterval(autoTimer);
    page.classList.remove("active");
    $("#startScreen").classList.add("active");
  }

  function renderSetup() {
    const groups = twoGroupCount();
    selectedGroup = Math.min(selectedGroup, Math.max(0, groups - 1));
    document.querySelectorAll(".voice-mode-option").forEach((button) => {
      button.classList.toggle("selected", button.dataset.kind === selectedKind);
    });

    const groupArea = $("#voiceGroups");
    groupArea.classList.toggle("show", selectedKind === "two");
    const groupGrid = $("#voiceGroupGrid");
    groupGrid.innerHTML = "";
    for (let group = 0; group < groups; group += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `voice-group${group === selectedGroup ? " selected" : ""}`;
      button.textContent = `第${group + 1}組`;
      button.onclick = () => {
        selectedGroup = group;
        storeGroup();
        renderSetup();
      };
      groupGrid.appendChild(button);
    }

    const preview = cardsForSelection()
      .map((poem) => poem.key)
      .join("・");
    $("#voiceGroupPreview").textContent = preview;
    $("#voiceStart").textContent =
      selectedKind === "one"
        ? "一字決まり7首を始める"
        : `第${selectedGroup + 1}組を始める`;
  }

  function showSetup() {
    clearInterval(autoTimer);
    showVoice();
    $("#voiceProgress").textContent = "";
    $("#voiceSetup").hidden = false;
    $("#voicePlay").hidden = true;
    $("#voiceSummary").classList.remove("show");
    renderSetup();
  }

  function startVoice() {
    clearInterval(autoTimer);
    sessionCards = cardsForSelection();
    if (!sessionCards.length) return;
    queue = sessionCards.map((poem, cardIndex) => ({
      p: poem,
      repeat: false,
      ordinal: cardIndex + 1,
    }));
    index = 0;
    results = {};
    requeues = {};
    $("#voiceSetup").hidden = true;
    $("#voiceSummary").classList.remove("show");
    $("#voicePlay").hidden = false;
    showVoice();
    nextCard();
  }

  function nextCard() {
    if (index >= queue.length) {
      finishVoice();
      return;
    }
    current = queue[index];
    phase = "see";
    renderPhase();
  }

  function setActions(html) {
    $("#voiceActions").innerHTML = html;
  }

  function renderPhase() {
    const poem = current.p;
    $("#voiceProgress").textContent =
      `${current.ordinal} / ${sessionCards.length}${
        current.repeat ? "・復習" : ""
      }`;
    $("#voiceKey").textContent = poem.key;
    $("#voiceTimer").textContent = "";

    if (phase === "see") {
      $("#voiceStep").textContent = "STEP 1　札を見る";
      renderFuda(poem.lower);
      $("#voiceCue").textContent = "決まり字と、この取り札をセットで見ます";
      setActions(
        '<button id="vNext" class="voice-main" type="button">声に出す →</button>',
      );
      $("#vNext").onclick = () => {
        phase = "shadow";
        renderPhase();
      };
      return;
    }

    if (phase === "shadow") {
      $("#voiceStep").textContent = "STEP 2　札を見ながら声に出す";
      renderFuda(poem.lower);
      $("#voiceCue").textContent =
        `「${poem.key} → ${clean(poem.lower).slice(0, 7)}…」`;
      setActions(
        '<button id="vNext" class="voice-main gold" type="button">札を隠して言う →</button>',
      );
      $("#vNext").onclick = () => {
        phase = "recall";
        renderPhase();
      };
      return;
    }

    if (phase === "recall") {
      $("#voiceStep").textContent = "STEP 3　札を思い浮かべて言う";
      renderFuda(poem.lower, true);
      $("#voiceCue").textContent =
        `「${poem.key} → ？」 札の文字を思い浮かべよう`;
      let seconds = 3;
      $("#voiceTimer").textContent = `札を出すまで ${seconds}`;
      setActions(
        '<button id="vReveal" class="voice-main" type="button">札を見る</button>',
      );
      $("#vReveal").onclick = reveal;
      clearInterval(autoTimer);
      autoTimer = setInterval(() => {
        seconds -= 1;
        if (seconds > 0) {
          $("#voiceTimer").textContent = `札を出すまで ${seconds}`;
        } else {
          clearInterval(autoTimer);
          reveal();
        }
      }, 1000);
      return;
    }

    $("#voiceStep").textContent = "SELF CHECK";
    renderFuda(poem.lower);
    $("#voiceCue").textContent = "この札を見ないで言えましたか？";
    setActions(`
      <div class="voice-self">
        <button class="yes" data-rate="yes" type="button">◎ 言えた</button>
        <button class="maybe" data-rate="maybe" type="button">△ あやしい</button>
        <button class="no" data-rate="no" type="button">× 言えない</button>
      </div>`);
    document.querySelectorAll(".voice-self button").forEach((button) => {
      button.onclick = () => rate(button.dataset.rate);
    });
  }

  function reveal() {
    if (phase !== "recall") return;
    clearInterval(autoTimer);
    phase = "rate";
    renderPhase();
  }

  function rate(rating) {
    const poem = current.p;
    results[poem.key] = rating;
    if (
      (rating === "no" || rating === "maybe") &&
      !current.repeat &&
      !requeues[poem.key]
    ) {
      requeues[poem.key] = 1;
      queue.splice(
        Math.min(queue.length, index + (rating === "no" ? 3 : 4)),
        0,
        {
          p: poem,
          repeat: true,
          ordinal: current.ordinal,
        },
      );
    }
    index += 1;
    nextCard();
  }

  function finishVoice() {
    const keys = sessionCards.map((poem) => poem.key);
    const yes = keys.filter((key) => results[key] === "yes").length;
    const maybe = keys.filter((key) => results[key] === "maybe").length;
    const no = keys.length - yes - maybe;

    $("#voicePlay").hidden = true;
    $("#voiceSummary").classList.add("show");
    $("#voiceProgress").textContent = `${keys.length} / ${keys.length}`;
    $("#voiceSummaryMode").textContent = selectionLabel();
    $("#voiceBig").textContent = `${yes} / ${keys.length}`;
    $("#voiceStats").innerHTML = `
      <div class="voice-stat"><b>${yes}</b><span>言えた</span></div>
      <div class="voice-stat"><b>${maybe}</b><span>あやしい</span></div>
      <div class="voice-stat"><b>${no}</b><span>言えない</span></div>`;

    const review = $("#voiceReview");
    review.innerHTML = "";
    keys.forEach((key) => {
      const item = document.createElement("div");
      item.className = `voice-dot ${
        results[key] === "yes" ? "ok" : results[key] === "maybe" ? "mid" : "ng"
      }`;
      item.textContent = key;
      review.appendChild(item);
    });

    const hasNextGroup =
      selectedKind === "two" && selectedGroup < twoGroupCount() - 1;
    $("#voiceNextGroup").hidden = !hasNextGroup;
  }

  function init() {
    if (!window.QUESTION_POOL || !$("#startScreen")) {
      setTimeout(init, 100);
      return;
    }
    injectStyles();
    makePage();
    installEntry();
  }

  window.KarutaVoiceMode = {
    cardsForSelection,
    oneCards,
    twoCards,
  };
  init();
})();
