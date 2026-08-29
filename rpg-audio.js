(() => {
  "use strict";

  const DB_NAME = "karuta_local_audio_v1";
  const STORE = "tracks";
  const PREF = "karuta_audio_enabled_v1";
  let dbPromise = null;
  let currentUrl = null;
  let audio = null;
  let prepared = false;

  function enabled() {
    try {
      return localStorage.getItem(PREF) === "1";
    } catch (_error) {
      return false;
    }
  }

  function player() {
    if (audio) return audio;
    if (typeof Audio !== "function") return null;
    audio = new Audio();
    audio.preload = "auto";
    return audio;
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    if (typeof indexedDB === "undefined")
      return Promise.reject(new Error("IndexedDB is unavailable"));
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE, { keyPath: "n" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function getTrack(no) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(Number(no));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function countTracks() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORE).objectStore(STORE).count();
        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => reject(request.error);
      });
    } catch (_error) {
      return 0;
    }
  }

  function stop() {
    const active = player();
    try {
      active?.pause();
      if (active) active.currentTime = 0;
    } catch (_error) {
      // 再生前や未対応ブラウザでは何もしない。
    }
    if (currentUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    prepared = false;
  }

  async function prepare() {
    if (prepared || !enabled()) return;
    const active = player();
    if (!active || typeof URL.createObjectURL !== "function") return;
    try {
      const record = await getTrack(1);
      if (!record?.blob || prepared) return;
      currentUrl = URL.createObjectURL(record.blob);
      active.src = currentUrl;
      active.load();
      prepared = true;
    } catch (_error) {
      // 音源未登録なら文字読みだけで進行する。
    }
  }

  function unlock() {
    const active = player();
    if (!active) return;
    if (!prepared) prepare();
    try {
      const attempt = active.play();
      if (attempt?.then)
        attempt
          .then(() => {
            active.pause();
            active.currentTime = 0;
          })
          .catch(() => {});
    } catch (_error) {
      // ユーザー操作直後の準備なので、失敗しても文字読みへ継続する。
    }
  }

  async function playPoem(no) {
    if (!enabled()) return false;
    const active = player();
    if (!active || typeof URL.createObjectURL !== "function") return false;
    try {
      const record = await getTrack(no);
      if (!record?.blob) return false;
      stop();
      currentUrl = URL.createObjectURL(record.blob);
      active.src = currentUrl;
      active.currentTime = 0;
      await active.play();
      return true;
    } catch (error) {
      console.warn("百首異聞: 読手音声を再生できません", error);
      return false;
    }
  }

  async function status() {
    const count = await countTracks();
    return {
      enabled: enabled() && count > 0,
      count,
      label:
        enabled() && count > 0
          ? `読手音声 ON・${count}/100首`
          : count > 0
            ? `読手音声 OFF・${count}/100首`
            : "文字読み・音声はトレーニングで設定",
    };
  }

  window.HyakushuRpgAudio = {
    playPoem,
    stop,
    unlock,
    countTracks,
    status,
  };

  prepare();
})();
