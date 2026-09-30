(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ALPHATAB_BASE = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.4/dist/";
  const DB_NAME = "dt-music-trainer-pro";
  const DB_VERSION = 1;
  const SONG_STORE = "songs";
  const MANIFEST_NAME = "dt-music-trainer-pro.json";
  const INTERACTIVE_EXTS = new Set(["gp","gpx","gp3","gp4","gp5","gp6","gp7","gp8","musicxml","mxl","xml"]);
  const AUDIO_EXTS = new Set(["mp3","wav"]);

  const el = {
    status: $("statusPill"),
    search: $("librarySearch"),
    addFiles: $("addFilesBtn"),
    fileInput: $("libraryFileInput"),
    selectedFileInput: $("selectedAssetInput"),
    dropzone: $("libraryDropzone"),
    newSong: $("newSongBtn"),
    saveLibrary: $("saveLibraryBtn"),
    loadLibrary: $("loadLibraryBtn"),
    backupInput: $("backupInput"),
    songList: $("songList"),
    selectedTitle: $("selectedTitle"),
    selectedMeta: $("selectedMeta"),
    renameSong: $("renameSongBtn"),
    deleteSong: $("deleteSongBtn"),
    attachSelected: $("attachSelectedBtn"),
    interactiveAsset: $("interactiveAsset"),
    pdfAsset: $("pdfAsset"),
    audioAsset: $("audioAsset"),
    songTitle: $("scoreSongTitle"),
    songArtist: $("scoreSongArtist"),
    songMeta: $("scoreSongMeta"),
    tracks: $("trackList"),
    viewport: $("scoreViewport"),
    empty: $("emptyState"),
    emptyTitle: $("emptyTitle"),
    emptyText: $("emptyText"),
    loading: $("loading"),
    alpha: $("alphaTab"),
    openInteractive: $("openInteractiveBtn"),
    openPdf: $("openPdfBtn"),
    playAudio: $("playAudioBtn"),
    sample: $("sampleBtn"),
    viewerTitle: $("viewerTitle"),
    viewerMeta: $("viewerMeta"),
    stop: $("stopBtn"),
    play: $("playBtn"),
    countIn: $("countInBtn"),
    metro: $("metroBtn"),
    loop: $("loopBtn"),
    speed: $("speed"),
    speedValue: $("speedValue"),
    zoom: $("zoom"),
    zoomValue: $("zoomValue"),
    position: $("position"),
    loopStart: $("loopStart"),
    loopEnd: $("loopEnd"),
    applyLoop: $("applyLoop"),
    clearLoop: $("clearLoop"),
    loopStatus: $("loopStatus"),
    audio: $("backingAudio"),
    audioTitle: $("audioTitle"),
    audioStop: $("audioStopBtn"),
    toast: $("toast")
  };

  let db = null;
  let songsCache = [];
  let selectedSongId = localStorage.getItem("dtmtp-selected-song") || "";
  let activeInteractiveSongId = "";
  let currentFilename = "";
  let playerReady = false;
  let scorePlaying = false;
  let backingUrl = "";
  let toastTimer = null;

  function setStatus(text, tone) {
    el.status.textContent = text;
    el.status.title = text;
    el.status.classList.remove("ok", "warn");
    if (tone) el.status.classList.add(tone);
  }

  function toast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.style.display = "block";
    toastTimer = setTimeout(() => {
      el.toast.style.display = "none";
    }, 3200);
  }

  function extension(name) {
    const m = String(name || "").toLowerCase().match(/\.([^.]+)$/);
    return m ? m[1] : "";
  }

  function classifyFile(file) {
    const ext = extension(file && file.name);
    if (INTERACTIVE_EXTS.has(ext)) return "interactive";
    if (ext === "pdf" || (file && file.type === "application/pdf")) return "pdf";
    if (AUDIO_EXTS.has(ext) || (file && /^audio\/(mpeg|wav|x-wav)$/i.test(file.type || ""))) return "audio";
    return "";
  }

  function titleFromFileName(name) {
    let stem = String(name || "").replace(/\.[^.]+$/, "");
    stem = stem
      .replace(/\([^)]*(backing|track|score|tab|musicxml|guitar|audio|instrumental|practice|full\s*mix)[^)]*\)/ig, " ")
      .replace(/\[[^\]]*(backing|track|score|tab|musicxml|guitar|audio|instrumental|practice|full\s*mix)[^\]]*\]/ig, " ")
      .replace(/\b(backing\s*track|practice\s*track|instrumental|musicxml|audio|full\s*mix|score|tab)\b/ig, " ")
      .replace(/\s+[-–—]\s+(guitar|bass|drums?|keys?|piano|vocals?)\s*$/ig, " ")
      .replace(/[_]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
      .trim();
    return stem || "Untitled Song";
  }

  function normalizeTitle(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function makeId() {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "song-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  function makeAsset(file) {
    return {
      name: file.name,
      mime: file.type || "",
      size: file.size || 0,
      blob: file,
      updatedAt: Date.now()
    };
  }

  function fmtBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function fmt(ms) {
    if (!Number.isFinite(ms) || ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function assetLabel(kind) {
    if (kind === "interactive") return "Interactive Score";
    if (kind === "pdf") return "PDF Score";
    return "Backing Track";
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(SONG_STORE)) {
          database.createObjectStore(SONG_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function idbRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function allSongs() {
    const tx = db.transaction(SONG_STORE, "readonly");
    return await idbRequest(tx.objectStore(SONG_STORE).getAll());
  }

  async function getSong(id) {
    if (!id) return null;
    const tx = db.transaction(SONG_STORE, "readonly");
    return await idbRequest(tx.objectStore(SONG_STORE).get(id));
  }

  async function putSong(song) {
    song.updatedAt = Date.now();
    const tx = db.transaction(SONG_STORE, "readwrite");
    await idbRequest(tx.objectStore(SONG_STORE).put(song));
  }

  async function removeSong(id) {
    const tx = db.transaction(SONG_STORE, "readwrite");
    await idbRequest(tx.objectStore(SONG_STORE).delete(id));
  }

  async function clearSongs() {
    const tx = db.transaction(SONG_STORE, "readwrite");
    await idbRequest(tx.objectStore(SONG_STORE).clear());
  }

  async function refreshCache() {
    songsCache = await allSongs();
    songsCache.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    if (selectedSongId && !songsCache.some((s) => s.id === selectedSongId)) selectedSongId = "";
    if (!selectedSongId && songsCache.length) selectedSongId = songsCache[0].id;
    if (selectedSongId) localStorage.setItem("dtmtp-selected-song", selectedSongId);
    renderLibrary();
    renderSelectedSong();
  }

  function chipsForSong(song, holder) {
    [
      ["interactive", "Interactive"],
      ["pdf", "PDF"],
      ["audio", "Audio"]
    ].forEach(([key, label]) => {
      const chip = document.createElement("span");
      chip.className = "asset-chip" + (song[key] ? " on" : "");
      chip.textContent = label + (song[key] ? " ✓" : "");
      holder.appendChild(chip);
    });
  }

  function renderLibrary() {
    const q = normalizeTitle(el.search.value);
    const rows = songsCache.filter((song) => !q || normalizeTitle(song.title).includes(q));
    el.songList.innerHTML = "";

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-list";
      empty.textContent = songsCache.length ? "No songs match this search." : "Your library is empty. Add PDF, interactive score, MP3 or WAV files.";
      el.songList.appendChild(empty);
      return;
    }

    rows.forEach((song) => {
      const card = document.createElement("div");
      card.className = "song-card" + (song.id === selectedSongId ? " selected" : "");
      card.tabIndex = 0;

      const title = document.createElement("div");
      title.className = "song-card-title";
      title.textContent = song.title || "Untitled Song";

      const meta = document.createElement("div");
      meta.className = "song-card-meta";
      chipsForSong(song, meta);

      card.append(title, meta);
      card.onclick = () => selectSong(song.id);
      card.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectSong(song.id);
        }
      };
      el.songList.appendChild(card);
    });
  }

  function selectedSong() {
    return songsCache.find((song) => song.id === selectedSongId) || null;
  }

  function setAssetRow(container, kind, asset, icon) {
    container.innerHTML = "";

    const iconEl = document.createElement("div");
    iconEl.className = "asset-icon";
    iconEl.textContent = icon;

    const details = document.createElement("div");
    const name = document.createElement("div");
    name.className = "asset-name";
    name.textContent = asset ? asset.name : "Not attached";
    const type = document.createElement("div");
    type.className = "asset-kind";
    type.textContent = asset ? assetLabel(kind).toUpperCase() + " · " + fmtBytes(asset.size) : assetLabel(kind).toUpperCase();
    details.append(name, type);

    const actions = document.createElement("div");
    actions.className = "asset-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = kind === "audio" ? "Play" : "Open";
    open.disabled = !asset;
    open.onclick = (e) => {
      e.stopPropagation();
      if (kind === "interactive") openSelectedInteractive();
      else if (kind === "pdf") openSelectedPdf();
      else playSelectedAudio();
    };
    actions.appendChild(open);

    container.append(iconEl, details, actions);
  }

  function renderSelectedSong() {
    const song = selectedSong();
    const disabled = !song;
    el.renameSong.disabled = disabled;
    el.deleteSong.disabled = disabled;
    el.attachSelected.disabled = disabled;
    el.openInteractive.disabled = !song || !song.interactive;
    el.openPdf.disabled = !song || !song.pdf;
    el.playAudio.disabled = !song || !song.audio;

    if (!song) {
      el.selectedTitle.textContent = "No song selected";
      el.selectedMeta.textContent = "Add files or create a song.";
      setAssetRow(el.interactiveAsset, "interactive", null, "🎼");
      setAssetRow(el.pdfAsset, "pdf", null, "📄");
      setAssetRow(el.audioAsset, "audio", null, "🎧");
      el.viewerTitle.textContent = "No song selected";
      el.viewerMeta.textContent = "Choose a song from the library.";
      return;
    }

    el.selectedTitle.textContent = song.title;
    const count = ["interactive","pdf","audio"].filter((key) => song[key]).length;
    el.selectedMeta.textContent = count + " of 3 asset types attached";
    setAssetRow(el.interactiveAsset, "interactive", song.interactive, "🎼");
    setAssetRow(el.pdfAsset, "pdf", song.pdf, "📄");
    setAssetRow(el.audioAsset, "audio", song.audio, "🎧");
    el.viewerTitle.textContent = song.title;
    el.viewerMeta.textContent = [
      song.interactive ? "Interactive ✓" : "",
      song.pdf ? "PDF ✓" : "",
      song.audio ? "Audio ✓" : ""
    ].filter(Boolean).join(" · ") || "No files attached yet";
  }

  function showEmpty(title, text) {
    activeInteractiveSongId = "";
    el.alpha.style.display = "none";
    el.empty.style.display = "flex";
    el.emptyTitle.textContent = title || "Interactive Score";
    el.emptyText.textContent = text || "Choose a song with an interactive score.";
    el.tracks.innerHTML = '<div class="note">Open an interactive score to see its tracks.</div>';
    el.songTitle.textContent = "No interactive score loaded";
    el.songArtist.textContent = "—";
    el.songMeta.textContent = "Select a song and choose Open Interactive.";
    resetTransportState();
  }

  function selectSong(id) {
    if (selectedSongId === id) return;
    selectedSongId = id;
    localStorage.setItem("dtmtp-selected-song", id);
    renderLibrary();
    renderSelectedSong();
    stopBackingAudio();
    if (activeInteractiveSongId && activeInteractiveSongId !== id) {
      try { api.stop(); } catch (e) {}
      showEmpty("Ready for " + (selectedSong() ? selectedSong().title : "song"), "Press Open Interactive to load this song's Guitar Pro or MusicXML score.");
    }
  }

  async function addFilesToLibrary(fileList, forceSongId) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    let added = 0;
    let skipped = 0;
    const changed = new Set();

    let cache = await allSongs();
    const forceSong = forceSongId ? cache.find((s) => s.id === forceSongId) : null;

    for (const file of files) {
      const kind = classifyFile(file);
      if (!kind) {
        skipped++;
        continue;
      }

      let song = forceSong || null;
      if (!song) {
        const guessedTitle = titleFromFileName(file.name);
        const key = normalizeTitle(guessedTitle);
        song = cache.find((s) => normalizeTitle(s.title) === key) || null;
        if (!song) {
          song = {
            id: makeId(),
            title: guessedTitle,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            interactive: null,
            pdf: null,
            audio: null
          };
          cache.push(song);
        }
      }

      song[kind] = makeAsset(file);
      await putSong(song);
      changed.add(song.id);
      added++;
    }

    if (forceSong && changed.size) selectedSongId = forceSong.id;
    await refreshCache();
    setStatus(
      added + " file" + (added === 1 ? "" : "s") + " added to " + changed.size + " song" + (changed.size === 1 ? "" : "s") +
      (skipped ? " · " + skipped + " unsupported skipped" : ""),
      added ? "ok" : "warn"
    );
    toast(added ? "Library updated." : "No supported files were added.");
    el.fileInput.value = "";
    el.selectedFileInput.value = "";
  }

  async function createSong() {
    const title = prompt("Song title:");
    if (!title || !title.trim()) return;
    const song = {
      id: makeId(),
      title: title.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      interactive: null,
      pdf: null,
      audio: null
    };
    await putSong(song);
    selectedSongId = song.id;
    await refreshCache();
    setStatus("Created " + song.title, "ok");
  }

  async function renameSelectedSong() {
    const song = await getSong(selectedSongId);
    if (!song) return;
    const title = prompt("Rename song:", song.title);
    if (!title || !title.trim()) return;
    song.title = title.trim();
    await putSong(song);
    await refreshCache();
    setStatus("Song renamed.", "ok");
  }

  async function deleteSelectedSong() {
    const song = await getSong(selectedSongId);
    if (!song) return;
    if (!confirm('Delete "' + song.title + '" and its attached files from this device?')) return;
    if (activeInteractiveSongId === song.id) {
      try { api.stop(); } catch (e) {}
      showEmpty("Interactive Score", "Choose another song from the library.");
    }
    stopBackingAudio();
    await removeSong(song.id);
    selectedSongId = "";
    localStorage.removeItem("dtmtp-selected-song");
    await refreshCache();
    setStatus("Song deleted.", "ok");
  }

  async function openSelectedPdf() {
    const song = await getSong(selectedSongId);
    if (!song || !song.pdf || !song.pdf.blob) return;
    const url = URL.createObjectURL(song.pdf.blob);
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      setStatus("Pop-up blocked. Allow pop-ups to open PDFs.", "warn");
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function revokeBackingUrl() {
    if (backingUrl) {
      URL.revokeObjectURL(backingUrl);
      backingUrl = "";
    }
  }

  function stopBackingAudio() {
    el.audio.pause();
    el.audio.removeAttribute("src");
    el.audio.load();
    revokeBackingUrl();
    el.audioTitle.textContent = "No backing track loaded";
  }

  async function playSelectedAudio() {
    const song = await getSong(selectedSongId);
    if (!song || !song.audio || !song.audio.blob) return;
    if (scorePlaying) {
      try { api.playPause(); } catch (e) {}
    }
    stopBackingAudio();
    backingUrl = URL.createObjectURL(song.audio.blob);
    el.audio.src = backingUrl;
    el.audioTitle.textContent = song.audio.name;
    try {
      await el.audio.play();
      setStatus("Playing backing track · " + song.title, "ok");
    } catch (e) {
      setStatus("Backing track loaded. Press play in the audio controls.", "warn");
    }
  }

  function resetTransportState() {
    playerReady = false;
    [el.stop, el.play, el.countIn, el.metro, el.loop, el.speed, el.applyLoop, el.clearLoop]
      .forEach((node) => node.disabled = true);
    el.play.textContent = "▶";
    el.countIn.classList.remove("active");
    el.metro.classList.remove("active");
    el.loop.classList.remove("active");
    el.position.textContent = "00:00 / 00:00";
    el.loopStatus.textContent = "No loop range set.";
  }

  const api = new alphaTab.AlphaTabApi(el.alpha, {
    core: {
      fontDirectory: ALPHATAB_BASE + "font/",
      scriptFile: ALPHATAB_BASE + "alphaTab.min.js",
      useWorkers: true
    },
    display: {
      layoutMode: "page",
      scale: 1
    },
    player: {
      enablePlayer: true,
      enableUserInteraction: true,
      enableCursor: true,
      enableAnimatedBeatCursor: true,
      enableElementHighlighting: true,
      soundFont: ALPHATAB_BASE + "soundfont/sonivox.sf2",
      scrollElement: el.viewport,
      scrollMode: "offscreen",
      nativeBrowserSmoothScroll: true,
      scrollOffsetY: -24
    }
  });

  window.dtMusicTrainerProAlphaTab = api;

  function renderTrackButtons(score) {
    el.tracks.innerHTML = "";

    const all = document.createElement("button");
    all.type = "button";
    all.className = "track-btn";
    all.textContent = "All tracks";
    all.onclick = () => api.renderTracks(score.tracks.slice());
    el.tracks.appendChild(all);

    score.tracks.forEach((track, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "track-btn";
      btn.dataset.trackIndex = String(track.index);
      btn.textContent = (index + 1) + ". " + (track.name || ("Track " + (index + 1)));
      btn.onclick = () => api.renderTracks([track]);
      el.tracks.appendChild(btn);
    });
  }

  function markActiveTracks() {
    const active = new Set((api.tracks || []).map((track) => String(track.index)));
    const buttons = Array.from(el.tracks.querySelectorAll(".track-btn"));

    buttons.forEach((btn, index) => {
      if (index === 0) {
        const scoreCount = api.score ? api.score.tracks.length : 0;
        btn.classList.toggle("active", active.size === scoreCount && scoreCount > 1);
      } else {
        btn.classList.toggle("active", active.has(btn.dataset.trackIndex));
      }
    });
  }

  function firstBeatForBar(track, masterBarIndex, useLastBeat) {
    try {
      const stave = track.staves[0];
      const bar = stave.bars[masterBarIndex];
      const beats = [];
      bar.voices.forEach((voice) => voice.beats.forEach((beat) => beats.push(beat)));
      if (!beats.length) return null;
      return useLastBeat ? beats[beats.length - 1] : beats[0];
    } catch (e) {
      return null;
    }
  }

  function masterBarPlaybackStart(masterBar) {
    try {
      if (api.tickCache && typeof api.tickCache.getMasterBarStart === "function") {
        return api.tickCache.getMasterBarStart(masterBar);
      }
    } catch (e) {}
    return Number(masterBar.start) || 0;
  }

  function applyLoopRange() {
    if (!api.score || !api.score.masterBars || !api.score.masterBars.length) return;

    const total = api.score.masterBars.length;
    let startBar = Math.max(1, Math.min(total, parseInt(el.loopStart.value || "1", 10)));
    let endBar = Math.max(1, Math.min(total, parseInt(el.loopEnd.value || String(startBar), 10)));

    if (endBar < startBar) {
      const temp = startBar;
      startBar = endBar;
      endBar = temp;
    }

    el.loopStart.value = startBar;
    el.loopEnd.value = endBar;

    const bars = api.score.masterBars;
    const startMaster = bars[startBar - 1];
    const endMaster = bars[endBar - 1];
    const startTick = masterBarPlaybackStart(startMaster);
    let endTick = api.endTick;

    if (endBar < total) {
      endTick = masterBarPlaybackStart(bars[endBar]);
    } else if (!Number.isFinite(endTick) || endTick <= startTick) {
      const ownStart = Number(endMaster.start) || startTick;
      const approxNext = endMaster.nextMasterBar ? Number(endMaster.nextMasterBar.start) : NaN;
      endTick = Number.isFinite(approxNext) ? approxNext : ownStart + 3840;
    }

    api.playbackRange = { startTick, endTick };
    api.isLooping = true;
    el.loop.classList.add("active");
    el.loopStatus.textContent = "Looping bars " + startBar + "–" + endBar + ".";

    try {
      const track = api.tracks && api.tracks.length ? api.tracks[0] : api.score.tracks[0];
      const startBeat = firstBeatForBar(track, startBar - 1, false);
      const endBeat = firstBeatForBar(track, endBar - 1, true);
      if (startBeat && endBeat && typeof api.highlightPlaybackRange === "function") {
        api.highlightPlaybackRange(startBeat, endBeat);
      }
    } catch (e) {}
  }

  function clearLoopRange() {
    api.playbackRange = null;
    api.isLooping = false;
    el.loop.classList.remove("active");
    el.loopStatus.textContent = "No loop range set.";
    try { api.clearPlaybackRangeHighlight(); } catch (e) {}
  }

  async function loadInteractiveAsset(song) {
    if (!song || !song.interactive || !song.interactive.blob) return;
    resetTransportState();
    stopBackingAudio();
    activeInteractiveSongId = song.id;
    currentFilename = song.interactive.name;
    el.alpha.style.display = "block";
    el.empty.style.display = "none";
    el.loading.style.display = "flex";
    setStatus("Loading " + song.interactive.name + "…");

    try {
      const buffer = await song.interactive.blob.arrayBuffer();
      const accepted = api.load(new Uint8Array(buffer));
      if (!accepted) {
        throw new Error("alphaTab did not recognise this interactive score. MuseScore .mscz files must be exported as MusicXML first.");
      }
      el.viewerTitle.textContent = song.title;
      el.viewerMeta.textContent = "Interactive score · " + song.interactive.name;
    } catch (error) {
      console.error(error);
      el.loading.style.display = "none";
      setStatus("Could not open interactive score.", "warn");
      alert("Could not open this interactive score.\n\n" + (error && error.message ? error.message : error));
    }
  }

  async function openSelectedInteractive() {
    const song = await getSong(selectedSongId);
    if (!song || !song.interactive) return;
    await loadInteractiveAsset(song);
  }

  function loadSample() {
    resetTransportState();
    stopBackingAudio();
    activeInteractiveSongId = "__sample__";
    currentFilename = "alphaTab test song";
    el.alpha.style.display = "block";
    el.empty.style.display = "none";
    el.loading.style.display = "flex";
    el.viewerTitle.textContent = "alphaTab Test Song";
    el.viewerMeta.textContent = "Test score";
    setStatus("Loading test song…");
    api.load("https://www.alphatab.net/files/canon.gp");
  }

  api.scoreLoaded.on((score) => {
    el.alpha.style.display = "block";
    el.empty.style.display = "none";
    const fallbackSong = activeInteractiveSongId === "__sample__" ? null : songsCache.find((s) => s.id === activeInteractiveSongId);
    el.songTitle.textContent = score.title || (fallbackSong && fallbackSong.title) || currentFilename.replace(/\.[^.]+$/, "") || "Untitled score";
    el.songArtist.textContent = score.artist || score.album || "Unknown artist";

    const trackCount = score.tracks ? score.tracks.length : 0;
    const barCount = score.masterBars ? score.masterBars.length : 0;
    el.songMeta.textContent = trackCount + " track" + (trackCount === 1 ? "" : "s") +
      " · " + barCount + " bar" + (barCount === 1 ? "" : "s");

    el.loopStart.max = String(Math.max(1, barCount));
    el.loopEnd.max = String(Math.max(1, barCount));
    el.loopStart.value = "1";
    el.loopEnd.value = String(Math.min(4, Math.max(1, barCount)));
    renderTrackButtons(score);
    el.applyLoop.disabled = false;
    el.clearLoop.disabled = false;
    setStatus("Score loaded · preparing playback…");
  });

  api.renderStarted.on(() => {
    el.loading.style.display = "flex";
    markActiveTracks();
  });

  api.renderFinished.on(() => {
    el.loading.style.display = "none";
    markActiveTracks();
    if (playerReady) setStatus("Interactive score ready.", "ok");
  });

  api.soundFontLoad.on((event) => {
    if (!event || !event.total) return;
    const percent = Math.max(0, Math.min(100, Math.floor((event.loaded / event.total) * 100)));
    setStatus("Preparing instrument sounds · " + percent + "%");
  });

  api.playerReady.on(() => {
    playerReady = true;
    [el.stop, el.play, el.countIn, el.metro, el.loop, el.speed].forEach((node) => node.disabled = false);
    setStatus("Interactive score ready.", "ok");
  });

  api.playerStateChanged.on((event) => {
    scorePlaying = event.state === alphaTab.synth.PlayerState.Playing;
    el.play.textContent = scorePlaying ? "Ⅱ" : "▶";
    if (scorePlaying && !el.audio.paused) el.audio.pause();
  });

  api.playerPositionChanged.on((event) => {
    el.position.textContent = fmt(event.currentTime) + " / " + fmt(event.endTime);
  });

  api.error.on((event) => {
    console.error("alphaTab error:", event);
    el.loading.style.display = "none";
    setStatus("Interactive score/player error.", "warn");
  });

  async function saveLibraryZip() {
    if (typeof JSZip === "undefined") {
      setStatus("ZIP library is unavailable.", "warn");
      return;
    }
    const songs = await allSongs();
    if (!songs.length) {
      toast("Your library is empty.");
      return;
    }

    el.saveLibrary.disabled = true;
    try {
      const zip = new JSZip();
      const manifest = {
        format: "DT Music Trainer Pro Library",
        version: 1,
        exportedAt: new Date().toISOString(),
        songs: []
      };

      songs.forEach((song) => {
        const meta = {
          id: song.id,
          title: song.title,
          createdAt: song.createdAt || Date.now(),
          updatedAt: song.updatedAt || Date.now(),
          assets: {}
        };

        ["interactive","pdf","audio"].forEach((kind) => {
          const asset = song[kind];
          if (!asset || !asset.blob) return;
          const safeName = String(asset.name || kind).replace(/[\\/:*?"<>|]+/g, "_");
          const path = "songs/" + song.id + "/" + kind + "-" + safeName;
          zip.file(path, asset.blob);
          meta.assets[kind] = {
            name: asset.name,
            mime: asset.mime || "",
            size: asset.size || asset.blob.size || 0,
            path: path
          };
        });

        manifest.songs.push(meta);
      });

      zip.file(MANIFEST_NAME, JSON.stringify(manifest, null, 2));
      setStatus("Creating Library ZIP…");
      const blob = await zip.generateAsync(
        { type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } },
        (metadata) => setStatus("Creating Library ZIP · " + Math.round(metadata.percent) + "%")
      );

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "DT_Music_Trainer_Pro_" + new Date().toISOString().slice(0, 10) + ".zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setStatus("Library ZIP saved.", "ok");
    } catch (error) {
      console.error(error);
      setStatus("Could not save Library ZIP: " + error.message, "warn");
    } finally {
      el.saveLibrary.disabled = false;
    }
  }

  async function loadLibraryZip(file) {
    if (!file) return;
    el.loadLibrary.disabled = true;
    try {
      setStatus("Reading Library ZIP…");
      const zip = await JSZip.loadAsync(file);
      const manifestEntry = zip.file(MANIFEST_NAME);
      if (!manifestEntry) throw new Error("This ZIP is not a DT Music Trainer Pro library.");
      const manifest = JSON.parse(await manifestEntry.async("text"));
      if (!manifest || manifest.format !== "DT Music Trainer Pro Library" || manifest.version !== 1 || !Array.isArray(manifest.songs)) {
        throw new Error("Unsupported library backup.");
      }

      if (!confirm("Load this DT Music Trainer Pro library?\n\nThis replaces the current local Pro library on this device.")) {
        setStatus("Load cancelled.");
        return;
      }

      try { api.stop(); } catch (e) {}
      stopBackingAudio();
      showEmpty("Interactive Score", "Choose a song and press Open Interactive.");
      await clearSongs();

      for (let i = 0; i < manifest.songs.length; i++) {
        const meta = manifest.songs[i];
        const song = {
          id: meta.id || makeId(),
          title: meta.title || "Untitled Song",
          createdAt: meta.createdAt || Date.now(),
          updatedAt: meta.updatedAt || Date.now(),
          interactive: null,
          pdf: null,
          audio: null
        };

        for (const kind of ["interactive","pdf","audio"]) {
          const assetMeta = meta.assets && meta.assets[kind];
          if (!assetMeta || !assetMeta.path) continue;
          const entry = zip.file(assetMeta.path);
          if (!entry) throw new Error("Backup is missing " + assetMeta.name + ".");
          const bytes = await entry.async("uint8array");
          song[kind] = {
            name: assetMeta.name || kind,
            mime: assetMeta.mime || "",
            size: assetMeta.size || bytes.byteLength,
            blob: new Blob([bytes], { type: assetMeta.mime || "" }),
            updatedAt: Date.now()
          };
        }

        await putSong(song);
        setStatus("Restoring Library · " + (i + 1) + "/" + manifest.songs.length);
      }

      selectedSongId = "";
      localStorage.removeItem("dtmtp-selected-song");
      await refreshCache();
      setStatus("Library restored · " + manifest.songs.length + " songs.", "ok");
    } catch (error) {
      console.error(error);
      setStatus("Could not load Library ZIP: " + error.message, "warn");
    } finally {
      el.backupInput.value = "";
      el.loadLibrary.disabled = false;
    }
  }

  el.search.addEventListener("input", renderLibrary);
  el.addFiles.onclick = () => el.fileInput.click();
  el.fileInput.addEventListener("change", () => addFilesToLibrary(el.fileInput.files, ""));
  el.attachSelected.onclick = () => {
    if (selectedSongId) el.selectedFileInput.click();
  };
  el.selectedFileInput.addEventListener("change", () => addFilesToLibrary(el.selectedFileInput.files, selectedSongId));
  el.newSong.onclick = createSong;
  el.renameSong.onclick = renameSelectedSong;
  el.deleteSong.onclick = deleteSelectedSong;
  el.openInteractive.onclick = openSelectedInteractive;
  el.openPdf.onclick = openSelectedPdf;
  el.playAudio.onclick = playSelectedAudio;
  el.sample.onclick = loadSample;
  el.saveLibrary.onclick = saveLibraryZip;
  el.loadLibrary.onclick = () => el.backupInput.click();
  el.backupInput.addEventListener("change", () => loadLibraryZip(el.backupInput.files && el.backupInput.files[0]));

  ["dragenter","dragover"].forEach((eventName) => {
    el.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropzone.classList.add("dragover");
    });
  });
  ["dragleave","drop"].forEach((eventName) => {
    el.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropzone.classList.remove("dragover");
    });
  });
  el.dropzone.addEventListener("drop", (event) => addFilesToLibrary(event.dataTransfer.files, ""));

  el.play.onclick = () => {
    if (!playerReady) return;
    if (!el.audio.paused) el.audio.pause();
    api.playPause();
  };
  el.stop.onclick = () => {
    if (playerReady) api.stop();
  };
  el.countIn.onclick = () => {
    el.countIn.classList.toggle("active");
    api.countInVolume = el.countIn.classList.contains("active") ? 1 : 0;
  };
  el.metro.onclick = () => {
    el.metro.classList.toggle("active");
    api.metronomeVolume = el.metro.classList.contains("active") ? 1 : 0;
  };
  el.loop.onclick = () => {
    api.isLooping = !api.isLooping;
    el.loop.classList.toggle("active", api.isLooping);
    if (!api.playbackRange && api.isLooping) {
      el.loopStatus.textContent = "Looping the whole song. Set bar numbers for a section loop.";
    } else if (!api.isLooping && api.playbackRange) {
      el.loopStatus.textContent = "Bar range saved, looping paused.";
    }
  };
  el.speed.oninput = () => {
    const value = parseInt(el.speed.value, 10);
    el.speedValue.textContent = value + "%";
    api.playbackSpeed = value / 100;
  };
  el.zoom.oninput = () => {
    const value = parseInt(el.zoom.value, 10);
    el.zoomValue.textContent = value + "%";
    api.settings.display.scale = value / 100;
    api.updateSettings();
    api.render();
  };
  el.applyLoop.onclick = applyLoopRange;
  el.clearLoop.onclick = clearLoopRange;

  el.audio.addEventListener("play", () => {
    if (scorePlaying) {
      try { api.playPause(); } catch (e) {}
    }
  });
  el.audioStop.onclick = () => {
    el.audio.pause();
    el.audio.currentTime = 0;
  };

  window.addEventListener("beforeunload", revokeBackingUrl);

  async function init() {
    try {
      setStatus("Opening local Pro library…");
      await openDatabase();
      await refreshCache();
      showEmpty("DT Music Trainer Pro", "Phase 2 is ready. Add a song's PDF, interactive score and backing track to the Library, then open the interactive score.");
      if (selectedSongId) renderSelectedSong();
      setStatus("Phase 2 ready · local library", "ok");
    } catch (error) {
      console.error(error);
      setStatus("Could not open local library: " + error.message, "warn");
    }
  }

  init();
})();
