(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const DB_NAME = "dt-music-trainer-pro";
  const STORE_NAME = "songs";

  const defaults = {
    startBar: 1,
    endBar: 4,
    startSpeed: 60,
    targetSpeed: 100,
    increment: 5,
    repsPerStep: 3,
    countIn: true
  };

  const el = {
    section: $("practiceModeSection"),
    startBar: $("practiceStartBar"),
    endBar: $("practiceEndBar"),
    startSpeed: $("practiceStartSpeed"),
    targetSpeed: $("practiceTargetSpeed"),
    increment: $("practiceIncrement"),
    reps: $("practiceRepsPerStep"),
    countIn: $("practiceCountIn"),
    start: $("practiceStartBtn"),
    retry: $("practiceRetryBtn"),
    reset: $("practiceResetBtn"),
    stop: $("practiceStopBtn"),
    speedNow: $("practiceSpeedNow"),
    repNow: $("practiceRepNow"),
    progress: $("practiceProgressFill"),
    stepText: $("practiceStepText"),
    source: $("practiceSourcePill"),
    status: $("practiceStatus"),
    countdown: $("practiceCountdown"),
    countdownNumber: $("practiceCountdownNumber")
  };

  let currentSongId = "";
  let currentSettings = {...defaults};
  let sessionActive = false;
  let completed = false;
  let currentSpeed = defaults.startSpeed;
  let repsAtStep = 0;
  let totalReps = 0;
  let countdownToken = 0;
  let environmentTimer = null;

  let backingGuardTimer = null;
  let synthMonitorTimer = null;
  let practiceBackingRange = null;
  let lastSynthTick = null;
  let repTransitioning = false;

  function api(){ return window.dtMusicTrainerProAlphaTab || null; }
  function selectedSongId(){ return localStorage.getItem("dtmtp-selected-song") || ""; }
  function isBackingMode(){
    const button = $("backingModeBtn");
    return !!(button && button.classList.contains("active-source"));
  }
  function scoreReady(){
    const a = api();
    const scoreEl = $("alphaTab");
    return !!(a && a.score && Array.isArray(a.score.masterBars) && a.score.masterBars.length && scoreEl && scoreEl.style.display !== "none");
  }
  function barCount(){
    const a = api();
    return a && a.score && Array.isArray(a.score.masterBars) ? a.score.masterBars.length : 0;
  }
  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
  function numberValue(node,fallback){
    const n = Number(node && node.value);
    return Number.isFinite(n) ? n : fallback;
  }
  function settingsKey(songId){ return "dtmtp-practice-v4:" + String(songId || "none"); }

  function normalizeSettings(raw){
    const x = {...defaults,...(raw || {})};
    x.startBar = Math.max(1,Math.round(Number(x.startBar) || 1));
    x.endBar = Math.max(x.startBar,Math.round(Number(x.endBar) || 4));
    x.startSpeed = clamp(Math.round(Number(x.startSpeed) || 60),25,150);
    x.targetSpeed = clamp(Math.round(Number(x.targetSpeed) || 100),25,150);
    if(x.targetSpeed < x.startSpeed) x.targetSpeed = x.startSpeed;
    x.increment = clamp(Math.round(Number(x.increment) || 5),1,25);
    x.repsPerStep = clamp(Math.round(Number(x.repsPerStep) || 3),1,20);
    x.countIn = x.countIn !== false;
    return x;
  }

  function readForm(){
    const maxBars = barCount() || 9999;
    let startBar = clamp(Math.round(numberValue(el.startBar,1)),1,maxBars);
    let endBar = clamp(Math.round(numberValue(el.endBar,startBar)),1,maxBars);
    if(endBar < startBar) [startBar,endBar] = [endBar,startBar];

    let startSpeed = clamp(Math.round(numberValue(el.startSpeed,60)),25,150);
    let targetSpeed = clamp(Math.round(numberValue(el.targetSpeed,100)),25,150);
    if(targetSpeed < startSpeed) targetSpeed = startSpeed;

    return normalizeSettings({
      startBar,
      endBar,
      startSpeed,
      targetSpeed,
      increment: numberValue(el.increment,5),
      repsPerStep: numberValue(el.reps,3),
      countIn: !!el.countIn.checked
    });
  }

  function writeForm(settings){
    const s = normalizeSettings(settings);
    const maxBars = barCount();
    if(maxBars){
      s.startBar = clamp(s.startBar,1,maxBars);
      s.endBar = clamp(s.endBar,s.startBar,maxBars);
    }

    el.startBar.value = String(s.startBar);
    el.endBar.value = String(s.endBar);
    el.startSpeed.value = String(s.startSpeed);
    el.targetSpeed.value = String(s.targetSpeed);
    el.increment.value = String(s.increment);
    el.reps.value = String(s.repsPerStep);
    el.countIn.checked = !!s.countIn;
    currentSettings = s;
  }

  function loadSettings(songId){
    currentSongId = songId || "";
    sessionActive = false;
    completed = false;
    repsAtStep = 0;
    totalReps = 0;
    repTransitioning = false;
    practiceBackingRange = null;
    stopPracticeMonitors();

    let settings = defaults;
    if(currentSongId){
      try{
        const stored = JSON.parse(localStorage.getItem(settingsKey(currentSongId)) || "null");
        if(stored) settings = stored;
      }catch(e){
        console.warn("Practice settings could not be read",e);
      }
    }

    writeForm(settings);
    currentSpeed = currentSettings.startSpeed;
    render();
  }

  function saveSettings(){
    currentSettings = readForm();
    if(!currentSongId) return;
    try{
      localStorage.setItem(settingsKey(currentSongId),JSON.stringify(currentSettings));
    }catch(e){
      console.warn("Practice settings could not be saved",e);
    }
  }

  function sourceText(){ return isBackingMode() ? "Synced Backing" : "Synth"; }

  function setStatus(text,tone){
    if(!el.status) return;
    el.status.textContent = text;
    el.status.classList.toggle("practice-target-done",tone === "done");
  }

  function progressPercent(){
    const s = currentSettings;
    if(completed) return 100;

    const speedSteps = Math.max(1,Math.ceil((s.targetSpeed - s.startSpeed) / s.increment) + 1);
    const currentStep = Math.max(0,Math.round((currentSpeed - s.startSpeed) / s.increment));
    const withinStep = repsAtStep / s.repsPerStep;
    return clamp(((currentStep + withinStep) / speedSteps) * 100,0,99);
  }

  function render(){
    if(!el.section) return;

    const ready = scoreReady();
    const hasSong = !!currentSongId;
    const s = currentSettings;

    el.start.disabled = !hasSong || !ready || sessionActive;
    el.retry.disabled = !sessionActive || completed;
    el.reset.disabled = !hasSong || !ready;
    el.stop.disabled = !sessionActive;
    el.section.classList.toggle("practice-session-active",sessionActive);

    el.speedNow.textContent = Math.round(currentSpeed) + "%";
    el.repNow.textContent = completed ? "Complete" : (repsAtStep + " / " + s.repsPerStep + " reps");
    el.progress.style.width = progressPercent() + "%";
    el.source.textContent = sourceText();
    el.source.classList.toggle("backing",isBackingMode());
    el.source.classList.toggle("synth",!isBackingMode());

    if(completed){
      el.stepText.textContent = "Target reached · " + s.targetSpeed + "% · " + totalReps + " reps completed";
      setStatus("Practice complete. The target speed was reached automatically.","done");
    }else if(sessionActive){
      const next = Math.min(s.targetSpeed,currentSpeed + s.increment);
      el.stepText.textContent =
        "Current " + currentSpeed + "% · rep " + repsAtStep + "/" + s.repsPerStep +
        " · " + (currentSpeed >= s.targetSpeed ? "finish after this set" : "next " + next + "%");
      setStatus("Practice is running. Reps are counted automatically whenever the selected section loops.");
    }else if(!hasSong){
      el.stepText.textContent = "Select a song to begin.";
      setStatus("Select a song first.");
    }else if(!ready){
      el.stepText.textContent = "Open the interactive score first.";
      setStatus("Open the interactive score first. Practice Mode will enable when the score player is ready.");
    }else{
      el.stepText.textContent =
        "Start " + s.startSpeed + "% → target " + s.targetSpeed +
        "% · +" + s.increment + "% every " + s.repsPerStep + " reps";
      setStatus("Ready to practice bars " + s.startBar + "–" + s.endBar + " using " + sourceText() + ".");
    }
  }

  function stopPracticeMonitors(){
    if(backingGuardTimer){
      clearInterval(backingGuardTimer);
      backingGuardTimer = null;
    }
    if(synthMonitorTimer){
      clearInterval(synthMonitorTimer);
      synthMonitorTimer = null;
    }
    lastSynthTick = null;
  }

  function stopMainPlayback(){
    stopPracticeMonitors();

    const audio = $("backingAudio");
    if(audio) audio.pause();

    try{
      const a = api();
      if(a && typeof a.stop === "function") a.stop();
    }catch(e){}

    const stop = $("stopBtn");
    if(stop && !stop.disabled && !isBackingMode()){
      try{ stop.click(); }catch(e){}
    }
  }

  function clearPhase3LoopForBacking(){
    const clear = $("clearLoop");
    if(clear && !clear.disabled){
      try{ clear.click(); }catch(e){}
    }
    const loop = $("loopBtn");
    if(loop) loop.classList.remove("active");
  }

  function showPracticeLoopInMainUI(){
    const start = $("loopStart");
    const end = $("loopEnd");
    const status = $("loopStatus");
    if(start) start.value = String(currentSettings.startBar);
    if(end) end.value = String(currentSettings.endBar);
    if(status){
      status.textContent = "Practice Mode: bars " + currentSettings.startBar + "–" + currentSettings.endBar +
        (isBackingMode() ? " with direct backing-track loop." : ".");
    }
  }

  function applySynthLoop(){
    const start = $("loopStart");
    const end = $("loopEnd");
    const apply = $("applyLoop");
    if(!start || !end || !apply || apply.disabled) return false;

    start.value = String(currentSettings.startBar);
    end.value = String(currentSettings.endBar);
    apply.click();
    return true;
  }

  function applySpeed(){
    const slider = $("speed");
    if(slider && !slider.disabled){
      slider.value = String(clamp(Math.round(currentSpeed),25,150));
      slider.dispatchEvent(new Event("input",{bubbles:true}));
    }

    const audio = $("backingAudio");
    if(audio && isBackingMode()){
      audio.playbackRate = currentSpeed / 100;
    }

    const a = api();
    if(a && !isBackingMode()){
      try{ a.playbackSpeed = currentSpeed / 100; }catch(e){}
    }
  }

  function turnOffAlphaTabCountIn(){
    const button = $("countInBtn");
    if(button && button.classList.contains("active")){
      try{ button.click(); }catch(e){}
    }
  }

  function seekSynthToStart(){
    const a = api();
    if(!a || !a.score || !Array.isArray(a.score.masterBars)) return false;

    try{
      const bar = a.score.masterBars[Math.max(0,currentSettings.startBar - 1)];
      if(a.tickCache && typeof a.tickCache.getMasterBarStart === "function"){
        a.tickPosition = a.tickCache.getMasterBarStart(bar);
        return true;
      }
    }catch(e){
      console.warn("Could not seek synth practice start",e);
    }
    return false;
  }

  function readSongRecord(songId){
    return new Promise((resolve) => {
      if(!songId || !window.indexedDB){
        resolve(null);
        return;
      }

      let request;
      try{
        request = indexedDB.open(DB_NAME);
      }catch(e){
        resolve(null);
        return;
      }

      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const database = request.result;
        try{
          if(!database.objectStoreNames.contains(STORE_NAME)){
            database.close();
            resolve(null);
            return;
          }

          const tx = database.transaction(STORE_NAME,"readonly");
          const get = tx.objectStore(STORE_NAME).get(songId);

          get.onsuccess = () => {
            const value = get.result || null;
            database.close();
            resolve(value);
          };
          get.onerror = () => {
            database.close();
            resolve(null);
          };
        }catch(e){
          try{ database.close(); }catch(_){}
          resolve(null);
        }
      };
    });
  }

  function normalizeSyncPoints(points){
    return (Array.isArray(points) ? points : [])
      .map(point => ({
        barIndex: Math.max(0,Number(point.barIndex) || 0),
        barPosition: Math.max(0,Math.min(1,Number(point.barPosition) || 0)),
        millisecondOffset: Math.max(0,Number(point.millisecondOffset) || 0)
      }))
      .map(point => ({...point,scorePosition:point.barIndex + point.barPosition}))
      .sort((a,b) => a.scorePosition - b.scorePosition || a.millisecondOffset - b.millisecondOffset);
  }

  function interpolateAudioTime(points,scorePosition,durationMs,totalBars){
    const x = Math.max(0,Number(scorePosition) || 0);
    const duration = Math.max(0,Number(durationMs) || 0);
    const bars = Math.max(1,Number(totalBars) || 1);

    if(points.length >= 2){
      if(x <= points[0].scorePosition){
        const a = points[0];
        const b = points[1];
        const span = b.scorePosition - a.scorePosition;
        if(span > 0){
          const value = a.millisecondOffset + ((x - a.scorePosition) / span) * (b.millisecondOffset - a.millisecondOffset);
          return clamp(value,0,duration || Math.max(a.millisecondOffset,b.millisecondOffset));
        }
        return clamp(a.millisecondOffset,0,duration || a.millisecondOffset);
      }

      for(let i=0;i<points.length-1;i++){
        const a = points[i];
        const b = points[i+1];
        if(x >= a.scorePosition && x <= b.scorePosition){
          const span = b.scorePosition - a.scorePosition;
          if(span <= 0) return a.millisecondOffset;
          const ratio = (x - a.scorePosition) / span;
          return clamp(a.millisecondOffset + ratio * (b.millisecondOffset - a.millisecondOffset),0,duration || b.millisecondOffset);
        }
      }

      const a = points[points.length-2];
      const b = points[points.length-1];
      const span = b.scorePosition - a.scorePosition;
      if(span > 0){
        const value = b.millisecondOffset + ((x - b.scorePosition) / span) * (b.millisecondOffset - a.millisecondOffset);
        return clamp(value,0,duration || value);
      }
      return clamp(b.millisecondOffset,0,duration || b.millisecondOffset);
    }

    return duration * clamp(x / bars,0,1);
  }

  function waitForAudioMetadata(audio){
    if(audio && Number.isFinite(audio.duration) && audio.duration > 0) return Promise.resolve();

    return new Promise(resolve => {
      if(!audio){
        resolve();
        return;
      }

      let finished = false;
      const done = () => {
        if(finished) return;
        finished = true;
        audio.removeEventListener("loadedmetadata",done);
        audio.removeEventListener("durationchange",done);
        audio.removeEventListener("error",done);
        resolve();
      };

      audio.addEventListener("loadedmetadata",done,{once:true});
      audio.addEventListener("durationchange",done,{once:true});
      audio.addEventListener("error",done,{once:true});
      setTimeout(done,1500);
    });
  }

  function seekAudio(audio,seconds){
    return new Promise(resolve => {
      if(!audio){
        resolve(false);
        return;
      }

      const target = clamp(Number(seconds) || 0,0,Math.max(0,(Number(audio.duration) || seconds || 0) - 0.001));
      let finished = false;

      const done = () => {
        if(finished) return;
        finished = true;
        audio.removeEventListener("seeked",done);
        resolve(Math.abs((Number(audio.currentTime) || 0) - target) < 0.35);
      };

      audio.addEventListener("seeked",done,{once:true});
      try{
        audio.currentTime = target;
      }catch(e){
        done();
        return;
      }

      setTimeout(done,450);
    });
  }

  async function calculateBackingPracticeRange(){
    const audio = $("backingAudio");
    if(!audio) return null;

    await waitForAudioMetadata(audio);

    const durationMs = Math.max(0,(Number(audio.duration) || 0) * 1000);
    const totalBars = barCount();
    if(!durationMs || !totalBars) return null;

    const song = await readSongRecord(currentSongId);
    const points = normalizeSyncPoints(song && song.syncPoints);

    const startScorePosition = Math.max(0,currentSettings.startBar - 1);
    const endScorePosition = currentSettings.endBar >= totalBars ? totalBars : currentSettings.endBar;

    let startMs = interpolateAudioTime(points,startScorePosition,durationMs,totalBars);
    let endMs = interpolateAudioTime(points,endScorePosition,durationMs,totalBars);

    startMs = clamp(startMs,0,Math.max(0,durationMs - 1));
    endMs = clamp(endMs,startMs + 1,durationMs);

    return {startMs,endMs,durationMs,totalBars};
  }

  async function seekBackingToPracticeStart(){
    const audio = $("backingAudio");
    if(!audio) return false;

    if(!practiceBackingRange){
      practiceBackingRange = await calculateBackingPracticeRange();
    }
    if(!practiceBackingRange) return false;

    audio.pause();
    const okay = await seekAudio(audio,practiceBackingRange.startMs / 1000);

    try{
      const a = api();
      if(a) a.timePosition = practiceBackingRange.startMs;
    }catch(e){}

    return okay;
  }

  function sleep(ms){ return new Promise(resolve => setTimeout(resolve,ms)); }

  function beep(strong){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;

      const ctx = beep.ctx || (beep.ctx = new Ctx());
      if(ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = strong ? 1040 : 780;
      gain.gain.setValueAtTime(0.0001,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12,ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }catch(e){}
  }

  async function countIn(){
    if(!currentSettings.countIn) return true;

    const token = ++countdownToken;
    const beatMs = Math.round(600 * (100 / Math.max(25,currentSpeed)));

    if(el.countdown) el.countdown.classList.add("show");

    for(let beat=1;beat<=4;beat++){
      if(token !== countdownToken) return false;
      if(el.countdownNumber) el.countdownNumber.textContent = String(beat);
      beep(beat === 1);
      await sleep(beatMs);
    }

    if(token === countdownToken && el.countdown) el.countdown.classList.remove("show");
    return token === countdownToken;
  }

  async function playBackingDirectly(){
    const audio = $("backingAudio");
    if(!audio || !practiceBackingRange) return false;

    await seekBackingToPracticeStart();
    audio.playbackRate = currentSpeed / 100;

    try{
      await audio.play();
      return true;
    }catch(error){
      console.warn("Direct backing playback was blocked; using main transport",error);
      const play = $("playBtn");
      if(play && !play.disabled){
        play.click();
        await sleep(120);
        return !audio.paused;
      }
      return false;
    }
  }

  function playSynth(){
    const play = $("playBtn");
    if(!play || play.disabled) return false;
    play.click();
    return true;
  }

  async function registerCompletedRep(){
    if(!sessionActive || completed || repTransitioning) return "ignore";

    repsAtStep++;
    totalReps++;
    render();

    if(repsAtStep < currentSettings.repsPerStep){
      return "continue";
    }

    if(currentSpeed >= currentSettings.targetSpeed){
      completed = true;
      sessionActive = false;
      stopMainPlayback();
      render();
      return "complete";
    }

    repTransitioning = true;
    currentSpeed = Math.min(currentSettings.targetSpeed,currentSpeed + currentSettings.increment);
    repsAtStep = 0;
    render();

    const restarted = await restartAtCurrentSpeed(true);
    repTransitioning = false;

    if(!restarted){
      sessionActive = false;
      render();
      return "failed";
    }

    return "restart";
  }

  function startBackingMonitor(){
    stopPracticeMonitors();

    const audio = $("backingAudio");
    if(!audio || !practiceBackingRange) return;

    let handling = false;

    backingGuardTimer = setInterval(async () => {
      if(handling || !sessionActive || completed || !isBackingMode() || !practiceBackingRange) return;
      if(audio.paused) return;

      const nowMs = (Number(audio.currentTime) || 0) * 1000;
      const startMs = practiceBackingRange.startMs;
      const endMs = practiceBackingRange.endMs;

      if(nowMs < startMs - 120){
        handling = true;
        await seekAudio(audio,startMs / 1000);
        handling = false;
        return;
      }

      if(nowMs >= endMs - 25){
        handling = true;
        const action = await registerCompletedRep();

        if(action === "continue" && sessionActive){
          await seekAudio(audio,startMs / 1000);
          try{
            const a = api();
            if(a) a.timePosition = startMs;
          }catch(e){}
          if(audio.paused){
            try{ await audio.play(); }catch(e){}
          }
        }

        handling = false;
      }
    },35);
  }

  function startSynthMonitor(){
    stopPracticeMonitors();

    const a = api();
    if(!a || !a.playbackRange) return;

    const range = a.playbackRange;
    const startTick = Number(range.startTick);
    const endTick = Number(range.endTick);
    const span = endTick - startTick;
    if(!Number.isFinite(startTick) || !Number.isFinite(endTick) || span <= 0) return;

    lastSynthTick = Number(a.tickPosition);

    synthMonitorTimer = setInterval(async () => {
      if(repTransitioning || !sessionActive || completed || isBackingMode()) return;

      const tick = Number(a.tickPosition);
      if(!Number.isFinite(tick)){
        lastSynthTick = tick;
        return;
      }

      if(Number.isFinite(lastSynthTick)){
        const wrapped =
          lastSynthTick > startTick + span * 0.55 &&
          tick < lastSynthTick - span * 0.35 &&
          tick <= startTick + span * 0.35;

        if(wrapped){
          await registerCompletedRep();
        }
      }

      lastSynthTick = Number(a.tickPosition);
    },45);
  }

  async function restartAtCurrentSpeed(withCountIn){
    if(!sessionActive || completed) return false;

    countdownToken++;
    if(el.countdown) el.countdown.classList.remove("show");
    stopPracticeMonitors();

    const audio = $("backingAudio");
    if(audio) audio.pause();

    try{
      const a = api();
      if(a && typeof a.stop === "function" && !isBackingMode()) a.stop();
    }catch(e){}

    applySpeed();

    if(isBackingMode()){
      clearPhase3LoopForBacking();
      showPracticeLoopInMainUI();
      practiceBackingRange = await calculateBackingPracticeRange();
      if(!practiceBackingRange){
        setStatus("Could not calculate the backing-track bar range. Reopen Synced Backing and try again.");
        return false;
      }

      const sought = await seekBackingToPracticeStart();
      if(!sought){
        setStatus("Could not seek the backing track to bar " + currentSettings.startBar + ".");
        return false;
      }
    }else{
      const loopOkay = applySynthLoop();
      if(!loopOkay){
        setStatus("Could not apply the selected bar loop.");
        return false;
      }

      if(!seekSynthToStart()){
        setStatus("Could not seek the synth to bar " + currentSettings.startBar + ".");
        return false;
      }
    }

    turnOffAlphaTabCountIn();

    if(withCountIn){
      const okay = await countIn();
      if(!okay || !sessionActive) return false;
    }

    if(isBackingMode()){
      const soughtAgain = await seekBackingToPracticeStart();
      if(!soughtAgain) return false;

      const played = await playBackingDirectly();
      if(!played){
        setStatus("Backing track could not start. Press Synced Backing again, then Start Practice.");
        return false;
      }

      startBackingMonitor();
      return true;
    }

    seekSynthToStart();
    if(!playSynth()) return false;
    await sleep(120);
    startSynthMonitor();
    return true;
  }

  async function startPractice(){
    if(!currentSongId){
      setStatus("Select a song first.");
      return;
    }
    if(!scoreReady()){
      setStatus("Open the interactive score before starting Practice Mode.");
      return;
    }

    currentSettings = readForm();
    saveSettings();
    currentSpeed = currentSettings.startSpeed;
    repsAtStep = 0;
    totalReps = 0;
    completed = false;
    sessionActive = true;
    repTransitioning = false;
    practiceBackingRange = null;
    render();

    const started = await restartAtCurrentSpeed(true);
    if(!started && sessionActive){
      sessionActive = false;
      stopPracticeMonitors();
      render();
    }
  }

  async function restartCurrentStep(){
    if(!sessionActive || completed) return;

    repsAtStep = 0;
    render();

    const restarted = await restartAtCurrentSpeed(true);
    if(!restarted){
      sessionActive = false;
      render();
    }
  }

  function resetPractice(){
    if(!scoreReady()) return;

    countdownToken++;
    if(el.countdown) el.countdown.classList.remove("show");
    stopMainPlayback();

    currentSettings = readForm();
    saveSettings();
    currentSpeed = currentSettings.startSpeed;
    repsAtStep = 0;
    totalReps = 0;
    completed = false;
    sessionActive = false;
    repTransitioning = false;
    practiceBackingRange = null;
    render();
  }

  function stopPractice(){
    countdownToken++;
    if(el.countdown) el.countdown.classList.remove("show");
    sessionActive = false;
    repTransitioning = false;
    stopMainPlayback();
    practiceBackingRange = null;
    render();
  }

  function onSettingChange(){
    currentSettings = readForm();
    writeForm(currentSettings);
    if(!sessionActive) currentSpeed = currentSettings.startSpeed;
    practiceBackingRange = null;
    saveSettings();
    render();
  }

  function bind(){
    const required = Object.entries(el)
      .filter(([key,node]) => key !== "countdown" && key !== "countdownNumber" && !node);

    if(required.length){
      console.error("Practice Mode missing UI elements:",required.map(([key]) => key));
      return false;
    }

    [el.startBar,el.endBar,el.startSpeed,el.targetSpeed,el.increment,el.reps]
      .forEach(node => node.addEventListener("change",onSettingChange));

    el.countIn.addEventListener("change",onSettingChange);
    el.start.addEventListener("click",startPractice);
    el.retry.addEventListener("click",restartCurrentStep);
    el.reset.addEventListener("click",resetPractice);
    el.stop.addEventListener("click",stopPractice);

    [$("synthModeBtn"),$("backingModeBtn")].filter(Boolean).forEach(button => {
      button.addEventListener("click",() => {
        if(sessionActive) stopPractice();
        setTimeout(render,100);
      });
    });

    return true;
  }

  function environmentCheck(){
    const id = selectedSongId();
    if(id !== currentSongId){
      countdownToken++;
      if(sessionActive) stopMainPlayback();
      loadSettings(id);
    }

    const count = barCount();
    if(count){
      el.startBar.max = String(count);
      el.endBar.max = String(count);

      if(Number(el.startBar.value) > count || Number(el.endBar.value) > count){
        currentSettings = readForm();
        writeForm(currentSettings);
        saveSettings();
      }
    }

    render();
  }

  function selfTest(){
    const missing = Object.entries(el)
      .filter(([key,node]) => key !== "countdown" && key !== "countdownNumber" && !node)
      .map(([key]) => key);

    return {
      uiComplete: missing.length === 0,
      missing,
      songSelected: !!selectedSongId(),
      alphaTabAvailable: !!api(),
      scoreReady: scoreReady(),
      barCount: barCount(),
      source: sourceText(),
      startButtonEnabled: !!(el.start && !el.start.disabled),
      automaticRepCounting: true,
      backingRange: practiceBackingRange ? {...practiceBackingRange} : null
    };
  }

  function init(){
    if(!el.section) return;

    if(!bind()){
      setStatus("Practice Mode failed to initialize because required controls are missing.");
      return;
    }

    loadSettings(selectedSongId());
    environmentTimer = setInterval(environmentCheck,400);
    environmentCheck();
    console.info("DT Music Trainer Pro Practice Mode self-test",selfTest());
  }

  window.DTMusicTrainerPractice = {
    start: startPractice,
    retry: restartCurrentStep,
    reset: resetPractice,
    stop: stopPractice,
    selfTest,
    getState: () => ({
      sessionActive,
      completed,
      currentSpeed,
      repsAtStep,
      totalReps,
      settings: {...currentSettings},
      source: sourceText(),
      backingRange: practiceBackingRange ? {...practiceBackingRange} : null
    })
  };

  init();
})();