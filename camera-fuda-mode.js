(() => {
  "use strict";

  if (window.KarutaCameraFudaMode) return;

  const $ = (selector) => document.querySelector(selector);
  const OCR_CDN =
    "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
  const JPN_CHARACTERS =
    "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんゐゑがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ";

  let page;
  let stream = null;
  let workerPromise = null;
  let worker = null;
  let labels = [];
  let activeLabelId = null;
  let manualPoint = null;
  let scanImageWidth = 0;
  let scanImageHeight = 0;
  let objectUrl = null;

  function poems() {
    return window.ALL_LOWER || [];
  }

  function upperPoems() {
    return (window.HYAKUSHU_IBUN_DATA || {}).upperPoems || [];
  }

  function normalize(text) {
    return String(text || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, (character) =>
        String.fromCharCode(character.charCodeAt(0) - 0x60),
      )
      .replace(/[ゔ]/g, "う")
      .replace(/[ゐ]/g, "い")
      .replace(/[ゑ]/g, "え")
      .replace(/[\s　・、。,.!?！？「」『』【】（）()]/g, "")
      .replace(/[^ぁ-ゖー]/g, "");
  }

  function levenshtein(left, right) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;
    let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      for (let col = 1; col <= right.length; col += 1) {
        current[col] = Math.min(
          current[col - 1] + 1,
          previous[col] + 1,
          previous[col - 1] + (left[row - 1] === right[col - 1] ? 0 : 1),
        );
      }
      previous = current;
    }
    return previous[right.length];
  }

  function bestDistance(text, target) {
    const source = normalize(text);
    const phrase = normalize(target);
    if (!source || !phrase) return { score: 0, distance: Infinity };
    let best = { score: 0, distance: Infinity };
    const minLength = Math.max(5, phrase.length - 5);
    const maxLength = Math.min(source.length, phrase.length + 5);
    for (let length = minLength; length <= maxLength; length += 1) {
      for (let start = 0; start + length <= source.length; start += 1) {
        const sample = source.slice(start, start + length);
        const distance = levenshtein(sample, phrase);
        const score = 1 - distance / Math.max(sample.length, phrase.length);
        if (score > best.score) best = { score, distance };
      }
    }
    return best;
  }

  function matchTextToPoem(text) {
    let match = null;
    poems().forEach((poem, index) => {
      const result = bestDistance(text, poem.lower);
      if (!match || result.score > match.score) {
        match = { number: index + 1, score: result.score, poem };
      }
    });
    return match && match.score >= 0.48 ? match : null;
  }

  function firstFive(number) {
    return [...(upperPoems()[number - 1] || "")].slice(0, 5).join("");
  }

  function injectStyles() {
    if ($("#cameraFudaStyles")) return;
    const style = document.createElement("style");
    style.id = "cameraFudaStyles";
    style.textContent = `
.camera-fuda-entry{width:100%;border:0;border-radius:13px;background:linear-gradient(135deg,#9b3244,#c74c5c);color:#fff;padding:14px 8px;font-size:16px;font-weight:900;margin-top:9px;box-shadow:0 5px 14px rgba(150,40,60,.16)}
.camera-fuda-page{min-height:calc(100dvh - 24px)}.camera-fuda-panel{background:rgba(255,255,255,.76);border-radius:18px;padding:14px 11px;min-height:calc(100dvh - 30px)}
.camera-fuda-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.camera-fuda-back{border:0;background:#fff;color:#5f5a52;border-radius:10px;padding:8px 11px;font-weight:800}.camera-fuda-title{text-align:center;font-size:21px;font-weight:900;margin:7px 0 3px}.camera-fuda-intro{text-align:center;color:#746f66;font-size:11px;line-height:1.6;margin:0 auto 10px;max-width:350px}
.camera-fuda-guide{background:#fff7f3;border-left:4px solid #bd3348;border-radius:9px;padding:8px 10px;color:#62534f;font-size:10px;line-height:1.55;margin:8px 0}.camera-fuda-guide b{color:#a22639}
.camera-fuda-video-wrap{position:relative;width:100%;min-height:260px;max-height:62dvh;background:#151515;border-radius:14px;overflow:hidden;display:grid;place-items:center;touch-action:manipulation}.camera-fuda-video-wrap video,.camera-fuda-video-wrap canvas{display:block;width:100%;height:auto;max-height:62dvh;object-fit:contain}.camera-fuda-video-wrap canvas{display:none}.camera-fuda-video-wrap.still canvas{display:block}.camera-fuda-video-wrap.still video{display:none}.camera-fuda-overlay{position:absolute;inset:0;overflow:hidden;pointer-events:none}.camera-fuda-overlay.manual{pointer-events:auto;cursor:crosshair}.camera-fuda-label{position:absolute;transform:translate(-50%,-112%);pointer-events:auto;display:flex;align-items:center;gap:1px;border:2px solid #b40d2a;border-radius:5px;background:rgba(255,255,255,.92);color:#a8001f;padding:1px 3px;font-family:"Yu Mincho","Hiragino Mincho ProN",serif;font-weight:1000;font-size:clamp(12px,3.8vw,19px);line-height:1.2;white-space:nowrap;text-shadow:0 1px #fff;box-shadow:0 1px 6px #0005;cursor:pointer}.camera-fuda-label.low-confidence{border-style:dashed}.camera-fuda-remove{border:0;background:transparent;color:#a8001f;font-family:system-ui,sans-serif;font-size:12px;font-weight:900;padding:0 2px;line-height:1}
.camera-fuda-controls{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.camera-fuda-controls button,.camera-fuda-controls label{display:grid;place-items:center;min-height:43px;border:1px solid #d7d0c5;border-radius:11px;background:#fff;color:#5f5a52;padding:8px 5px;font-size:11px;font-weight:900;text-align:center}.camera-fuda-controls .camera-capture,.camera-fuda-controls .camera-scan{background:#a62c42;color:#fff;border-color:#a62c42}.camera-fuda-controls .camera-scan{background:#315f42;border-color:#315f42}.camera-fuda-controls .camera-fallback{grid-column:1/-1}.camera-fuda-controls input{display:none}.camera-fuda-controls button:disabled{opacity:.4}.camera-fuda-status{min-height:22px;text-align:center;color:#746f66;font-size:10px;line-height:1.5;margin:7px 0}.camera-fuda-status.error{color:#b42339}.camera-fuda-results{display:flex;justify-content:space-between;align-items:center;color:#5f5a52;font-size:10px;font-weight:800;margin-top:8px}.camera-fuda-empty{text-align:center;color:#857e73;font-size:10px;padding:8px}
.camera-fuda-picker{position:fixed;inset:0;z-index:120;background:#0009;display:none;align-items:flex-end;justify-content:center}.camera-fuda-picker.show{display:flex}.camera-fuda-picker-panel{width:min(430px,100%);height:min(76dvh,650px);background:#fbf8f1;border-radius:20px 20px 0 0;padding:12px;display:flex;flex-direction:column}.camera-fuda-picker-head{display:flex;justify-content:space-between;align-items:center;font-weight:900}.camera-fuda-picker-head button{border:0;border-radius:50%;width:34px;height:34px;background:#eae4d9;font-size:19px}.camera-fuda-search{border:1px solid #d7d0c5;border-radius:11px;background:#fff;padding:12px;margin:8px 0;font-size:14px}.camera-fuda-poem-list{overflow:auto;display:grid;gap:5px}.camera-fuda-poem-option{display:grid;grid-template-columns:34px 1fr;gap:8px;align-items:center;border:1px solid #e1d9cd;border-radius:10px;background:#fff;text-align:left;padding:9px;color:#393630}.camera-fuda-poem-option small{display:block;color:#9e2e41;font-weight:900}.camera-fuda-poem-option span{font-family:"Yu Mincho",serif;font-size:12px;line-height:1.5}.camera-fuda-no-result{font-size:11px;color:#746f66;padding:12px;text-align:center}
.camera-fuda-loading{position:absolute;inset:0;background:#181818d9;color:white;display:none;place-items:center;text-align:center;padding:24px;font-size:13px;font-weight:900;line-height:1.65}.camera-fuda-loading.show{display:grid}.camera-fuda-footer{font-size:9px;line-height:1.55;color:#827a70;margin-top:8px}
`;
    document.head.appendChild(style);
  }

  function makePage() {
    page = $("#cameraFudaScreen");
    if (page) return;
    page = document.createElement("section");
    page.id = "cameraFudaScreen";
    page.className = "page camera-fuda-page";
    page.innerHTML = `
      <div class="camera-fuda-panel">
        <div class="camera-fuda-top">
          <button id="cameraFudaBack" class="camera-fuda-back" type="button">← 戻る</button>
          <span id="cameraFudaCount" class="progress"></span>
        </div>
        <div class="camera-fuda-title">札並びカメラ</div>
        <div class="camera-fuda-intro">札を撮影すると、下の句を端末内で読み取り、対応する上の句の先頭5文字を赤字で札の上に重ねます。</div>
        <div class="camera-fuda-guide"><b>コツ：</b>札が重ならないよう真上から撮影し、文字にピントを合わせてください。読み取りに失敗した札は、写真上をタップして手動で追加できます。</div>
        <div id="cameraFudaFrame" class="camera-fuda-video-wrap">
          <video id="cameraFudaVideo" autoplay muted playsinline></video>
          <canvas id="cameraFudaCanvas"></canvas>
          <div id="cameraFudaOverlay" class="camera-fuda-overlay"></div>
          <div id="cameraFudaLoading" class="camera-fuda-loading"></div>
        </div>
        <div id="cameraFudaStatus" class="camera-fuda-status" aria-live="polite">カメラを起動してください。初回はカメラ使用の許可が必要です。</div>
        <div class="camera-fuda-controls">
          <button id="cameraFudaStart" type="button" class="camera-capture">カメラを起動</button>
          <button id="cameraFudaCapture" type="button" class="camera-capture" disabled>撮影</button>
          <button id="cameraFudaScan" type="button" class="camera-scan" disabled>札を読み取る</button>
          <button id="cameraFudaManual" type="button" disabled>札を手動追加</button>
          <button id="cameraFudaRetake" type="button" disabled>撮り直す</button>
          <label class="camera-fallback camera-fallback">写真を選ぶ／撮影<input id="cameraFudaFile" type="file" accept="image/*" capture="environment"></label>
        </div>
        <div class="camera-fuda-results"><span id="cameraFudaResultText">まだ札を読み取っていません</span><span id="cameraFudaConfidence"></span></div>
        <div class="camera-fuda-footer">写真と読み取った文字はこの端末内で処理し、サーバーへ送信しません。初回のみOCRエンジンと言語データをCDNから読み込みます。赤いラベルをタップすると札の対応を修正できます。</div>
      </div>
      <div id="cameraFudaPicker" class="camera-fuda-picker" role="dialog" aria-modal="true" aria-label="札を選ぶ">
        <div class="camera-fuda-picker-panel">
          <div class="camera-fuda-picker-head"><span>この札の歌を選ぶ</span><button id="cameraFudaPickerClose" type="button" aria-label="閉じる">×</button></div>
          <input id="cameraFudaSearch" class="camera-fuda-search" type="search" placeholder="下の句・歌番号で検索" autocomplete="off">
          <div id="cameraFudaPoemList" class="camera-fuda-poem-list"></div>
        </div>
      </div>`;
    document.querySelector(".app").appendChild(page);

    $("#cameraFudaBack").onclick = exitMode;
    $("#cameraFudaStart").onclick = startCamera;
    $("#cameraFudaCapture").onclick = captureFrame;
    $("#cameraFudaScan").onclick = scanCards;
    $("#cameraFudaManual").onclick = beginManualPlacement;
    $("#cameraFudaRetake").onclick = () => {
      resetCapture();
      startCamera();
    };
    $("#cameraFudaFile").onchange = loadImageFile;
    $("#cameraFudaOverlay").addEventListener("click", placeManualLabel);
    $("#cameraFudaPickerClose").onclick = closePicker;
    $("#cameraFudaPicker").addEventListener("click", (event) => {
      if (event.target === $("#cameraFudaPicker")) closePicker();
    });
    $("#cameraFudaSearch").addEventListener("input", renderPoemOptions);
  }

  function installEntry() {
    const panel = $("#startScreen .panel");
    if (!panel || $("#cameraFudaEntry")) return;
    const button = document.createElement("button");
    button.id = "cameraFudaEntry";
    button.className = "camera-fuda-entry";
    button.type = "button";
    button.textContent = "📸 札並びをカメラで読み取る";
    const dashboard = $("#dashBtn");
    dashboard
      ? panel.insertBefore(button, dashboard)
      : panel.appendChild(button);
    button.onclick = showCameraPage;
  }

  function showPage() {
    document
      .querySelectorAll(".page, .voice-page")
      .forEach((element) => element.classList.remove("active"));
    page.classList.add("active");
  }

  function setStatus(text, error = false) {
    const status = $("#cameraFudaStatus");
    status.textContent = text;
    status.classList.toggle("error", error);
  }

  async function showCameraPage() {
    showPage();
    $("#cameraFudaCount").textContent = "";
    setStatus("カメラを起動してください。初回はカメラ使用の許可が必要です。");
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus(
        "このブラウザではカメラを起動できません。下の「写真を選ぶ／撮影」を使ってください。",
        true,
      );
      return;
    }
    stopStream();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      const video = $("#cameraFudaVideo");
      video.srcObject = stream;
      await video.play();
      if (video.videoWidth && video.videoHeight) {
        setFrameAspect(video.videoWidth, video.videoHeight);
      } else {
        video.addEventListener(
          "loadedmetadata",
          () => {
            setFrameAspect(video.videoWidth, video.videoHeight);
          },
          { once: true },
        );
      }
      $("#cameraFudaFrame").classList.remove("still");
      $("#cameraFudaCapture").disabled = false;
      $("#cameraFudaScan").disabled = true;
      $("#cameraFudaManual").disabled = true;
      $("#cameraFudaRetake").disabled = true;
      setStatus("札全体を画面に入れ、文字にピントを合わせて撮影してください。");
    } catch (error) {
      setStatus(
        "カメラを使えませんでした。ブラウザのカメラ許可を確認するか、写真を選んでください。",
        true,
      );
    }
  }

  function setFrameAspect(width, height) {
    if (!width || !height) return;
    $("#cameraFudaFrame").style.aspectRatio = `${width} / ${height}`;
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    const video = $("#cameraFudaVideo");
    if (video) video.srcObject = null;
  }

  function prepareCapturedImage(width, height) {
    scanImageWidth = width;
    scanImageHeight = height;
    const canvas = $("#cameraFudaCanvas");
    canvas.width = width;
    canvas.height = height;
    setFrameAspect(width, height);
    $("#cameraFudaFrame").classList.add("still");
    $("#cameraFudaCapture").disabled = true;
    $("#cameraFudaScan").disabled = false;
    $("#cameraFudaManual").disabled = false;
    $("#cameraFudaRetake").disabled = false;
    $("#cameraFudaResultText").textContent =
      "撮影できました。札を読み取ってください。";
    drawLabels();
  }

  function captureFrame() {
    const video = $("#cameraFudaVideo");
    if (!video.videoWidth || !video.videoHeight) {
      setStatus("カメラの準備中です。少し待ってから撮影してください。", true);
      return;
    }
    const canvas = $("#cameraFudaCanvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    labels = [];
    prepareCapturedImage(canvas.width, canvas.height);
    stopStream();
    setStatus("写真を撮りました。続けて「札を読み取る」を押してください。");
  }

  function loadImageFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    stopStream();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxSide = 2600;
      const scale = Math.min(
        1,
        maxSide / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = $("#cameraFudaCanvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      labels = [];
      prepareCapturedImage(canvas.width, canvas.height);
      setStatus("写真を読み込みました。「札を読み取る」を押してください。");
    };
    image.onerror = () =>
      setStatus("画像を開けませんでした。別の写真を選んでください。", true);
    image.src = objectUrl;
  }

  function resetCapture() {
    labels = [];
    manualPoint = null;
    $("#cameraFudaOverlay").classList.remove("manual");
    $("#cameraFudaFrame").classList.remove("still");
    $("#cameraFudaCanvas").style.removeProperty("display");
    $("#cameraFudaVideo").style.removeProperty("display");
    $("#cameraFudaCapture").disabled = true;
    $("#cameraFudaScan").disabled = true;
    $("#cameraFudaManual").disabled = true;
    $("#cameraFudaRetake").disabled = true;
    $("#cameraFudaResultText").textContent = "まだ札を読み取っていません";
    $("#cameraFudaConfidence").textContent = "";
    $("#cameraFudaOverlay").innerHTML = "";
    setStatus("もう一度カメラを起動するか、写真を選んでください。");
  }

  async function loadOcr() {
    if (window.Tesseract) return window.Tesseract;
    const existing = document.querySelector('script[data-camera-ocr="true"]');
    if (existing) {
      await new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
      if (window.Tesseract) return window.Tesseract;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = OCR_CDN;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.cameraOcr = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("OCRライブラリを読み込めません"));
      document.head.appendChild(script);
    });
    if (!window.Tesseract) throw new Error("OCRライブラリを初期化できません");
    return window.Tesseract;
  }

  async function getWorker() {
    if (worker) return worker;
    if (!workerPromise) {
      workerPromise = loadOcr().then((tesseract) =>
        tesseract
          .createWorker("jpn_vert", 1, {
            logger: (message) => {
              if (!page || !page.classList.contains("active")) return;
              const progress = Math.round((message.progress || 0) * 100);
              if (message.status === "loading tesseract core") {
                setLoading(`OCRを準備中… ${progress}%`);
              } else if (message.status === "loading language traineddata") {
                setLoading(`日本語の縦書きデータを準備中… ${progress}%`);
              } else if (message.status) {
                setLoading(`札を読み取り中… ${progress}%`);
              }
            },
          })
          .then(async (result) => {
            const tesseract = window.Tesseract;
            await result.setParameters({
              tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT,
              tessedit_char_whitelist: JPN_CHARACTERS,
            });
            worker = result;
            return result;
          }),
      );
    }
    return workerPromise;
  }

  function setLoading(message) {
    const loading = $("#cameraFudaLoading");
    loading.textContent = message;
    loading.classList.add("show");
  }

  function hideLoading() {
    $("#cameraFudaLoading").classList.remove("show");
  }

  function collectBlocks(data) {
    const output = [];
    (data.blocks || []).forEach((block) => {
      const text = block.text || "";
      if (normalize(text).length < 4 || !block.bbox) return;
      output.push({
        text,
        bbox: block.bbox,
        confidence: Number(block.confidence) || 0,
      });
    });
    return output;
  }

  async function scanCards() {
    const canvas = $("#cameraFudaCanvas");
    if (!canvas.width || !canvas.height) return;
    labels = [];
    drawLabels();
    $("#cameraFudaScan").disabled = true;
    setLoading(
      "日本語の札を端末内で解析しています…<br>写真は外部へ送信されません",
    );
    setStatus("札の文字を読み取っています。");
    try {
      const ocr = await getWorker();
      const result = await ocr.recognize(canvas, {}, { blocks: true });
      const blocks = collectBlocks(result.data || {});
      const matched = new Map();
      blocks.forEach((block) => {
        const match = matchTextToPoem(block.text);
        if (!match) return;
        const existing = matched.get(match.number);
        if (!existing || match.score > existing.score) {
          matched.set(match.number, {
            id: `ocr-${match.number}`,
            number: match.number,
            score: match.score,
            bbox: block.bbox,
          });
        }
      });
      labels = [...matched.values()];
      drawLabels();
      const confident = labels.filter((label) => label.score >= 0.68).length;
      $("#cameraFudaResultText").textContent = `${labels.length}枚を検出`;
      $("#cameraFudaConfidence").textContent = labels.length
        ? `確度高 ${confident}枚・赤札をタップして修正`
        : "検出なし";
      if (labels.length) {
        setStatus(
          `読み取りました。札の上の赤い文字をタップすると対応する歌を直せます。認識が難しい札は「札を手動追加」を使ってください。`,
        );
      } else {
        setStatus(
          "札を自動認識できませんでした。真上から撮り直すか、写真上でカードを手動追加してください。",
          true,
        );
      }
    } catch (error) {
      setStatus(
        `OCRを起動できませんでした（${error.message || "通信またはブラウザ設定"}）。写真上で札を手動追加できます。`,
        true,
      );
    } finally {
      hideLoading();
      $("#cameraFudaScan").disabled = false;
    }
  }

  function drawLabels() {
    const overlay = $("#cameraFudaOverlay");
    overlay.innerHTML = "";
    $("#cameraFudaCount").textContent = labels.length
      ? `${labels.length}枚`
      : "";
    labels.forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `camera-fuda-label${label.score < 0.62 ? " low-confidence" : ""}`;
      const bbox = label.bbox || {
        x0: label.x * scanImageWidth,
        y0: label.y * scanImageHeight,
        x1: label.x * scanImageWidth,
        y1: label.y * scanImageHeight,
      };
      const x = (bbox.x0 + bbox.x1) / 2 / scanImageWidth;
      const y = bbox.y0 / scanImageHeight;
      button.style.left = `${(Math.min(0.98, Math.max(0.02, x)) * 100).toFixed(3)}%`;
      button.style.top = `${(Math.min(0.96, Math.max(0.08, y)) * 100).toFixed(3)}%`;
      button.innerHTML = `<span>${label.number ? escapeHtml(firstFive(label.number)) : "札を選ぶ"}</span>`;
      button.title = label.number
        ? `歌番号${label.number}・確度${Math.round(label.score * 100)}%・タップして修正`
        : "タップして札を選択";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openPicker(label.id);
      });
      const remove = document.createElement("span");
      remove.className = "camera-fuda-remove";
      remove.textContent = "×";
      remove.setAttribute("role", "button");
      remove.setAttribute("aria-label", "ラベルを削除");
      remove.onclick = (event) => {
        event.stopPropagation();
        labels = labels.filter((item) => item.id !== label.id);
        drawLabels();
      };
      button.appendChild(remove);
      overlay.appendChild(button);
    });
  }

  function escapeHtml(text) {
    const element = document.createElement("span");
    element.textContent = String(text || "");
    return element.innerHTML;
  }

  function beginManualPlacement() {
    manualPoint = null;
    $("#cameraFudaOverlay").classList.add("manual");
    setStatus("ラベルを置きたい札の上端あたりを写真上でタップしてください。");
  }

  function placeManualLabel(event) {
    if (!$("#cameraFudaOverlay").classList.contains("manual")) return;
    const rect = $("#cameraFudaOverlay").getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    manualPoint = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
    const id = `manual-${Date.now()}`;
    labels.push({
      id,
      number: null,
      score: 1,
      x: manualPoint.x,
      y: manualPoint.y,
    });
    activeLabelId = id;
    $("#cameraFudaOverlay").classList.remove("manual");
    drawLabels();
    openPicker(id);
  }

  function openPicker(labelId) {
    activeLabelId = labelId;
    const label = labels.find((item) => item.id === labelId);
    const search = $("#cameraFudaSearch");
    const poem = label && label.number ? poems()[label.number - 1] : null;
    search.value = poem ? poem.lower : "";
    $("#cameraFudaPicker").classList.add("show");
    renderPoemOptions();
    search.focus();
    if (poem) search.select();
  }

  function closePicker() {
    $("#cameraFudaPicker").classList.remove("show");
    activeLabelId = null;
  }

  function renderPoemOptions() {
    const query = normalize($("#cameraFudaSearch").value);
    const list = $("#cameraFudaPoemList");
    const results = poems()
      .map((poem, index) => ({ poem, number: index + 1 }))
      .filter(({ poem, number }) => {
        if (!query) return true;
        return (
          String(number).includes(query) ||
          normalize(poem.lower).includes(query)
        );
      })
      .slice(0, 40);
    list.innerHTML = "";
    if (!results.length) {
      list.innerHTML =
        '<div class="camera-fuda-no-result">候補がありません</div>';
      return;
    }
    results.forEach(({ poem, number }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "camera-fuda-poem-option";
      button.innerHTML = `<small>${number}番<br>${escapeHtml(firstFive(number))}</small><span>${escapeHtml(poem.lower)}</span>`;
      button.onclick = () => selectPoem(number);
      list.appendChild(button);
    });
  }

  function selectPoem(number) {
    const label = labels.find((item) => item.id === activeLabelId);
    if (!label) return;
    label.number = number;
    label.score = 1;
    drawLabels();
    closePicker();
    $("#cameraFudaResultText").textContent = `${labels.length}枚を表示中`;
    $("#cameraFudaConfidence").textContent =
      "赤いラベルは札の上に重ねてあります";
  }

  function exitMode() {
    stopStream();
    if (worker) {
      worker.terminate().catch(() => {});
      worker = null;
      workerPromise = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    page.classList.remove("active");
    $("#startScreen").classList.add("active");
  }

  function init() {
    if (!poems().length || !upperPoems().length || !$("#startScreen")) {
      setTimeout(init, 100);
      return;
    }
    injectStyles();
    makePage();
    installEntry();
  }

  window.KarutaCameraFudaMode = {
    firstFive,
    matchTextToPoem,
    normalize,
  };
  init();
})();
