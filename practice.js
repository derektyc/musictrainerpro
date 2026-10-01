(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const DB_NAME = "dt-music-trainer-pro";
  const DB_VERSION = 1;
  const STORE = "songs";
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
    success: $("practiceSuccessBtn"),
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

  let db = null;
  let currentSongId = "";
  let currentSettings = {...defaults};
  let sessionActive = false;
  let currentSpeed = defaults.startSpeed;
  let repsAtStep = 0;
  let totalSuccessfulReps = 0;
  let completed = false;
  let saveTimer = null;
  let pollTimer = null;
  let countdownToken = 0;

  function api(){ return window.dtMusicTrainerProAlphaTab || null; }
  function selectedSongId(){ return localStorage.getItem("dtmtp-selected-song") || ""; }
  function isBackingMode(){
    const button = $("backingModeBtn");
    return !!(button && button.classList.contains("active-source"));
  }
  function scoreReady(){
    const a = api();
    const scoreEl = $("alphaTab");
    return !!(a && a.score && a.score.masterBars && a.score.masterBars.length && scoreEl && scoreEl.style.display !== "none");
  }
  function barCount(){
    const a = api();
    return a && a.score && a.score.masterBars ? a.score.masterBars.length : 0;
  }
  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
  function num(node,fallback){ const n=Number(node && node.value); return Number.isFinite(n)?n:fallback; }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const database=req.result;
        if(!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE,{keyPath:"id"});
      };
      req.onsuccess=()=>{db=req.result;resolve(db);};
      req.onerror=()=>reject(req.error);
    });
  }
  function request(req){
    return new Promise((resolve,reject)=>{
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function getSong(id){
    if(!db||!id)return null;
    const tx=db.transaction(STORE,"readonly");
    return await request(tx.objectStore(STORE).get(id));
  }
  async function putSong(song){
    if(!db||!song)return;
    song.updatedAt=Date.now();
    const tx=db.transaction(STORE,"readwrite");
    await request(tx.objectStore(STORE).put(song));
  }

  function normalizeSettings(raw){
    const x={...defaults,...(raw||{})};
    x.startBar=Math.max(1,Math.round(Number(x.startBar)||1));
    x.endBar=Math.max(x.startBar,Math.round(Number(x.endBar)||4));
    x.startSpeed=clamp(Math.round(Number(x.startSpeed)||60),25,150);
    x.targetSpeed=clamp(Math.round(Number(x.targetSpeed)||100),25,150);
    if(x.targetSpeed<x.startSpeed)x.targetSpeed=x.startSpeed;
    x.increment=clamp(Math.round(Number(x.increment)||5),1,25);
    x.repsPerStep=clamp(Math.round(Number(x.repsPerStep)||3),1,20);
    x.countIn=x.countIn!==false;
    return x;
  }

  function readForm(){
    const maxBars=barCount()||9999;
    let startBar=clamp(Math.round(num(el.startBar,1)),1,maxBars);
    let endBar=clamp(Math.round(num(el.endBar,startBar)),1,maxBars);
    if(endBar<startBar)[startBar,endBar]=[endBar,startBar];
    let startSpeed=clamp(Math.round(num(el.startSpeed,60)),25,150);
    let targetSpeed=clamp(Math.round(num(el.targetSpeed,100)),25,150);
    if(targetSpeed<startSpeed)targetSpeed=startSpeed;
    return normalizeSettings({
      startBar,endBar,startSpeed,targetSpeed,
      increment:num(el.increment,5),
      repsPerStep:num(el.reps,3),
      countIn:!!el.countIn.checked
    });
  }

  function writeForm(settings){
    const s=normalizeSettings(settings);
    const maxBars=barCount();
    if(maxBars){
      s.startBar=clamp(s.startBar,1,maxBars);
      s.endBar=clamp(s.endBar,s.startBar,maxBars);
    }
    el.startBar.value=String(s.startBar);
    el.endBar.value=String(s.endBar);
    el.startSpeed.value=String(s.startSpeed);
    el.targetSpeed.value=String(s.targetSpeed);
    el.increment.value=String(s.increment);
    el.reps.value=String(s.repsPerStep);
    el.countIn.checked=!!s.countIn;
    currentSettings=s;
  }

  async function loadSettingsForSong(id){
    currentSongId=id||"";
    sessionActive=false;
    completed=false;
    repsAtStep=0;
    totalSuccessfulReps=0;
    if(!id){
      writeForm(defaults);
      currentSpeed=defaults.startSpeed;
      render();
      return;
    }
    const song=await getSong(id);
    const settings=normalizeSettings(song&&song.practiceSettings);
    writeForm(settings);
    currentSpeed=settings.startSpeed;
    render();
  }

  async function saveSettings(){
    if(!currentSongId||!db)return;
    const song=await getSong(currentSongId);
    if(!song)return;
    const settings=readForm();
    song.practiceSettings=settings;
    await putSong(song);
    currentSettings=settings;
  }

  function scheduleSave(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>saveSettings().catch(console.error),350);
  }

  function sourceText(){ return isBackingMode()?"Synced Backing":"Synth"; }
  function setStatus(text,tone){
    el.status.textContent=text;
    el.status.classList.toggle("practice-target-done",tone==="done");
  }

  function progressPercent(){
    const s=currentSettings;
    if(completed)return 100;
    if(s.targetSpeed<=s.startSpeed){
      return clamp((repsAtStep/s.repsPerStep)*100,0,99);
    }
    const speedFraction=(currentSpeed-s.startSpeed)/(s.targetSpeed-s.startSpeed);
    const stepFraction=(repsAtStep/s.repsPerStep)*(s.increment/Math.max(1,s.targetSpeed-s.startSpeed));
    return clamp((speedFraction+stepFraction)*100,0,99);
  }

  function render(){
    const ready=scoreReady();
    const hasSong=!!currentSongId;
    const s=currentSettings;
    el.start.disabled=!hasSong||!ready;
    el.success.disabled=!sessionActive||completed;
    el.retry.disabled=!sessionActive||completed;
    el.reset.disabled=!hasSong||!ready;
    el.stop.disabled=!sessionActive;
    el.section.classList.toggle("practice-session-active",sessionActive);
    el.speedNow.textContent=Math.round(currentSpeed)+"%";
    el.repNow.textContent=(completed?"Complete":(repsAtStep+" / "+s.repsPerStep+" reps"));
    el.progress.style.width=progressPercent()+"%";
    el.source.textContent=sourceText();
    el.source.classList.toggle("backing",isBackingMode());
    el.source.classList.toggle("synth",!isBackingMode());
    if(completed){
      el.stepText.textContent="Target reached · "+s.targetSpeed+"% · "+totalSuccessfulReps+" successful reps this session";
      setStatus("Target speed completed. Nice — this section is cleared for the session.","done");
    }else if(sessionActive){
      const next=Math.min(s.targetSpeed,currentSpeed+s.increment);
      el.stepText.textContent="Current "+currentSpeed+"% · next "+(currentSpeed>=s.targetSpeed?"finish":next+"%")+" · "+totalSuccessfulReps+" successful reps total";
      setStatus("Tap Successful Rep after a clean run. Retry restarts the section without adding a rep.");
    }else{
      el.stepText.textContent="Start "+s.startSpeed+"% → target "+s.targetSpeed+"% · +"+s.increment+"% every "+s.repsPerStep+" successful rep"+(s.repsPerStep===1?"":"s");
      setStatus(ready?"Ready to practice bars "+s.startBar+"–"+s.endBar+" using "+sourceText()+".":"Open an interactive score first.");
    }
  }

  function setMainLoopRange(s){
    const loopStart=$("loopStart"), loopEnd=$("loopEnd"), apply=$("applyLoop");
    if(!loopStart||!loopEnd||!apply)return;
    loopStart.value=String(s.startBar);
    loopEnd.value=String(s.endBar);
    apply.click();
  }

  function setMainSpeed(speed){
    const slider=$("speed");
    if(!slider)return;
    slider.value=String(clamp(Math.round(speed),25,150));
    slider.dispatchEvent(new Event("input",{bubbles:true}));
  }

  function setSynthCountIn(enabled){
    const btn=$("countInBtn");
    if(!btn||isBackingMode())return;
    const active=btn.classList.contains("active");
    if(active!==enabled)btn.click();
  }

  function seekSynthToStart(){
    const a=api();
    if(!a||!a.score||!a.score.masterBars)return;
    try{
      a.stop();
      const bar=a.score.masterBars[Math.max(0,currentSettings.startBar-1)];
      if(a.tickCache&&typeof a.tickCache.getMasterBarStart==="function"){
        a.tickPosition=a.tickCache.getMasterBarStart(bar);
      }
    }catch(e){console.warn("Could not seek synth practice start",e);}
  }

  function stopMainPlayback(){
    const stop=$("stopBtn");
    if(stop)stop.click();
  }

  function beep(strong){
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      const ctx=beep.ctx||(beep.ctx=new Ctx());
      if(ctx.state==="suspended")ctx.resume();
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.frequency.value=strong?1040:780;
      gain.gain.setValueAtTime(0.0001,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12,ctx.currentTime+0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.09);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start();osc.stop(ctx.currentTime+0.1);
    }catch(e){}
  }

  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

  async function backingCountIn(){
    const token=++countdownToken;
    const beatMs=Math.round(600*(100/Math.max(25,currentSpeed)));
    el.countdown.classList.add("show");
    for(let n=1;n<=4;n++){
      if(token!==countdownToken)break;
      el.countdownNumber.textContent=String(n);
      beep(n===1);
      await sleep(beatMs);
    }
    if(token===countdownToken)el.countdown.classList.remove("show");
    return token===countdownToken;
  }

  async function startRun(withCountIn){
    if(!sessionActive||completed)return;
    stopMainPlayback();
    if(!isBackingMode())seekSynthToStart();
    await sleep(80);
    if(withCountIn&&currentSettings.countIn&&isBackingMode()){
      const ok=await backingCountIn();
      if(!ok)return;
    }
    if(!isBackingMode())setSynthCountIn(!!currentSettings.countIn);
    const play=$("playBtn");
    if(play)play.click();
  }

  async function startPractice(){
    if(!currentSongId){setStatus("Select a song first.");return;}
    if(!scoreReady()){setStatus("Open the interactive score before starting Practice Mode.");return;}
    currentSettings=readForm();
    await saveSettings();
    sessionActive=true;
    completed=false;
    currentSpeed=currentSettings.startSpeed;
    repsAtStep=0;
    totalSuccessfulReps=0;
    setMainLoopRange(currentSettings);
    setMainSpeed(currentSpeed);
    render();
    await startRun(true);
  }

  async function successfulRep(){
    if(!sessionActive||completed)return;
    repsAtStep++;
    totalSuccessfulReps++;
    if(repsAtStep>=currentSettings.repsPerStep){
      if(currentSpeed>=currentSettings.targetSpeed){
        completed=true;
        stopMainPlayback();
        render();
        return;
      }
      currentSpeed=Math.min(currentSettings.targetSpeed,currentSpeed+currentSettings.increment);
      repsAtStep=0;
      setMainSpeed(currentSpeed);
      render();
      await startRun(true);
      return;
    }
    render();
  }

  async function retrySection(){
    if(!sessionActive||completed)return;
    setStatus("Retrying bars "+currentSettings.startBar+"–"+currentSettings.endBar+" at "+currentSpeed+"%.");
    await startRun(true);
  }

  async function resetPractice(){
    if(!scoreReady())return;
    currentSettings=readForm();
    currentSpeed=currentSettings.startSpeed;
    repsAtStep=0;
    totalSuccessfulReps=0;
    completed=false;
    sessionActive=false;
    countdownToken++;
    el.countdown.classList.remove("show");
    stopMainPlayback();
    setMainLoopRange(currentSettings);
    setMainSpeed(currentSpeed);
    await saveSettings();
    render();
  }

  function stopPractice(){
    sessionActive=false;
    countdownToken++;
    el.countdown.classList.remove("show");
    stopMainPlayback();
    render();
  }

  function bind(){
    [el.startBar,el.endBar,el.startSpeed,el.targetSpeed,el.increment,el.reps].forEach(node=>{
      node.addEventListener("change",()=>{
        currentSettings=readForm();
        writeForm(currentSettings);
        if(!sessionActive)currentSpeed=currentSettings.startSpeed;
        scheduleSave();render();
      });
    });
    el.countIn.addEventListener("change",()=>{currentSettings=readForm();scheduleSave();render();});
    el.start.addEventListener("click",startPractice);
    el.success.addEventListener("click",successfulRep);
    el.retry.addEventListener("click",retrySection);
    el.reset.addEventListener("click",resetPractice);
    el.stop.addEventListener("click",stopPractice);
  }

  async function pollEnvironment(){
    const id=selectedSongId();
    if(id!==currentSongId){
      countdownToken++;
      stopMainPlayback();
      await loadSettingsForSong(id);
    }
    const count=barCount();
    if(count){
      el.startBar.max=String(count);
      el.endBar.max=String(count);
      if(Number(el.startBar.value)>count||Number(el.endBar.value)>count){
        currentSettings=readForm();writeForm(currentSettings);scheduleSave();
      }
    }
    render();
  }

  async function init(){
    if(!el.section)return;
    try{
      await openDb();
      bind();
      await loadSettingsForSong(selectedSongId());
      pollTimer=setInterval(()=>pollEnvironment().catch(console.error),650);
      render();
    }catch(error){
      console.error(error);
      setStatus("Practice Mode could not open its local settings: "+error.message);
    }
  }

  window.DTMusicTrainerPractice={
    start:startPractice,
    success:successfulRep,
    retry:retrySection,
    reset:resetPractice,
    stop:stopPractice,
    getState:()=>({sessionActive,currentSpeed,repsAtStep,totalSuccessfulReps,completed,settings:{...currentSettings}})
  };

  init();
})();
