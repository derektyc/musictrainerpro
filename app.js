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
    synthMode: $("synthModeBtn"),
    backingMode: $("backingModeBtn"),
    autoSync: $("autoSyncBtn"),
    syncBar: $("syncBarInput"),
    syncCurrentTime: $("syncCurrentTime"),
    markSync: $("markSyncBtn"),
    clearSync: $("clearSyncBtn"),
    syncPointList: $("syncPointList"),
    syncStatus: $("syncStatus"),
    audioModeNote: $("audioModeNote"),
    audio: $("backingAudio"),
    audioTitle: $("audioTitle"),
    audioVersion: $("audioVersionSelect"),
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
  let loadedAudioSongId = "";
  let loadedAudioVersionId = "";
  let backingModeActive = false;
  let backingSyncTimer = null;
  let backingLoopEnabled = false;
  let backingLoopStartMs = 0;
  let backingLoopEndMs = 0;
  let backingSyncMap = [];
  let backingCursorDriverActive = false;
  let backingPreRollFrozen = false;
  let synthVolumeBeforeBacking = 1;
  let naturalScoreEndMs = 0;
  let toastTimer = null;
  let pendingMusicXmlSystemBreaks = [];
  let pendingInteractiveIsMusicXml = false;

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

  function musicXmlSystemBreaks(doc) {
    const breaks = new Set();
    if (!doc || !doc.documentElement) return [];

    const root = doc.documentElement;
    const directChildren = (node, name) =>
      Array.from(node && node.children ? node.children : []).filter((child) => child.localName === name);
    const hasForcedPrint = (node) =>
      directChildren(node, "print").some((print) =>
        String(print.getAttribute("new-system") || "").toLowerCase() === "yes" ||
        String(print.getAttribute("new-page") || "").toLowerCase() === "yes"
      );

    if (root.localName === "score-partwise") {
      directChildren(root, "part").forEach((part) => {
        directChildren(part, "measure").forEach((measure, index) => {
          if (index > 0 && hasForcedPrint(measure)) breaks.add(index);
        });
      });
    } else if (root.localName === "score-timewise") {
      directChildren(root, "measure").forEach((measure, index) => {
        if (index <= 0) return;
        if (hasForcedPrint(measure) || directChildren(measure, "part").some(hasForcedPrint)) breaks.add(index);
      });
    }

    return Array.from(breaks).sort((a,b) => a-b);
  }

  function musicXmlModelLayout(score, forcedSystemBreaks) {
    const bars = score && Array.isArray(score.masterBars) ? score.masterBars : [];
    const total = bars.length;
    if (!total) return null;

    const explicit = Array.from(new Set((forcedSystemBreaks || [])
      .map((n) => Math.round(Number(n)))
      .filter((n) => n > 0 && n < total)))
      .sort((a,b) => a-b);

    // MuseScore can preserve rehearsal/section markers even when page layout
    // itself is not exported as a forced MusicXML system break. When there is
    // no explicit print break, use those musical sections as layout boundaries.
    const sections = [];
    bars.forEach((bar,index) => {
      if (index <= 0) return;
      const marker = bar && bar.section ? String(bar.section.marker || "").trim() : "";
      if (marker) sections.push(index);
    });

    const boundaries = explicit.length ? explicit : Array.from(new Set(sections)).sort((a,b) => a-b);
    if (!boundaries.length) return null;

    const layout = [];
    let previous = 0;
    boundaries.forEach((boundary) => {
      const count = boundary - previous;
      if (count > 0) layout.push(count);
      previous = boundary;
    });

    const base = Math.max(1, layout[0] || 4);
    let remaining = total - previous;
    while (remaining > 0) {
      const count = Math.min(base, remaining);
      layout.push(count);
      remaining -= count;
    }

    return {
      layout,
      defaultBars: base,
      source: explicit.length ? "musicxml-breaks" : "section-markers"
    };
  }

  function applyMusicXmlModelLayout(score, forcedSystemBreaks) {
    const model = musicXmlModelLayout(score, forcedSystemBreaks);
    if (!model) {
      if (api && api.settings && api.settings.display) {
        api.settings.display.systemsLayoutMode = alphaTab.SystemsLayoutMode
          ? alphaTab.SystemsLayoutMode.Automatic
          : 0;
      }
      return null;
    }

    const layout = model.layout.slice();
    score.systemsLayout = layout.slice();
    score.defaultSystemsLayout = model.defaultBars;

    if (Array.isArray(score.tracks)) {
      score.tracks.forEach((track) => {
        track.systemsLayout = layout.slice();
        track.defaultSystemsLayout = model.defaultBars;
      });
    }

    if (api && api.settings && api.settings.display) {
      api.settings.display.systemsLayoutMode = alphaTab.SystemsLayoutMode
        ? alphaTab.SystemsLayoutMode.UseModelLayout
        : 1;
    }

    return model;
  }

  function normalizePercussionMusicXml(xmlText) {
    const source = String(xmlText || "");
    if (!source.trim()) return { xml: source, changed: false, restoredNoteheads: 0, systemBreaks: [] };

    let doc;
    try {
      doc = new DOMParser().parseFromString(source, "application/xml");
    } catch (error) {
      return { xml: source, changed: false, restoredNoteheads: 0, systemBreaks: [] };
    }

    if (!doc || doc.getElementsByTagName("parsererror").length) {
      return { xml: source, changed: false, restoredNoteheads: 0, systemBreaks: [] };
    }

    const systemBreaks = musicXmlSystemBreaks(doc);
    let restoredNoteheads = 0;
    const notes = Array.from(doc.getElementsByTagName("note"));
    const insertBeforeNames = new Set(["notehead-text","staff","beam","notations","lyric","play","listen"]);

    notes.forEach((note) => {
      const unpitched = Array.from(note.children || []).find((child) => child.localName === "unpitched");
      if (!unpitched) return;

      const existingHead = Array.from(note.children || []).find((child) => child.localName === "notehead");
      if (existingHead) return;

      // MusicXML defines an omitted notehead as the normal notehead. MuseScore relies on
      // that default for kick/snare/toms, while alphaTab's percussion importer can leave
      // those implicit heads without a drawable symbol. Make the default explicit.
      const head = note.namespaceURI
        ? doc.createElementNS(note.namespaceURI, "notehead")
        : doc.createElement("notehead");
      head.textContent = "normal";

      const before = Array.from(note.children || []).find((child) => insertBeforeNames.has(child.localName));
      if (before) note.insertBefore(head, before);
      else note.appendChild(head);
      restoredNoteheads++;
    });

    if (!restoredNoteheads) {
      return { xml: source, changed: false, restoredNoteheads: 0, systemBreaks };
    }

    try {
      return {
        xml: new XMLSerializer().serializeToString(doc),
        changed: true,
        restoredNoteheads,
        systemBreaks
      };
    } catch (error) {
      return { xml: source, changed: false, restoredNoteheads: 0, systemBreaks };
    }
  }

  async function extractMusicXmlFromMxl(bytes) {
    if (typeof JSZip === "undefined") return "";
    const zip = await JSZip.loadAsync(bytes);
    let scorePath = "";

    const container = zip.file("META-INF/container.xml");
    if (container) {
      try {
        const containerText = await container.async("string");
        const containerDoc = new DOMParser().parseFromString(containerText, "application/xml");
        const rootfile = Array.from(containerDoc.getElementsByTagName("rootfile"))[0];
        scorePath = rootfile ? String(rootfile.getAttribute("full-path") || "") : "";
      } catch (error) {}
    }

    if (!scorePath || !zip.file(scorePath)) {
      const candidates = Object.keys(zip.files).filter((name) =>
        !zip.files[name].dir &&
        !/^META-INF\//i.test(name) &&
        /\.(musicxml|xml)$/i.test(name)
      );
      scorePath = candidates[0] || "";
    }

    const entry = scorePath ? zip.file(scorePath) : null;
    return entry ? await entry.async("string") : "";
  }

  async function prepareInteractiveForAlphaTab(asset) {
    const rawBuffer = await asset.blob.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);
    const ext = extension(asset.name);

    let looksLikeXml = false;
    if (ext !== "mxl") {
      try {
        const prefix = new TextDecoder("utf-8").decode(rawBytes.slice(0, Math.min(rawBytes.length, 512)));
        looksLikeXml = /<\s*score-(?:partwise|timewise)\b/i.test(prefix) ||
          /<\?xml[\s\S]*?<\s*score-/i.test(prefix);
      } catch (error) {}
    }

    if (!["musicxml","xml","mxl"].includes(ext) && !looksLikeXml) {
      return { bytes: rawBytes, percussionFixes: 0, systemBreaks: [], isMusicXml: false };
    }

    let xmlText = "";
    try {
      if (ext === "mxl") xmlText = await extractMusicXmlFromMxl(rawBytes);
      else xmlText = new TextDecoder("utf-8").decode(rawBytes);
    } catch (error) {
      console.warn("MusicXML compatibility check could not read the score", error);
      return { bytes: rawBytes, percussionFixes: 0, systemBreaks: [], isMusicXml: true };
    }

    if (!xmlText) return { bytes: rawBytes, percussionFixes: 0, systemBreaks: [], isMusicXml: true };

    const normalized = normalizePercussionMusicXml(xmlText);
    if (!normalized.changed) {
      return {
        bytes: rawBytes,
        percussionFixes: 0,
        systemBreaks: normalized.systemBreaks || [],
        isMusicXml: true
      };
    }

    return {
      bytes: new TextEncoder().encode(normalized.xml),
      percussionFixes: normalized.restoredNoteheads,
      systemBreaks: normalized.systemBreaks || [],
      isMusicXml: true
    };
  }

  function classifyFile(file) {
    const ext = extension(file && file.name);
    if (INTERACTIVE_EXTS.has(ext)) return "interactive";
    if (ext === "pdf" || (file && file.type === "application/pdf")) return "pdf";
    if (AUDIO_EXTS.has(ext) || (file && /^audio\/(mpeg|wav|x-wav)$/i.test(file.type || ""))) return "audio";
    return "";
  }

  async function readInteractiveMetadata(file) {
    if (!file || classifyFile(file) !== "interactive") {
      return { title: "", artist: "" };
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (alphaTab && alphaTab.importer && alphaTab.importer.ScoreLoader &&
          typeof alphaTab.importer.ScoreLoader.loadScoreFromBytes === "function") {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, api ? api.settings : undefined);
        const title = String(score && score.title || "").trim();
        const artist = String(score && (score.artist || score.albumArtist) || "").trim();
        if (title) return { title, artist };
      }
    } catch (error) {
      console.warn("Could not read embedded interactive-score metadata with alphaTab", error);
    }

    // Lightweight MusicXML fallback in case the browser bundle does not expose ScoreLoader.
    const ext = extension(file.name);
    if (["musicxml","xml"].includes(ext)) {
      try {
        const text = await file.text();
        const doc = new DOMParser().parseFromString(text, "application/xml");
        if (!doc.getElementsByTagName("parsererror").length) {
          const firstText = (names) => {
            for (const name of names) {
              const node = doc.getElementsByTagName(name)[0];
              const value = node ? String(node.textContent || "").trim() : "";
              if (value) return value;
            }
            return "";
          };
          return {
            title: firstText(["movement-title","work-title"]),
            artist: firstText(["creator"])
          };
        }
      } catch (error) {
        console.warn("Could not read MusicXML title", error);
      }
    }

    return { title: "", artist: "" };
  }

  function exactInteractiveTitle(file) {
    const name = String(file && file.name || "");
    return name.replace(/\.[^.]+$/, "");
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


  function audioVersionLabel(name) {
    const base=String(name||"Backing track").replace(/\.[^.]+$/,"");
    const match=base.match(/\(([^)]+)\)\s*(?:with vocals)?\s*$/i);
    if(match){
      const inside=match[1].trim();
      const vocals=/with vocals/i.test(base)?" · Vocals":"";
      return inside.replace(/\bbt\b/ig,"Backing").replace(/\bclick\b/ig,"Click").replace(/\bno click\b/ig,"No Click").replace(/\bfull\b/ig,"Full Mix")+vocals;
    }
    const suffix=base.match(/(?:[-–—]\s*)?((?:bt|backing|full).*)$/i);
    return suffix?suffix[1].trim():base;
  }

  function audioGroupingTitle(fileName) {
    return String(fileName||"")
      .replace(/\.[^.]+$/,"")
      .replace(/\s*\([^)]*(?:bt|backing|full|click|vocal)[^)]*\)\s*(?:with vocals)?\s*$/i,"")
      .replace(/\s+(?:with vocals|no vocals)$/i,"")
      .trim();
  }

  function normalizeAudioVersions(song) {
    if(!song) return song;
    let versions=Array.isArray(song.audioVersions)?song.audioVersions.filter(Boolean):[];
    if(!versions.length && song.audio){
      versions=[{
        id:"legacy-"+song.id,
        label:audioVersionLabel(song.audio.name),
        asset:song.audio,
        syncPoints:normalizeSyncPoints(song.syncPoints)
      }];
    }
    versions=versions.map((v,index)=>({
      id:String(v.id||("audio-"+index+"-"+song.id)),
      label:String(v.label||audioVersionLabel(v.asset&&v.asset.name)),
      asset:v.asset||null,
      syncPoints:normalizeSyncPoints(v.syncPoints)
    })).filter(v=>v.asset);

    song.audioVersions=versions;
    if(versions.length){
      if(!song.activeAudioId || !versions.some(v=>v.id===song.activeAudioId)) song.activeAudioId=versions[0].id;
      const active=versions.find(v=>v.id===song.activeAudioId)||versions[0];
      song.activeAudioId=active.id;
      song.audio=active.asset;
      song.syncPoints=normalizeSyncPoints(active.syncPoints);
    }else{
      song.activeAudioId="";
      song.audio=null;
      song.syncPoints=[];
    }
    return song;
  }

  function persistActiveAudioAlias(song) {
    if(!song) return song;
    normalizeAudioVersions(song);
    const active=song.audioVersions.find(v=>v.id===song.activeAudioId);
    if(active){
      active.asset=song.audio||active.asset;
      active.syncPoints=normalizeSyncPoints(song.syncPoints);
      active.label=active.label||audioVersionLabel(active.asset&&active.asset.name);
    }
    return song;
  }

  function activeAudioVersion(song) {
    normalizeAudioVersions(song);
    return song&&song.audioVersions.find(v=>v.id===song.activeAudioId)||null;
  }

  function addAudioVersion(song,file) {
    normalizeAudioVersions(song);
    const asset=makeAsset(file);
    const existing=song.audioVersions.find(v=>v.asset&&String(v.asset.name||"")===String(file.name||""));
    if(existing){
      existing.asset=asset;
      existing.label=audioVersionLabel(file.name);
      existing.syncPoints=[];
      song.activeAudioId=existing.id;
    }else{
      const version={id:makeId(),label:audioVersionLabel(file.name),asset,syncPoints:[]};
      song.audioVersions.push(version);
      song.activeAudioId=version.id;
    }
    normalizeAudioVersions(song);
    return song;
  }

  async function selectAudioVersion(songId,versionId) {
    const song=await getSong(songId);
    if(!song) return null;
    normalizeAudioVersions(song);
    const version=song.audioVersions.find(v=>v.id===versionId);
    if(!version) return song;
    stopBackingAudio();
    song.activeAudioId=version.id;
    song.audio=version.asset;
    song.syncPoints=normalizeSyncPoints(version.syncPoints);
    await putSong(song);
    await refreshCache();
    const refreshed=await getSong(songId);
    if(backingModeActive&&refreshed){
      await ensureBackingAudio(refreshed);
      applySongSyncPoints(refreshed);
      syncCursorFromBacking();
    }
    return refreshed;
  }

  async function allSongs() {
    const tx = db.transaction(SONG_STORE, "readonly");
    const songs=await idbRequest(tx.objectStore(SONG_STORE).getAll());
    return songs.map(normalizeAudioVersions);
  }

  async function getSong(id) {
    if (!id) return null;
    const tx = db.transaction(SONG_STORE, "readonly");
    return normalizeAudioVersions(await idbRequest(tx.objectStore(SONG_STORE).get(id)));
  }

  async function putSong(song) {
    persistActiveAudioAlias(song);
    song.updatedAt = Date.now();
    const tx = db.transaction(SONG_STORE, "readwrite");
    await idbRequest(tx.objectStore(SONG_STORE).put(song));
    window.dispatchEvent(new CustomEvent("dtmtp:library-changed",{
      detail:{type:"put",songId:song.id,updatedAt:song.updatedAt}
    }));
  }

  async function removeSong(id) {
    const tx = db.transaction(SONG_STORE, "readwrite");
    await idbRequest(tx.objectStore(SONG_STORE).delete(id));
    window.dispatchEvent(new CustomEvent("dtmtp:library-changed",{
      detail:{type:"delete",songId:id}
    }));
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
      renderSyncPanel(null);
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
    renderSyncPanel(song);
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
    backingModeActive = false;
    backingLoopEnabled = false;
    clearAppliedSyncPoints();
    renderLibrary();
    renderSelectedSong();
    stopBackingAudio();
    updateSourceUI();
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
    const batchAliases = new Map();

    let cache = await allSongs();
    const forceSong = forceSongId ? cache.find((s) => s.id === forceSongId) : null;

    for (const file of files) {
      const kind = classifyFile(file);
      if (!kind) {
        skipped++;
        continue;
      }

      const filenameTitle = kind === "interactive" ? exactInteractiveTitle(file) : titleFromFileName(file.name);
      const filenameKey = normalizeTitle(filenameTitle);

      let song = forceSong || null;
      if (!song) {
        const preferredTitle = filenameTitle;
        const preferredKey = normalizeTitle(preferredTitle);
        song = batchAliases.get(filenameKey) ||
          cache.find((s) => normalizeTitle(s.title) === preferredKey || normalizeTitle(s.title) === filenameKey) ||
          null;
        if (!song) {
          song = {
            id: makeId(),
            title: preferredTitle,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            interactive: null,
            pdf: null,
            audio: null,
            syncPoints: []
          };
          cache.push(song);
        }
        if (kind === "interactive" && filenameTitle) song.title = filenameTitle;
        if (filenameKey) batchAliases.set(filenameKey, song);
      }

      song[kind] = makeAsset(file);
      if (kind === "interactive" || kind === "audio") song.syncPoints = [];
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
    return {added,skipped,songCount:changed.size,changedIds:[...changed]};
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
      audio: null,
      syncPoints: []
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
    stopBackingSyncTimer();
    el.audio.pause();
    el.audio.removeAttribute("src");
    el.audio.load();
    revokeBackingUrl();
    loadedAudioSongId = "";
    loadedAudioVersionId = "";
    el.audioTitle.textContent = "No backing track loaded";
    updateSyncCurrentTime();
  }

  function waitForAudioMetadata() {
    if (Number.isFinite(el.audio.duration) && el.audio.duration > 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error("Could not read the backing-track duration.")); };
      const cleanup = () => {
        el.audio.removeEventListener("loadedmetadata", done);
        el.audio.removeEventListener("error", fail);
      };
      el.audio.addEventListener("loadedmetadata", done, { once: true });
      el.audio.addEventListener("error", fail, { once: true });
    });
  }

  async function ensureBackingAudio(song) {
    normalizeAudioVersions(song);
    const version=activeAudioVersion(song);
    if (!song || !version || !song.audio || !song.audio.blob) throw new Error("This song has no backing track.");
    if (loadedAudioSongId === song.id && loadedAudioVersionId === version.id && el.audio.src) {
      await waitForAudioMetadata();
      return;
    }
    stopBackingSyncTimer();
    el.audio.pause();
    revokeBackingUrl();
    backingUrl = URL.createObjectURL(song.audio.blob);
    loadedAudioSongId = song.id;
    loadedAudioVersionId = version.id;
    el.audio.src = backingUrl;
    el.audioTitle.textContent = (version.label||"Backing track")+" · "+song.audio.name;
    el.audio.load();
    await waitForAudioMetadata();
    updateSyncCurrentTime();
  }

  async function playSelectedAudio() {
    const song = await getSong(selectedSongId);
    if (!song || !song.audio || !song.audio.blob) return;
    if (scorePlaying) {
      try { api.playPause(); } catch (e) {}
    }
    try {
      await ensureBackingAudio(song);
      await el.audio.play();
      setStatus((backingModeActive ? "Playing synced backing · " : "Playing backing track · ") + song.title, "ok");
    } catch (e) {
      setStatus("Backing track loaded. Press play in the audio controls.", "warn");
    }
  }

  function formatSyncTime(ms) {
    ms = Math.max(0, Number(ms) || 0);
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milli = Math.floor(ms % 1000);
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0") + "." + String(milli).padStart(3, "0");
  }

  function updateSyncCurrentTime() {
    if (!el.syncCurrentTime) return;
    el.syncCurrentTime.textContent = formatSyncTime((Number(el.audio.currentTime) || 0) * 1000);
  }

  function normalizeSyncPoints(points) {
    return (Array.isArray(points) ? points : [])
      .map((p) => ({
        barIndex: Math.max(0, Number(p.barIndex) || 0),
        barOccurence: Math.max(0, Number(p.barOccurence) || 0),
        barPosition: Math.max(0, Math.min(1, Number(p.barPosition) || 0)),
        millisecondOffset: Math.max(0, Number(p.millisecondOffset) || 0)
      }))
      .sort((a, b) => (a.barIndex + a.barPosition) - (b.barIndex + b.barPosition) || a.millisecondOffset - b.millisecondOffset);
  }

  function playbackLookupForPoint(point) {
    if (!api || !api.tickCache || !Array.isArray(api.tickCache.masterBars)) return null;
    const matches = api.tickCache.masterBars.filter((lookup) =>
      lookup && lookup.masterBar && lookup.masterBar.index === point.barIndex
    );
    if (!matches.length) return null;
    const occurrence = Math.max(0, Math.min(matches.length - 1, Number(point.barOccurence) || 0));
    return matches[occurrence];
  }

  function finalBarOccurrence(barIndex) {
    if (!api || !api.tickCache || !Array.isArray(api.tickCache.masterBars)) return 0;
    const count = api.tickCache.masterBars.filter((lookup) =>
      lookup && lookup.masterBar && lookup.masterBar.index === barIndex
    ).length;
    return Math.max(0, count - 1);
  }

  function scoreTickForSyncPoint(point) {
    if (!api || !api.score) return 0;
    try {
      const lookup = playbackLookupForPoint(point);
      if (lookup) {
        const ratio = Math.max(0, Math.min(1, Number(point.barPosition) || 0));
        return Math.max(0, lookup.start + (lookup.end - lookup.start) * ratio);
      }
    } catch (error) {}

    const lookups = api.tickCache && Array.isArray(api.tickCache.masterBars) ? api.tickCache.masterBars : [];
    if (!lookups.length) return 0;
    const first = lookups[0], last = lookups[lookups.length - 1];
    const totalTicks = Math.max(0, Number(last.end) - Number(first.start));
    const bars = api.score.masterBars || [];
    const absolute = Math.max(0, Math.min(bars.length, Number(point.barIndex) + Number(point.barPosition || 0)));
    return Number(first.start) + totalTicks * (absolute / Math.max(1, bars.length));
  }

  function rebuildBackingSyncMap(song) {
    backingSyncMap = normalizeSyncPoints(song && song.syncPoints).map((point) => ({
      audioMs: Math.max(0, Number(point.millisecondOffset) || 0),
      scoreTick: scoreTickForSyncPoint(point)
    })).sort((a,b) => a.audioMs - b.audioMs);

    // Remove duplicate audio positions so interpolation never divides by zero.
    backingSyncMap = backingSyncMap.filter((point,index,list) =>
      index === 0 || Math.abs(point.audioMs - list[index - 1].audioMs) > 0.5
    );
    return backingSyncMap;
  }

  function scoreTickFromBackingAudio(audioMs) {
    const map = backingSyncMap;
    if (!map.length) return Math.max(0, Number(api && api.tickPosition) || 0);

    if (audioMs <= map[0].audioMs) return map[0].scoreTick;
    for (let i = 0; i < map.length - 1; i++) {
      const a = map[i], b = map[i + 1];
      if (audioMs <= b.audioMs) {
        const span = b.audioMs - a.audioMs;
        const ratio = span > 0 ? (audioMs - a.audioMs) / span : 0;
        return a.scoreTick + (b.scoreTick - a.scoreTick) * ratio;
      }
    }

    return map[map.length - 1].scoreTick;
  }

  function backingAudioTimeFromScoreTick(scoreTick) {
    const map = backingSyncMap;
    if (!map.length) return 0;

    if (scoreTick <= map[0].scoreTick) return map[0].audioMs;
    for (let i = 0; i < map.length - 1; i++) {
      const a = map[i], b = map[i + 1];
      if (scoreTick <= b.scoreTick) {
        const span = b.scoreTick - a.scoreTick;
        const ratio = span > 0 ? (scoreTick - a.scoreTick) / span : 0;
        return a.audioMs + (b.audioMs - a.audioMs) * ratio;
      }
    }

    return map[map.length - 1].audioMs;
  }

  function median(values) {
    if (!values.length) return 0;
    const copy = values.slice().sort((a,b) => a-b);
    const mid = Math.floor(copy.length / 2);
    return copy.length % 2 ? copy[mid] : (copy[mid - 1] + copy[mid]) / 2;
  }

  async function detectSustainedMusicStart(song, beatMs) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !song || !song.audio || !song.audio.blob) return null;

    let context = null;
    try {
      context = new AudioContextClass();
      const bytes = await song.audio.blob.arrayBuffer();
      const decoded = await context.decodeAudioData(bytes.slice(0));
      const sampleRate = decoded.sampleRate;
      const seconds = Math.min(12, decoded.duration);
      const sampleLimit = Math.max(1, Math.floor(seconds * sampleRate));
      const frameMs = 50;
      const frameSize = Math.max(64, Math.floor(sampleRate * frameMs / 1000));
      const rms = [];

      for (let start = 0; start < sampleLimit; start += frameSize) {
        const end = Math.min(sampleLimit, start + frameSize);
        let sumSquares = 0, samples = 0;
        for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
          const data = decoded.getChannelData(ch);
          for (let i = start; i < end; i += 4) {
            const v = data[i] || 0;
            sumSquares += v * v;
            samples++;
          }
        }
        rms.push(samples ? Math.sqrt(sumSquares / samples) : 0);
      }

      if (rms.length < 20) return null;
      const ordered = rms.slice().sort((a,b) => a-b);
      const p70 = ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.70))] || 0;
      const threshold = Math.max(0.002, p70 * 0.12);
      const nextFrames = Math.max(4, Math.round(800 / frameMs));
      const prevFrames = Math.max(4, Math.round(500 / frameMs));

      // A real musical entrance remains active; count-in clicks are strong but isolated.
      // Find the first frame where activity becomes sustained after a mostly quiet window.
      for (let i = prevFrames; i + nextFrames < rms.length; i++) {
        if (rms[i] <= threshold) continue;
        const next = rms.slice(i, i + nextFrames);
        const previous = rms.slice(i - prevFrames, i);
        const nextOccupancy = next.filter((v) => v > threshold).length / next.length;
        const previousOccupancy = previous.filter((v) => v > threshold).length / previous.length;
        const nextOrdered = next.slice().sort((a,b) => a-b);
        const nextMedian = nextOrdered[Math.floor(nextOrdered.length / 2)] || 0;

        if (nextOccupancy >= 0.75 && previousOccupancy <= 0.35 && nextMedian > threshold * 2) {
          // Refine to the sharpest rise in the next 200 ms so encoder delay / ramp-up
          // does not place bar 1 slightly before the real downbeat.
          let best = i;
          let bestRise = -Infinity;
          const refineEnd = Math.min(rms.length, i + Math.max(2, Math.round(200 / frameMs)));
          for (let j = i; j < refineEnd; j++) {
            const rise = rms[j] - (j > 0 ? rms[j - 1] : 0);
            if (rise > bestRise) {
              bestRise = rise;
              best = j;
            }
          }
          const offsetMs = best * frameMs;
          const beats = beatMs > 0 ? Math.max(0, Math.round(offsetMs / beatMs)) : 0;
          return {offsetMs, beats, method:"sustained-music-start", confidence:0.97};
        }
      }

      // If the track is already continuously active from the opening, it has no pre-roll.
      const opening = rms.slice(0, nextFrames);
      const openingOccupancy = opening.filter((v) => v > threshold).length / Math.max(1, opening.length);
      if (openingOccupancy >= 0.75) {
        return {offsetMs:0, beats:0, method:"music-from-start", confidence:0.95};
      }
      return null;
    } catch (error) {
      console.warn("Could not detect sustained music start", error);
      return null;
    } finally {
      if (context && typeof context.close === "function") {
        try { await context.close(); } catch (error) {}
      }
    }
  }

  async function detectClickCountIn(song, beatMs) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !song || !song.audio || !song.audio.blob || !beatMs) return null;

    let context = null;
    try {
      context = new AudioContextClass();
      const bytes = await song.audio.blob.arrayBuffer();
      const decoded = await context.decodeAudioData(bytes.slice(0));
      const sampleRate = decoded.sampleRate;
      const seconds = Math.min(12, decoded.duration);
      const sampleLimit = Math.max(1, Math.floor(seconds * sampleRate));
      const frameSize = Math.max(64, Math.floor(sampleRate * 0.02));
      const envelope = [];

      for (let start = 0; start < sampleLimit; start += frameSize) {
        let sum = 0, samples = 0;
        for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
          const data = decoded.getChannelData(ch);
          const end = Math.min(sampleLimit, start + frameSize);
          for (let i = start; i < end; i += 4) {
            sum += Math.abs(data[i]);
            samples++;
          }
        }
        envelope.push(samples ? sum / samples : 0);
      }

      if (envelope.length < 10) return null;

      const onsets = envelope.map((value,index) => {
        if (index < 3) return 0;
        const from = Math.max(0, index - 5);
        const base = envelope.slice(from,index).reduce((a,b)=>a+b,0) / Math.max(1,index-from);
        return Math.max(0, value - base);
      });
      const positive = onsets.filter((v) => v > 0);
      if (!positive.length) return null;
      const sorted = positive.slice().sort((a,b)=>a-b);
      const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.90))] || 0;
      const threshold = Math.max(0.004, median(positive) * 4, p90 * 0.55);
      const minFrames = Math.max(1, Math.floor((beatMs * 0.45) / 20));
      const peaks = [];

      for (let i = 1; i < onsets.length - 1; i++) {
        if (onsets[i] < threshold || onsets[i] < onsets[i-1] || onsets[i] < onsets[i+1]) continue;
        if (peaks.length && i - peaks[peaks.length - 1].frame < minFrames) {
          if (onsets[i] > peaks[peaks.length - 1].strength) peaks[peaks.length - 1] = {frame:i,strength:onsets[i]};
        } else {
          peaks.push({frame:i,strength:onsets[i]});
        }
      }

      const peakTimes = peaks.map((p) => p.frame * 20);
      const tolerance = Math.max(140, beatMs * 0.28);
      let best = null;

      for (let startIndex = 0; startIndex < peakTimes.length; startIndex++) {
        if (peakTimes[startIndex] > Math.max(1800, beatMs * 2)) break;
        const sequence = [peakTimes[startIndex]];
        let expected = peakTimes[startIndex] + beatMs;
        for (let i = startIndex + 1; i < peakTimes.length && sequence.length < 8; i++) {
          if (Math.abs(peakTimes[i] - expected) <= tolerance) {
            sequence.push(peakTimes[i]);
            expected = peakTimes[i] + beatMs;
          }
        }
        if (sequence.length >= 3) {
          const offsetMs = sequence[sequence.length - 1] + beatMs;
          const candidate = {offsetMs, beats:sequence.length, method:"click-pattern", confidence:Math.min(0.92,0.55+sequence.length*0.08)};
          if (!best || candidate.beats > best.beats || (candidate.beats === best.beats && candidate.offsetMs < best.offsetMs)) best = candidate;
        }
      }
      return best;
    } catch (error) {
      console.warn("Count-in audio analysis unavailable", error);
      return null;
    } finally {
      if (context && typeof context.close === "function") {
        try { await context.close(); } catch (error) {}
      }
    }
  }

  async function detectBackingStartOffset(song) {
    const bpm = Math.max(1, Number(api && api.score && api.score.tempo) || 120);
    const beatMs = 60000 / bpm;

    // Prefer the transition from isolated count-in clicks to sustained musical audio.
    // File duration is deliberately NOT the primary detector because commercial
    // backing tracks often contain reverb tails and several seconds of encoded silence.
    const sustained = await detectSustainedMusicStart(song, beatMs);
    if (sustained) return sustained;

    // Fallback for sparse arrangements where the musical entrance is not sustained.
    const clickCandidate = await detectClickCountIn(song, beatMs);
    if (clickCandidate && clickCandidate.beats <= 8) return clickCandidate;

    return {offsetMs:0,beats:0,method:"none",confidence:0};
  }

  function applySongSyncPoints(song) {
    if (!api || !api.score || !song) return false;
    const points = normalizeSyncPoints(song.syncPoints);
    try {
      // External MP3/WAV playback uses our own audio-time → musical-tick map.
      // Do not warp alphaTab's internal tempo with these points as well; doing both
      // double-applies the synchronization and changes the score's natural duration.
      api.score.applyFlatSyncPoints([]);
      api.updateSyncPoints();
      rebuildBackingSyncMap(song);
      return points.length >= 2;
    } catch (error) {
      console.error("Could not apply sync points", error);
      setStatus("Could not apply backing-track sync points.", "warn");
      return false;
    }
  }

  function clearAppliedSyncPoints() {
    if (!api || !api.score) return;
    try {
      api.score.applyFlatSyncPoints([]);
      api.updateSyncPoints();
      backingSyncMap = [];
    } catch (error) {
      console.warn("Could not clear applied sync points", error);
    }
  }

  function renderSyncPanel(song) {
    if (!el.syncPointList) return;
    const scoreReady = !!(song && activeInteractiveSongId === song.id && api && api.score && playerReady);
    const hasPair = !!(song && song.interactive && song.audio);
    const points = normalizeSyncPoints(song && song.syncPoints);

    el.backingMode.disabled = !hasPair || !scoreReady;
    el.autoSync.disabled = !hasPair || !scoreReady;
    el.markSync.disabled = !hasPair || !scoreReady;
    el.clearSync.disabled = !song || !points.length;
    if (api && api.score && api.score.masterBars) el.syncBar.max = String(Math.max(1, api.score.masterBars.length));

    el.synthMode.classList.toggle("active-source", !backingModeActive);
    el.backingMode.classList.toggle("active-source", backingModeActive);

    el.syncPointList.innerHTML = "";
    if (!song) {
      el.syncPointList.innerHTML = '<div class="note">Select a song first.</div>';
      el.syncStatus.textContent = "Sync points are saved with the song and included in Library ZIP backups.";
      return;
    }
    if (!hasPair) {
      el.syncPointList.innerHTML = '<div class="note">Attach both an interactive score and an MP3/WAV backing track.</div>';
      el.syncStatus.textContent = "Both files are required for backing-track sync.";
      return;
    }
    if (!scoreReady) {
      el.syncPointList.innerHTML = '<div class="note">Press Open Interactive first, then create or edit sync points.</div>';
      el.syncStatus.textContent = points.length ? points.length + " saved sync point(s)." : "Interactive score must be loaded before calibration.";
      return;
    }

    if (!points.length) {
      el.syncPointList.innerHTML = '<div class="note">No sync points yet. Auto Sync creates start/end points; add extra bar markers if the audio drifts.</div>';
    } else {
      points.forEach((point, index) => {
        const row = document.createElement("div");
        row.className = "sync-point";
        const main = document.createElement("div");
        main.className = "sync-point-main";
        const title = document.createElement("div");
        title.className = "sync-point-title";
        const isEnd = point.barPosition >= 0.999;
        title.textContent = "Bar " + (point.barIndex + 1) + (isEnd ? " end" : " start");
        const meta = document.createElement("div");
        meta.className = "sync-point-meta";
        meta.textContent = formatSyncTime(point.millisecondOffset);
        main.append(title, meta);
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "Remove";
        del.onclick = async () => {
          const current = await getSong(song.id);
          if (!current) return;
          const list = normalizeSyncPoints(current.syncPoints);
          list.splice(index, 1);
          current.syncPoints = list;
          await putSong(current);
          if (backingModeActive) applySongSyncPoints(current);
          await refreshCache();
        };
        row.append(main, del);
        el.syncPointList.appendChild(row);
      });
    }

    const startOffset = points.length ? Number(points[0].millisecondOffset) || 0 : 0;
    el.syncStatus.textContent = points.length >= 2
      ? points.length + " sync point(s) ready." +
        (startOffset > 0 ? " Count-in / intro offset: " + formatSyncTime(startOffset) + "." : "") +
        " Extra points improve songs with tempo drift."
      : "At least 2 sync points are recommended.";
  }

  async function autoSyncWholeSong() {
    const song = await getSong(selectedSongId);
    if (!song || !song.interactive || !song.audio || activeInteractiveSongId !== song.id || !api.score) return;
    try {
      await ensureBackingAudio(song);
      const bars = api.score.masterBars || [];
      if (!bars.length) throw new Error("The score has no bars.");
      const durationMs = el.audio.duration * 1000;
      if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("Backing-track duration is unavailable.");

      setStatus("Analysing count-in and score timing…");
      const detected = await detectBackingStartOffset(song);
      const startOffsetMs = Math.max(0, Math.min(durationMs - 1, Number(detected.offsetMs) || 0));
      const lastBarIndex = bars.length - 1;
      const scoreDurationMs = Math.max(0, naturalScoreEndMs || Number(api.endTime) || 0);
      const expectedMusicalEndMs = scoreDurationMs > 0 ? startOffsetMs + scoreDurationMs : durationMs;
      const beatMs = 60000 / Math.max(1, Number(api.score.tempo) || 120);
      const hasLongTail = durationMs - expectedMusicalEndMs > beatMs * 1.5;
      const musicalEndMs = Math.max(
        startOffsetMs + 1,
        Math.min(durationMs, hasLongTail ? expectedMusicalEndMs : durationMs)
      );

      song.syncPoints = [
        { barIndex: 0, barOccurence: 0, barPosition: 0, millisecondOffset: startOffsetMs },
        {
          barIndex: lastBarIndex,
          barOccurence: finalBarOccurrence(lastBarIndex),
          barPosition: 1,
          millisecondOffset: musicalEndMs
        }
      ];
      await putSong(song);
      applySongSyncPoints(song);
      await refreshCache();

      const detectedText = startOffsetMs > 0
        ? "Detected " + (detected.beats ? detected.beats + "-beat " : "") + "count-in / intro at " + formatSyncTime(startOffsetMs) +
          (musicalEndMs < durationMs - 250 ? " · ignored trailing audio after " + formatSyncTime(musicalEndMs) : "") + "."
        : "No count-in offset detected.";
      setStatus("Auto sync ready · " + detectedText, "ok");
      toast(startOffsetMs > 0
        ? "Auto sync: score starts at " + formatSyncTime(startOffsetMs) + "."
        : "Auto sync ready. If needed, play the track and use Set Bar to fine-tune.");
    } catch (error) {
      setStatus("Could not auto sync: " + error.message, "warn");
    }
  }

  async function markCurrentAudioAtBar() {
    const song = await getSong(selectedSongId);
    if (!song || !api.score || activeInteractiveSongId !== song.id) return;
    try {
      await ensureBackingAudio(song);
      const totalBars = api.score.masterBars.length;
      const barNumber = Math.max(1, Math.min(totalBars, parseInt(el.syncBar.value || "1", 10)));
      const point = {
        barIndex: barNumber - 1,
        barOccurence: 0,
        barPosition: 0,
        millisecondOffset: Math.round((Number(el.audio.currentTime) || 0) * 1000)
      };
      const points = normalizeSyncPoints(song.syncPoints).filter((p) => !(p.barIndex === point.barIndex && p.barPosition < 0.001));
      points.push(point);
      song.syncPoints = normalizeSyncPoints(points);
      await putSong(song);
      if (backingModeActive) applySongSyncPoints(song);
      await refreshCache();
      setStatus("Synced bar " + barNumber + " to " + formatSyncTime(point.millisecondOffset) + ".", "ok");
    } catch (error) {
      setStatus("Could not add sync point: " + error.message, "warn");
    }
  }

  async function clearSongSyncPoints() {
    const song = await getSong(selectedSongId);
    if (!song) return;
    if (!confirm("Clear all backing-track sync points for " + song.title + "?")) return;
    song.syncPoints = [];
    await putSong(song);
    if (backingModeActive) {
      backingModeActive = false;
      clearAppliedSyncPoints();
      stopBackingSyncTimer();
      el.audio.pause();
    }
    backingLoopEnabled = false;
    await refreshCache();
    updateSourceUI();
    setStatus("Sync points cleared.", "ok");
  }

  function updateSourceUI() {
    el.synthMode.classList.toggle("active-source", !backingModeActive);
    el.backingMode.classList.toggle("active-source", backingModeActive);
    if (backingModeActive) {
      el.audioModeNote.textContent = "Synced Backing mode: the real MP3/WAV drives the notation cursor.";
      el.countIn.disabled = true;
      el.metro.disabled = true;
      el.speed.disabled = !playerReady;
    } else {
      el.audioModeNote.textContent = "Synth mode. Switch to Synced Backing after creating sync points.";
      el.countIn.disabled = !playerReady;
      el.metro.disabled = !playerReady;
      el.speed.disabled = !playerReady;
    }
    const song = selectedSong();
    if (song) renderSyncPanel(song);
  }

  async function useBackingMode() {
    let song = await getSong(selectedSongId);
    if (!song || !song.interactive || !song.audio) return;
    if (activeInteractiveSongId !== song.id || !api.score) {
      await loadInteractiveAsset(song);
      setStatus("Interactive score loading. Press Synced Backing again when ready.", "warn");
      return;
    }
    try {
      await ensureBackingAudio(song);
      if (normalizeSyncPoints(song.syncPoints).length < 2) {
        setStatus("No sync map yet · detecting count-in and syncing automatically…");
        await autoSyncWholeSong();
        song = await getSong(selectedSongId);
      }
      if (!song || normalizeSyncPoints(song.syncPoints).length < 2) throw new Error("At least two sync points are required.");
      if (scorePlaying) {
        try { api.playPause(); } catch (e) {}
      }
      backingModeActive = true;
      applySongSyncPoints(song);
      updateSourceUI();
      syncCursorFromBacking();
      if (!el.audio.paused) startBackingCursorDriver();
      setStatus("Synced Backing mode ready · " + song.title, "ok");
    } catch (error) {
      backingModeActive = false;
      updateSourceUI();
      setStatus("Could not enable synced backing: " + error.message, "warn");
    }
  }

  function useSynthMode() {
    stopBackingSyncTimer();
    el.audio.pause();
    pauseBackingCursorDriver(true);
    backingModeActive = false;
    backingLoopEnabled = false;
    clearAppliedSyncPoints();
    updateSourceUI();
    setStatus("Synth mode ready.", "ok");
  }

  function stopBackingSyncTimer() {
    if (backingSyncTimer) {
      clearInterval(backingSyncTimer);
      backingSyncTimer = null;
    }
  }

  function backingStartAudioMs() {
    return backingSyncMap.length ? Math.max(0,Number(backingSyncMap[0].audioMs)||0) : 0;
  }

  function backingIsInPreRoll(audioMs) {
    const startMs=backingStartAudioMs();
    return startMs>0 && Math.max(0,Number(audioMs)||0) < startMs;
  }

  function freezeBackingCursorAtStart() {
    if (!api || !api.score || !backingSyncMap.length) return;
    if (!backingPreRollFrozen) {
      pauseBackingCursorDriver(false);
      try { api.masterVolume = 0; } catch (error) {}
      try { api.tickPosition = backingSyncMap[0].scoreTick; } catch (error) {}
      backingPreRollFrozen = true;
    }
  }

  function startBackingCursorDriver() {
    if (!backingModeActive || !api || !playerReady) return;
    try {
      if (!backingCursorDriverActive) {
        synthVolumeBeforeBacking = Number.isFinite(Number(api.masterVolume))
          ? Number(api.masterVolume)
          : 1;
      }
      api.masterVolume = 0;
      const audioMs = (Number(el.audio.currentTime) || 0) * 1000;
      if (backingIsInPreRoll(audioMs)) {
        freezeBackingCursorAtStart();
        return;
      }
      backingPreRollFrozen = false;
      api.tickPosition = scoreTickFromBackingAudio(audioMs);
      if (!scorePlaying && typeof api.play === "function") api.play();
      backingCursorDriverActive = true;
    } catch (error) {
      console.warn("Could not start backing cursor driver", error);
    }
  }

  function pauseBackingCursorDriver(restoreVolume) {
    if (!api) return;
    try {
      if (scorePlaying && typeof api.pause === "function") api.pause();
    } catch (error) {}
    backingCursorDriverActive = false;
    if (restoreVolume) {
      try { api.masterVolume = synthVolumeBeforeBacking; } catch (error) {}
      backingPreRollFrozen = false;
    }
  }

  function scoreTickAtBarStart(barIndex) {
    if (!api || !api.score || !api.score.masterBars || !api.score.masterBars.length) return 0;
    const index = Math.max(0, Math.min(api.score.masterBars.length - 1, barIndex));
    try {
      const lookup = playbackLookupForPoint({barIndex:index,barOccurence:0,barPosition:0});
      if (lookup) return Math.max(0, Number(lookup.start) || 0);
      return Math.max(0, Number(masterBarPlaybackStart(api.score.masterBars[index])) || 0);
    } catch (error) {
      return 0;
    }
  }

  function updateBackingLoopTimes(startBar, endBar) {
    if (!backingModeActive || !api.score) return;
    const startScoreTick = scoreTickAtBarStart(startBar - 1);
    const endScoreTick = endBar < api.score.masterBars.length
      ? scoreTickAtBarStart(endBar)
      : scoreTickForSyncPoint({
          barIndex:api.score.masterBars.length-1,
          barOccurence:finalBarOccurrence(api.score.masterBars.length-1),
          barPosition:1
        });
    backingLoopStartMs = backingAudioTimeFromScoreTick(startScoreTick);
    backingLoopEndMs = backingAudioTimeFromScoreTick(endScoreTick);
    if (backingLoopEndMs <= backingLoopStartMs) {
      backingLoopStartMs = 0;
      backingLoopEndMs = (Number(el.audio.duration) || 0) * 1000;
    }
  }

  function syncCursorFromBacking() {
    if (!backingModeActive || !api || !api.score) return;

    const audioMs = Math.max(0,(Number(el.audio.currentTime) || 0) * 1000);
    const durationMs = Math.max(0,(Number(el.audio.duration) || 0) * 1000);

    // Keep the user-facing clock alive even if score mapping fails. This also
    // gives the Phase 7/8 shell a reliable DOM mutation to mirror.
    el.position.textContent = fmt(audioMs) + " / " + fmt(durationMs);
    updateSyncCurrentTime();

    let scoreTick = 0;
    try {
      scoreTick = scoreTickFromBackingAudio(audioMs);
      if (backingIsInPreRoll(audioMs)) {
        // During count-in / intro, park the cursor once at bar 1. Re-seeking the
        // same tick every 50 ms makes alphaTab's cursor visibly vibrate.
        freezeBackingCursorAtStart();
      } else {
        backingPreRollFrozen = false;
        if (Number.isFinite(scoreTick)) api.tickPosition = scoreTick;
        if (!el.audio.paused && !backingCursorDriverActive) startBackingCursorDriver();
      }
    } catch (error) {
      console.warn("Backing cursor update failed",error);
    }

    window.dispatchEvent(new CustomEvent("dtmtp:backing-position",{
      detail:{
        audioMs,
        durationMs,
        scoreTick:Number.isFinite(scoreTick)?scoreTick:0,
        actualTick:Number(api.tickPosition)||0,
        playing:!el.audio.paused
      }
    }));

    if (backingLoopEnabled && backingLoopEndMs > backingLoopStartMs && audioMs >= backingLoopEndMs - 20) {
      el.audio.currentTime = backingLoopStartMs / 1000;
      try { api.tickPosition = scoreTickFromBackingAudio(backingLoopStartMs); } catch (error) {}
    }
  }

  function startBackingSyncTimer() {
    stopBackingSyncTimer();
    syncCursorFromBacking();
    backingSyncTimer = setInterval(syncCursorFromBacking, 50);
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

  // alphaTab intentionally draws voices after voice 1 with a translucent
  // secondary color. Drum notation commonly uses voice 1 for cymbals and voice 2
  // for kick/snare, so that default makes the lower kit notes look disabled.
  // Use the primary notation color for every voice to match normal drum-score engraving.
  if (api.settings && api.settings.display && api.settings.display.resources) {
    api.settings.display.resources.secondaryGlyphColor = api.settings.display.resources.mainGlyphColor;
  }

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
    api.isLooping = !backingModeActive;
    backingLoopEnabled = backingModeActive;
    if (backingModeActive) updateBackingLoopTimes(startBar, endBar);
    el.loop.classList.add("active");
    el.loopStatus.textContent = "Looping bars " + startBar + "–" + endBar + (backingModeActive ? " with backing track." : ".");

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
    backingLoopEnabled = false;
    backingLoopStartMs = 0;
    backingLoopEndMs = 0;
    el.loop.classList.remove("active");
    el.loopStatus.textContent = "No loop range set.";
    try { api.clearPlaybackRangeHighlight(); } catch (e) {}
  }

  async function loadInteractiveAsset(song) {
    if (!song || !song.interactive || !song.interactive.blob) return;
    resetTransportState();
    stopBackingSyncTimer();
    el.audio.pause();
    backingModeActive = false;
    backingLoopEnabled = false;
    activeInteractiveSongId = song.id;
    currentFilename = song.interactive.name;
    el.alpha.style.display = "block";
    el.empty.style.display = "none";
    el.loading.style.display = "flex";
    setStatus("Loading " + song.interactive.name + "…");

    try {
      const prepared = await prepareInteractiveForAlphaTab(song.interactive);
      pendingInteractiveIsMusicXml = !!prepared.isMusicXml;
      pendingMusicXmlSystemBreaks = Array.isArray(prepared.systemBreaks) ? prepared.systemBreaks.slice() : [];
      const accepted = api.load(prepared.bytes);
      if (!accepted) {
        throw new Error("alphaTab did not recognise this interactive score. MuseScore .mscz files must be exported as MusicXML first.");
      }
      el.viewerTitle.textContent = song.title;
      el.viewerMeta.textContent = "Interactive score · " + song.interactive.name +
        (prepared.percussionFixes ? " · Drum notation compatibility applied" : "");
      if (prepared.percussionFixes) {
        toast("Drum score fixed · restored " + prepared.percussionFixes + " normal notehead" + (prepared.percussionFixes === 1 ? "" : "s") + ".");
      }
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
    pendingInteractiveIsMusicXml = false;
    pendingMusicXmlSystemBreaks = [];
    if (api && api.settings && api.settings.display) {
      api.settings.display.systemsLayoutMode = alphaTab.SystemsLayoutMode
        ? alphaTab.SystemsLayoutMode.Automatic
        : 0;
    }
    resetTransportState();
    backingModeActive = false;
    backingLoopEnabled = false;
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
    naturalScoreEndMs = 0;
    const isMusicXml = pendingInteractiveIsMusicXml;
    const forcedSystemBreaks = pendingMusicXmlSystemBreaks.slice();
    pendingInteractiveIsMusicXml = false;
    pendingMusicXmlSystemBreaks = [];
    if (forcedSystemBreaks.length && score && Array.isArray(score.tracks)) {
      score.tracks.forEach((track) => {
        forcedSystemBreaks.forEach((breakIndex) => {
          if (typeof track.addLineBreaks === "function") track.addLineBreaks(breakIndex);
          else {
            if (!track.lineBreaks) track.lineBreaks = new Set();
            track.lineBreaks.add(breakIndex);
          }
        });
      });
    }

    const appliedLayout = isMusicXml ? applyMusicXmlModelLayout(score, forcedSystemBreaks) : null;
    if (!isMusicXml && api && api.settings && api.settings.display) {
      api.settings.display.systemsLayoutMode = alphaTab.SystemsLayoutMode
        ? alphaTab.SystemsLayoutMode.Automatic
        : 0;
    }

    el.alpha.style.display = "block";
    el.empty.style.display = "none";
    const fallbackSong = activeInteractiveSongId === "__sample__" ? null : songsCache.find((s) => s.id === activeInteractiveSongId);
    el.songTitle.textContent = score.title || (fallbackSong && fallbackSong.title) || currentFilename.replace(/\.[^.]+$/, "") || "Untitled score";
    el.songArtist.textContent = score.artist || score.album || "Unknown artist";

    const trackCount = score.tracks ? score.tracks.length : 0;
    const barCount = score.masterBars ? score.masterBars.length : 0;
    el.songMeta.textContent = trackCount + " track" + (trackCount === 1 ? "" : "s") +
      " · " + barCount + " bar" + (barCount === 1 ? "" : "s") +
      (appliedLayout ? " · Score layout " + appliedLayout.layout.join("+") : "");

    el.loopStart.max = String(Math.max(1, barCount));
    el.loopEnd.max = String(Math.max(1, barCount));
    el.loopStart.value = "1";
    el.loopEnd.value = String(Math.min(4, Math.max(1, barCount)));
    renderTrackButtons(score);
    el.applyLoop.disabled = false;
    el.clearLoop.disabled = false;
    el.syncBar.max = String(Math.max(1, barCount));
    const loadedSong = activeInteractiveSongId === "__sample__" ? null : songsCache.find((s) => s.id === activeInteractiveSongId);
    if (backingModeActive && loadedSong) applySongSyncPoints(loadedSong);
    renderSyncPanel(loadedSong || selectedSong());
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
    if (!backingModeActive) naturalScoreEndMs = Math.max(0, Number(api.endTime) || 0);
    [el.stop, el.play, el.countIn, el.metro, el.loop, el.speed].forEach((node) => node.disabled = false);
    updateSourceUI();
    renderSyncPanel(selectedSong());
    setStatus("Interactive score ready.", "ok");
  });

  api.playerStateChanged.on((event) => {
    scorePlaying = event.state === alphaTab.synth.PlayerState.Playing;
    if (!backingModeActive) el.play.textContent = scorePlaying ? "Ⅱ" : "▶";
    if (!backingModeActive && scorePlaying && !el.audio.paused) el.audio.pause();
  });

  api.playerPositionChanged.on((event) => {
    if (!backingModeActive) el.position.textContent = fmt(event.currentTime) + " / " + fmt(event.endTime);
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
          syncPoints: normalizeSyncPoints(song.syncPoints),
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

      if (!confirm("Import this DT Music Trainer Pro library backup?\n\nThis replaces the current local cache on this device. Existing cloud Library songs are not automatically deleted; restored songs will sync to Google Drive.")) {
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
          audio: null,
          syncPoints: normalizeSyncPoints(meta.syncPoints)
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

  el.play.onclick = async () => {
    if (!playerReady) return;
    if (backingModeActive) {
      const song = await getSong(selectedSongId);
      if (!song) return;
      try {
        await ensureBackingAudio(song);
        if (el.audio.paused) await el.audio.play();
        else el.audio.pause();
      } catch (error) {
        setStatus("Could not play synced backing: " + error.message, "warn");
      }
      return;
    }
    if (!el.audio.paused) el.audio.pause();
    api.playPause();
  };
  el.stop.onclick = () => {
    if (!playerReady) return;
    if (backingModeActive) {
      el.audio.pause();
      el.audio.currentTime = backingLoopEnabled && backingLoopEndMs > backingLoopStartMs ? backingLoopStartMs / 1000 : 0;
      syncCursorFromBacking();
      el.play.textContent = "▶";
    } else {
      api.stop();
    }
  };
  el.countIn.onclick = () => {
    if (backingModeActive) return;
    el.countIn.classList.toggle("active");
    api.countInVolume = el.countIn.classList.contains("active") ? 1 : 0;
  };
  el.metro.onclick = () => {
    if (backingModeActive) return;
    el.metro.classList.toggle("active");
    api.metronomeVolume = el.metro.classList.contains("active") ? 1 : 0;
  };
  el.loop.onclick = () => {
    if (backingModeActive) {
      backingLoopEnabled = !backingLoopEnabled;
      el.loop.classList.toggle("active", backingLoopEnabled);
      if (!backingLoopStartMs && !backingLoopEndMs && backingLoopEnabled) {
        backingLoopStartMs = 0;
        backingLoopEndMs = (Number(el.audio.duration) || 0) * 1000;
        el.loopStatus.textContent = "Looping the whole backing track.";
      } else {
        el.loopStatus.textContent = backingLoopEnabled ? "Backing-track loop enabled." : "Backing-track loop paused.";
      }
      return;
    }
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
    if (backingModeActive) el.audio.playbackRate = value / 100;
    else api.playbackSpeed = value / 100;
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
  el.synthMode.onclick = useSynthMode;
  el.backingMode.onclick = useBackingMode;
  el.autoSync.onclick = autoSyncWholeSong;
  el.markSync.onclick = markCurrentAudioAtBar;
  el.clearSync.onclick = clearSongSyncPoints;

  el.audio.addEventListener("play", () => {
    if (backingModeActive) {
      el.play.textContent = "Ⅱ";
      const audioMs=(Number(el.audio.currentTime)||0)*1000;
      if (backingIsInPreRoll(audioMs)) freezeBackingCursorAtStart();
      else startBackingCursorDriver();
      startBackingSyncTimer();
      setStatus(backingIsInPreRoll(audioMs)
        ? "Count-in / intro playing · score will start automatically."
        : "Synced backing playing.", "ok");
    } else if (scorePlaying) {
      try { api.pause(); } catch (e) {}
    }
  });

  // Native media events are a second, browser-driven clock source. The interval
  // remains for smooth cursor motion, while timeupdate/seeked guarantee progress
  // even if a timer is throttled or interrupted by the surrounding application shell.
  el.audio.addEventListener("timeupdate", () => {
    if (backingModeActive) syncCursorFromBacking();
  });
  el.audio.addEventListener("seeked", () => {
    if (backingModeActive) syncCursorFromBacking();
  });
  el.audio.addEventListener("pause", () => {
    if (backingModeActive) {
      el.play.textContent = "▶";
      stopBackingSyncTimer();
      syncCursorFromBacking();
      pauseBackingCursorDriver(false);
    }
  });
  el.audio.addEventListener("ended", () => {
    if (backingModeActive) {
      el.play.textContent = "▶";
      stopBackingSyncTimer();
      syncCursorFromBacking();
      pauseBackingCursorDriver(false);
    }
  });
  el.audio.addEventListener("timeupdate", () => {
    updateSyncCurrentTime();
    if (backingModeActive && !backingSyncTimer) syncCursorFromBacking();
  });
  el.audio.addEventListener("seeked", () => {
    updateSyncCurrentTime();
    if (backingModeActive) syncCursorFromBacking();
  });
  el.audio.addEventListener("ratechange", () => {
    if (backingModeActive) {
      const pct = Math.round(el.audio.playbackRate * 100);
      el.speed.value = String(Math.max(25, Math.min(150, pct)));
      el.speedValue.textContent = pct + "%";
    }
  });
  el.audioStop.onclick = () => {
    el.audio.pause();
    el.audio.currentTime = backingModeActive && backingLoopEnabled ? backingLoopStartMs / 1000 : 0;
    if (backingModeActive) syncCursorFromBacking();
  };

  window.addEventListener("beforeunload", revokeBackingUrl);

  async function createSongWithAssets(input) {
    const value=input||{};
    let title=String(value.title||"").trim();
    if(!title && value.interactiveFile){
      title=exactInteractiveTitle(value.interactiveFile);
    }
    if(!title) throw new Error("Enter a song title.");

    const song={
      id:makeId(),
      title,
      createdAt:Date.now(),
      updatedAt:Date.now(),
      interactive:null,
      pdf:null,
      audio:null,
      syncPoints:[]
    };

    const supplied=[
      ["interactive",value.interactiveFile],
      ["pdf",value.pdfFile],
      ["audio",value.audioFile]
    ];
    for(const [kind,file] of supplied){
      if(!file) continue;
      const actual=classifyFile(file);
      if(actual!==kind) throw new Error("The selected "+assetLabel(kind).toLowerCase()+" file is not supported.");
      song[kind]=makeAsset(file);
    }

    await putSong(song);
    selectedSongId=song.id;
    localStorage.setItem("dtmtp-selected-song",song.id);
    await refreshCache();
    setStatus("Created "+song.title,"ok");
    return await getSong(song.id);
  }

  async function renameSongById(id,title) {
    const song=await getSong(id);
    if(!song) throw new Error("Song not found.");
    const next=String(title||"").trim();
    if(!next) throw new Error("Enter a song title.");
    song.title=next;
    await putSong(song);
    selectedSongId=song.id;
    localStorage.setItem("dtmtp-selected-song",song.id);
    await refreshCache();
    setStatus("Song renamed.","ok");
    return await getSong(song.id);
  }

  async function replaceSongAsset(id,kind,file) {
    if(!["interactive","pdf","audio"].includes(kind)) throw new Error("Unsupported asset type.");
    if(!file) throw new Error("Choose a file.");
    const actual=classifyFile(file);
    if(actual!==kind) throw new Error("That file is not a supported "+assetLabel(kind).toLowerCase()+".");
    const song=await getSong(id);
    if(!song) throw new Error("Song not found.");
    song[kind]=makeAsset(file);
    if(kind==="interactive"||kind==="audio") song.syncPoints=[];
    await putSong(song);
    selectedSongId=song.id;
    localStorage.setItem("dtmtp-selected-song",song.id);
    await refreshCache();
    setStatus(assetLabel(kind)+" replaced.","ok");
    return await getSong(song.id);
  }

  async function deleteSongById(id) {
    const song=await getSong(id);
    if(!song) return false;
    if(activeInteractiveSongId===song.id){
      try{api.stop();}catch(error){}
      showEmpty("Interactive Score","Choose another song from the library.");
    }
    stopBackingAudio();
    await removeSong(song.id);
    if(selectedSongId===song.id){
      selectedSongId="";
      localStorage.removeItem("dtmtp-selected-song");
    }
    await refreshCache();
    setStatus("Song deleted.","ok");
    return true;
  }

  async function selectSongById(id) {
    const song=await getSong(id);
    if(!song) throw new Error("Song not found.");
    selectSong(id);
    return song;
  }

  async function openInteractiveById(id) {
    await selectSongById(id);
    return await openSelectedInteractive();
  }

  async function openPdfById(id) {
    await selectSongById(id);
    return await openSelectedPdf();
  }

  async function playAudioById(id) {
    await selectSongById(id);
    return await playSelectedAudio();
  }

  window.DTMusicTrainerLibrary = {
    getSong,
    getAllSongs:allSongs,
    refresh:refreshCache,
    getSelectedSongId:()=>selectedSongId,
    selectSong:selectSongById,
    addFiles:(files,forceSongId)=>addFilesToLibrary(files,forceSongId||""),
    createSong:createSongWithAssets,
    renameSong:renameSongById,
    replaceAsset:replaceSongAsset,
    deleteSong:deleteSongById,
    openInteractive:openInteractiveById,
    openPdf:openPdfById,
    playAudio:playAudioById,
    stopAudio:stopBackingAudio,
    readInteractiveMetadata,
    diagnoseMusicXml:(xmlText)=> {
      const result=normalizePercussionMusicXml(xmlText);
      return {
        changed:result.changed,
        restoredNoteheads:result.restoredNoteheads,
        systemBreaks:Array.isArray(result.systemBreaks)?result.systemBreaks.slice():[]
      };
    },
    diagnoseModelLayout:(score,breaks)=>musicXmlModelLayout(score,breaks||[])
  };

  async function init() {
    try {
      setStatus("Opening local Pro library…");
      await openDatabase();
      await refreshCache();
      showEmpty("DT Music Trainer Pro", "Choose a song from the Library, then open its interactive score to begin.");
      if (selectedSongId) renderSelectedSong();
      updateSourceUI();
      setStatus("Library ready · synced backing available", "ok");
    } catch (error) {
      console.error(error);
      setStatus("Could not open local library: " + error.message, "warn");
    }
  }

  init();
})();
