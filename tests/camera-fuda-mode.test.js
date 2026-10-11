const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const dom = new JSDOM(
  `<!doctype html><html><head></head><body>
    <main class="app">
      <section id="startScreen" class="page active"><div class="panel"><button id="dashBtn">成績</button></div></section>
    </main>
  </body></html>`,
  { runScripts: "dangerously", url: "https://example.test/" },
);
const { window } = dom;
const document = window.document;
let recognizeCalls = 0;
let forceFallback = false;
let currentPsm = "11";

window.URL.createObjectURL = () => "blob:test-photo";
window.URL.revokeObjectURL = () => {};
window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
window.Image = class {
  naturalWidth = 1000;
  naturalHeight = 700;
  set src(_value) {
    this.onload();
  }
};

window.Tesseract = {
  PSM: { AUTO: "3", SPARSE_TEXT: "11" },
  createWorker: async (language, count, options) => {
    assert.strictEqual(
      language,
      "jpn_vert",
      "vertical Japanese OCR is selected",
    );
    assert.strictEqual(count, 1, "one local worker is enough for one photo");
    assert.strictEqual(typeof options.logger, "function");
    return {
      setParameters: async (parameters) => {
        if (parameters.tessedit_pageseg_mode) {
          currentPsm = parameters.tessedit_pageseg_mode;
        }
        if (parameters.tessedit_char_whitelist) {
          assert.match(parameters.tessedit_char_whitelist, /あ/);
        }
      },
      recognize: async (ocrCanvas, _options, output) => {
        recognizeCalls += 1;
        if (recognizeCalls === 1) {
          assert.strictEqual(
            ocrCanvas.width,
            1800,
            "photo is enlarged for OCR",
          );
        }
        assert.strictEqual(
          output.blocks,
          true,
          "OCR returns positioned text blocks",
        );
        if (forceFallback && recognizeCalls === 2) {
          return { data: { blocks: [] } };
        }
        return {
          data: {
            blocks: [
              {
                text: "からくれなゐに",
                confidence: 91,
                bbox: { x0: 288, y0: 216, x1: 756, y1: 1062 },
              },
            ],
          },
        };
      },
      terminate: async () => {},
    };
  },
};

window.eval(fs.readFileSync(path.join(root, "data.js"), "utf8"));
window.eval(fs.readFileSync(path.join(root, "rpg-data.js"), "utf8"));
window.eval(fs.readFileSync(path.join(root, "camera-fuda-mode.js"), "utf8"));

function click(selector) {
  const element = document.querySelector(selector);
  assert(element, `Missing element: ${selector}`);
  element.click();
  return element;
}

function tick(milliseconds = 0) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

(async () => {
  assert(
    document.querySelector("#cameraFudaEntry"),
    "camera mode entry is added",
  );
  assert.strictEqual(
    window.KarutaCameraFudaMode.firstFive(17),
    "ちはやぶる",
    "label text is the first five upper-poem characters",
  );
  assert.strictEqual(
    window.KarutaCameraFudaMode.matchTextToPoem("からくれなゐにみつくくるとは")
      .number,
    17,
    "OCR text maps to the matching karuta",
  );
  assert.strictEqual(
    window.KarutaCameraFudaMode.matchTextToPoem("からくれなゐに")?.number,
    17,
    "one vertical text column can match even when OCR splits the poem",
  );
  assert.strictEqual(
    window.KarutaCameraFudaMode.matchTextToPoem("からくれ")?.number,
    17,
    "a unique four-character OCR fragment can still identify its card",
  );
  assert.strictEqual(
    window.KarutaCameraFudaMode.matchTextToPoem("ほとんど関係ない文字列"),
    null,
    "unrelated text is rejected instead of labeling the wrong card",
  );

  click("#cameraFudaEntry");
  assert(
    document.querySelector("#cameraFudaScreen").classList.contains("active"),
  );
  const fileInput = document.querySelector("#cameraFudaFile");
  Object.defineProperty(fileInput, "files", {
    configurable: true,
    value: [new window.File(["photo"], "karuta.jpg", { type: "image/jpeg" })],
  });
  fileInput.dispatchEvent(new window.Event("change"));
  assert.strictEqual(document.querySelector("#cameraFudaCanvas").width, 1000);
  assert.strictEqual(document.querySelector("#cameraFudaCanvas").height, 700);
  click("#cameraFudaScan");
  await tick();

  assert.strictEqual(
    recognizeCalls,
    1,
    "photo is analyzed by the local OCR worker",
  );
  assert.strictEqual(
    document.querySelector("#cameraFudaDebug").hidden,
    false,
    "raw OCR text is available to diagnose a miss",
  );
  assert.match(
    document.querySelector("#cameraFudaResultText").textContent,
    /1枚/,
  );
  const label = document.querySelector(".camera-fuda-label");
  assert(label, "recognized poem receives an on-image overlay");
  assert.match(label.textContent, /ちはや/);
  assert.match(
    label.style.left,
    /^29/,
    "label is anchored to OCR card position",
  );
  assert.match(label.style.top, /^17\.143/, "label sits above detected text");

  click(".camera-fuda-label");
  assert(
    document.querySelector("#cameraFudaPicker").classList.contains("show"),
    "a recognized label opens the correction picker",
  );
  document.querySelector("#cameraFudaSearch").value = "つらぬき";
  document
    .querySelector("#cameraFudaSearch")
    .dispatchEvent(new window.Event("input"));
  click(".camera-fuda-poem-option");
  assert.match(
    document.querySelector(".camera-fuda-label").textContent,
    /しらつゆに/,
    "the on-image label can be corrected to another poem",
  );

  document.querySelector("#cameraFudaOverlay").getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 1000,
    height: 700,
  });
  click("#cameraFudaManual");
  document.querySelector("#cameraFudaOverlay").dispatchEvent(
    new window.MouseEvent("click", {
      bubbles: true,
      clientX: 800,
      clientY: 150,
    }),
  );
  assert(
    document.querySelector("#cameraFudaPicker").classList.contains("show"),
    "manual placement opens the poem picker",
  );
  document.querySelector("#cameraFudaSearch").value = "";
  document
    .querySelector("#cameraFudaSearch")
    .dispatchEvent(new window.Event("input"));
  document.querySelectorAll(".camera-fuda-poem-option")[16].click();
  assert.strictEqual(
    document.querySelectorAll(".camera-fuda-label").length,
    2,
    "manual placement adds a second label to the photograph",
  );

  forceFallback = true;
  click("#cameraFudaScan");
  await tick();
  assert.strictEqual(recognizeCalls, 3, "failed sparse OCR retries the photo");
  assert.strictEqual(currentPsm, "11", "sparse OCR settings are restored");
  assert.match(
    document.querySelector("#cameraFudaResultText").textContent,
    /1枚/,
    "automatic-segmentation retry can recover a missed card",
  );

  click("#cameraFudaBack");
  assert(document.querySelector("#startScreen").classList.contains("active"));
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(indexHtml, /camera-fuda-mode\.js/);
  assert.match(indexHtml, /rpg-data\.js/);

  dom.window.close();
  console.log("camera-fuda-mode.test.js: all assertions passed");
})().catch((error) => {
  dom.window.close();
  console.error(error);
  process.exitCode = 1;
});
