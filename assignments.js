(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "dtmtp-phase5-assignments-v1";
  const ACTIVE_ASSIGNMENT_KEY = "dtmtp-active-assignment";
  const PENDING_ASSIGNMENT_KEY = "dtmtp-pending-assignment";
  const DB_NAME = "dt-music-trainer-pro";
  const STORE_NAME = "songs";

  const el = {
    launch: $("assignmentLaunchBtn"),
    currentStudent: $("assignmentCurrentStudent"),
    summaryOpen: $("assignmentSummaryOpen"),
    summaryProgress: $("assignmentSummaryProgress"),
    summaryDone: $("assignmentSummaryDone"),
    modal: $("assignmentModal"),
    close: $("assignmentCloseBtn"),
    studentSelect: $("assignmentStudentSelect"),
    addStudent: $("assignmentAddStudentBtn"),
    removeStudent: $("assignmentRemoveStudentBtn"),
    teacherTab: $("assignmentTeacherTab"),
    studentTab: $("assignmentStudentTab"),
    teacherView: $("assignmentTeacherView"),
    studentView: $("assignmentStudentView"),
    teacherStudentName: $("assignmentTeacherStudentName"),
    teacherStudentMeta: $("assignmentTeacherStudentMeta"),
    song: $("assignmentSongSelect"),
    startBar: $("assignmentStartBar"),
    endBar: $("assignmentEndBar"),
    startSpeed: $("assignmentStartSpeed"),
    targetSpeed: $("assignmentTargetSpeed"),
    step: $("assignmentStep"),
    reps: $("assignmentReps"),
    source: $("assignmentSource"),
    due: $("assignmentDueDate"),
    note: $("assignmentNote"),
    create: $("assignmentCreateBtn"),
    usePractice: $("assignmentUsePracticeBtn"),
    teacherList: $("assignmentTeacherList"),
    studentName: $("assignmentStudentName"),
    studentMeta: $("assignmentStudentMeta"),
    studentList: $("assignmentStudentList"),
    toast: $("assignmentToast"),
    practiceCount: null,
    practicePeriod: null
  };

  let data = loadData();
  let songs = [];
  let toastTimer = null;

  function makeId(prefix){
    if(window.crypto && typeof crypto.randomUUID === "function") return prefix + "-" + crypto.randomUUID();
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2,9);
  }

  function blankData(){ return {version:1,activeStudentId:"",students:[],assignments:[]}; }

  function loadData(){
    try{
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if(parsed && parsed.version === 1 && Array.isArray(parsed.students) && Array.isArray(parsed.assignments)) return parsed;
    }catch(e){ console.warn("Assignment data could not be read",e); }
    return blankData();
  }

  function saveData(){
    try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); }
    catch(e){ console.warn("Assignment data could not be saved",e); }
    renderAll();
  }

  function reloadCloudData(){
    data = loadData();
    if(data.students.length && !data.students.some(s => s.id === data.activeStudentId)){
      data.activeStudentId = data.students[0].id;
    }
    renderAll();
  }

  function toast(message){
    if(!el.toast) return;
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add("show");
    toastTimer = setTimeout(() => el.toast.classList.remove("show"),2800);
  }

  function activeStudent(){
    return data.students.find(s => s.id === data.activeStudentId) || null;
  }

  function setActiveStudent(id){
    data.activeStudentId = id || "";
    saveData();
  }

  function localDateKey(value){
    const d = value instanceof Date ? value : new Date(value);
    if(Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return y + "-" + m + "-" + day;
  }

  function weekKey(value){
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if(Number.isNaN(d.getTime())) return "";
    d.setHours(0,0,0,0);
    const day = (d.getDay()+6)%7;
    d.setDate(d.getDate()-day);
    return localDateKey(d);
  }

  function normalizeRequirement(a){
    const raw = a && a.requirement ? a.requirement : null;
    const count = Math.max(1,Math.min(20,Math.round(Number(raw && raw.count) || 1)));
    const period = raw && ["day","week","total"].includes(raw.period) ? raw.period : "total";
    a.requirement = {count,period};
    return a.requirement;
  }

  function assignmentProgress(a){
    if(!a.progress) a.progress = {};
    const p = a.progress;
    if(!p.status) p.status = "Not Started";
    p.highestSpeed = Math.max(0,Number(p.highestSpeed) || 0);
    p.repsCompleted = Math.max(0,Number(p.repsCompleted) || 0);
    p.practiceMs = Math.max(0,Number(p.practiceMs) || 0);
    p.lastPractisedAt = p.lastPractisedAt || "";
    p.completedAt = p.completedAt || "";
    p.lastSessionId = p.lastSessionId || "";
    p.lastSessionElapsedMs = Math.max(0,Number(p.lastSessionElapsedMs) || 0);
    p.lastRepKey = p.lastRepKey || "";
    if(!Array.isArray(p.sessions)) p.sessions = [];

    if(!a.requirement && p.status === "Completed" && !p.sessions.length){
      p.sessions.push({
        id:"legacy-" + a.id,
        completedAt:p.completedAt || p.lastPractisedAt || a.createdAt || new Date().toISOString()
      });
    }
    normalizeRequirement(a);
    return p;
  }

  function studentAssignments(studentId){
    return data.assignments
      .filter(a => a.studentId === studentId)
      .sort((a,b) => {
        const ad = a.dueDate || "9999-12-31";
        const bd = b.dueDate || "9999-12-31";
        return ad.localeCompare(bd) || String(b.createdAt||"").localeCompare(String(a.createdAt||""));
      });
  }

  function fmtDuration(ms){
    const min = Math.floor((Number(ms)||0) / 60000);
    if(min < 60) return min + "m";
    return Math.floor(min/60) + "h " + (min%60) + "m";
  }

  function fmtDateTime(value){
    if(!value) return "—";
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined,{day:"numeric",month:"short"}) + " " +
      d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
  }

  function countSessionsInPeriod(a,periodKey){
    const p = assignmentProgress(a);
    const req = normalizeRequirement(a);
    if(req.period === "total") return p.sessions.length;
    return p.sessions.filter(s => {
      if(req.period === "day") return localDateKey(s.completedAt) === periodKey;
      return weekKey(s.completedAt) === periodKey;
    }).length;
  }

  function requirementStats(a){
    const p = assignmentProgress(a);
    const req = normalizeRequirement(a);
    const now = new Date();
    let done = 0;
    let label = "";
    let periodKey = "";

    if(req.period === "day"){
      periodKey = localDateKey(now);
      done = countSessionsInPeriod(a,periodKey);
      label = "Today";
    }else if(req.period === "week"){
      periodKey = weekKey(now);
      done = countSessionsInPeriod(a,periodKey);
      label = "This week";
    }else{
      done = p.sessions.length;
      label = "Total";
    }

    return {
      count:req.count,
      period:req.period,
      done,
      met:done >= req.count,
      label,
      periodKey,
      text:req.count + "× / " + (req.period === "day" ? "day" : req.period === "week" ? "week" : "assignment")
    };
  }

  function requirementHistoryMet(a){
    const req = normalizeRequirement(a);
    if(req.period === "total") return requirementStats(a).met;
    if(!a.dueDate) return false;

    const start = new Date(a.createdAt || Date.now());
    const due = new Date(a.dueDate + "T23:59:59");
    if(Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) return false;
    if(Date.now() <= due.getTime()) return false;

    if(req.period === "day"){
      const cursor = new Date(start.getFullYear(),start.getMonth(),start.getDate());
      const end = new Date(due.getFullYear(),due.getMonth(),due.getDate());
      while(cursor <= end){
        if(countSessionsInPeriod(a,localDateKey(cursor)) < req.count) return false;
        cursor.setDate(cursor.getDate()+1);
      }
      return true;
    }

    const cursor = new Date(start);
    const day = (cursor.getDay()+6)%7;
    cursor.setHours(0,0,0,0);
    cursor.setDate(cursor.getDate()-day);
    const endKey = weekKey(due);
    while(weekKey(cursor) <= endKey){
      if(countSessionsInPeriod(a,weekKey(cursor)) < req.count) return false;
      cursor.setDate(cursor.getDate()+7);
    }
    return true;
  }

  function isOverdue(a){
    if(!a.dueDate) return false;
    const due = new Date(a.dueDate + "T23:59:59");
    return Date.now() > due.getTime() && !requirementHistoryMet(a);
  }

  function assignmentStatus(a){
    const p = assignmentProgress(a);
    const req = normalizeRequirement(a);

    if(req.period === "total" && requirementStats(a).met) return "Completed";
    if((req.period === "day" || req.period === "week") && requirementHistoryMet(a)) return "Completed";
    if(isOverdue(a)) return "Overdue";
    if(p.sessions.length || p.repsCompleted || p.practiceMs || p.status === "In Progress" || p.status === "Completed") return "In Progress";
    return "Not Started";
  }

  function statusBadge(a){
    const status = assignmentStatus(a);
    if(status === "Completed") return {text:"Completed",cls:"complete"};
    if(status === "Overdue") return {text:"Overdue",cls:"overdue"};
    if(status === "In Progress") return {text:"In Progress",cls:"progress"};
    return {text:"Not Started",cls:""};
  }

  function openDatabase(){
    return new Promise(resolve => {
      if(!window.indexedDB){ resolve(null); return; }
      const req = indexedDB.open(DB_NAME);
      req.onerror = () => resolve(null);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async function loadSongs(){
    const db = await openDatabase();
    if(!db || !db.objectStoreNames.contains(STORE_NAME)){ songs = []; renderSongOptions(); return; }
    songs = await new Promise(resolve => {
      try{
        const tx = db.transaction(STORE_NAME,"readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      }catch(e){ resolve([]); }
    });
    try{ db.close(); }catch(e){}
    songs.sort((a,b) => String(a.title||"").localeCompare(String(b.title||"")));
    renderSongOptions();
  }

  function renderSongOptions(){
    if(!el.song) return;
    const old = el.song.value;
    el.song.innerHTML = "";
    if(!songs.length){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No songs in library";
      el.song.appendChild(opt);
      return;
    }
    songs.forEach(song => {
      const opt = document.createElement("option");
      opt.value = song.id;
      opt.textContent = song.title || "Untitled Song";
      el.song.appendChild(opt);
    });
    const selectedSong = localStorage.getItem("dtmtp-selected-song") || "";
    if(songs.some(s => s.id === old)) el.song.value = old;
    else if(songs.some(s => s.id === selectedSong)) el.song.value = selectedSong;
  }

  function injectPracticeRequirementControls(){
    const form = el.create && el.create.closest(".assignment-form");
    if(!form || $("assignmentPracticeCount")) {
      el.practiceCount = $("assignmentPracticeCount");
      el.practicePeriod = $("assignmentPracticePeriod");
      return;
    }

    const dueWrap = el.due && el.due.parentElement;
    if(!dueWrap) return;

    const row = document.createElement("div");
    row.className = "assignment-form-grid assignment-requirement-form";
    row.innerHTML =
      '<div><label for="assignmentPracticeCount">PRACTICE REQUIRED</label>' +
      '<input id="assignmentPracticeCount" type="number" min="1" max="20" value="1"></div>' +
      '<div><label for="assignmentPracticePeriod">FREQUENCY</label>' +
      '<select id="assignmentPracticePeriod">' +
      '<option value="day">Per day</option>' +
      '<option value="week">Per week</option>' +
      '<option value="total">Total sessions</option>' +
      '</select></div>';

    form.insertBefore(row,dueWrap);
    el.practiceCount = $("assignmentPracticeCount");
    el.practicePeriod = $("assignmentPracticePeriod");
  }

  function renderStudentSelect(){
    if(!el.studentSelect) return;
    el.studentSelect.innerHTML = "";
    if(!data.students.length){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Add a student first";
      el.studentSelect.appendChild(opt);
      return;
    }
    data.students.forEach(student => {
      const opt = document.createElement("option");
      opt.value = student.id;
      opt.textContent = student.name;
      el.studentSelect.appendChild(opt);
    });
    if(!data.students.some(s => s.id === data.activeStudentId)) data.activeStudentId = data.students[0].id;
    el.studentSelect.value = data.activeStudentId;
  }

  function renderLaunchSummary(){
    const student = activeStudent();
    const list = student ? studentAssignments(student.id) : [];
    const open = list.filter(a => assignmentStatus(a) === "Not Started").length;
    const progress = list.filter(a => assignmentStatus(a) === "In Progress" || assignmentStatus(a) === "Overdue").length;
    const done = list.filter(a => assignmentStatus(a) === "Completed").length;
    if(el.currentStudent) el.currentStudent.textContent = student ? student.name : "No student selected";
    if(el.summaryOpen) el.summaryOpen.textContent = String(open);
    if(el.summaryProgress) el.summaryProgress.textContent = String(progress);
    if(el.summaryDone) el.summaryDone.textContent = String(done);
  }

  function renderStudentHeaders(){
    const student = activeStudent();
    const list = student ? studentAssignments(student.id) : [];
    const completed = list.filter(a => assignmentStatus(a) === "Completed").length;
    const active = list.filter(a => assignmentStatus(a) !== "Completed").length;
    if(el.teacherStudentName) el.teacherStudentName.textContent = student ? student.name : "No student";
    if(el.teacherStudentMeta) el.teacherStudentMeta.textContent = student ? (list.length + " assignments · " + completed + " completed") : "Add a student to begin.";
    if(el.studentName) el.studentName.textContent = student ? student.name : "My Assignments";
    if(el.studentMeta) el.studentMeta.textContent = student ? (active + " active assignments") : "No student selected.";
  }

  function buildAssignmentCard(a,studentMode){
    const p = assignmentProgress(a);
    const reqStats = requirementStats(a);
    const badge = statusBadge(a);
    const card = document.createElement("div");
    card.className = "assignment-card" +
      (badge.cls === "overdue" ? " overdue" : "") +
      (badge.cls === "complete" ? " completed" : "");

    const top = document.createElement("div");
    top.className = "assignment-card-top";
    const titleWrap = document.createElement("div");
    const title = document.createElement("div");
    title.className = "assignment-card-title";
    title.textContent = a.songTitle || "Untitled Song";
    const sub = document.createElement("div");
    sub.className = "assignment-card-sub";
    sub.textContent =
      "Bars " + a.settings.startBar + "–" + a.settings.endBar +
      " · " + a.settings.startSpeed + "% → " + a.settings.targetSpeed + "%" +
      " · +" + a.settings.increment + "% every " + a.settings.repsPerStep + " reps" +
      (a.dueDate ? " · Due " + a.dueDate : "");
    titleWrap.append(title,sub);

    const badgeEl = document.createElement("span");
    badgeEl.className = "assignment-badge " + badge.cls;
    badgeEl.textContent = badge.text;
    top.append(titleWrap,badgeEl);
    card.appendChild(top);

    const goal = document.createElement("div");
    goal.className = "assignment-frequency" + (reqStats.met ? " met" : "");
    const goalMain = document.createElement("div");
    goalMain.className = "assignment-frequency-main";
    goalMain.textContent = "Practice goal: " + reqStats.text;
    const goalProgress = document.createElement("div");
    goalProgress.className = "assignment-frequency-progress";
    goalProgress.textContent = reqStats.label + " " + reqStats.done + "/" + reqStats.count;
    goal.append(goalMain,goalProgress);
    card.appendChild(goal);

    if(a.note){
      const note = document.createElement("div");
      note.className = "assignment-note";
      note.textContent = a.note;
      card.appendChild(note);
    }

    const progress = document.createElement("div");
    progress.className = "assignment-progress";
    const metrics = [
      [p.highestSpeed ? p.highestSpeed + "%" : "—","Highest speed"],
      [String(p.repsCompleted),"Reps"],
      [fmtDuration(p.practiceMs),"Practice"],
      [p.lastPractisedAt ? fmtDateTime(p.lastPractisedAt) : "—","Last practice"]
    ];
    metrics.forEach(([value,label]) => {
      const box = document.createElement("div");
      box.className = "assignment-progress-box";
      box.innerHTML = '<div class="v"></div><div class="k"></div>';
      box.querySelector(".v").textContent = value;
      box.querySelector(".k").textContent = label;
      progress.appendChild(box);
    });
    card.appendChild(progress);

    const actions = document.createElement("div");
    actions.className = "assignment-card-actions";
    const practice = document.createElement("button");
    practice.type = "button";
    practice.className = "primary";

    if(reqStats.period === "day" && reqStats.met) practice.textContent = "Practice Again Today";
    else if(reqStats.period === "week" && reqStats.met) practice.textContent = "Practice Again This Week";
    else if(assignmentStatus(a) === "Completed") practice.textContent = "Practice Again";
    else practice.textContent = "Practice Assignment";

    practice.onclick = () => loadAssignmentIntoPractice(a.id);
    actions.appendChild(practice);

    if(!studentMode){
      const duplicate = document.createElement("button");
      duplicate.type = "button";
      duplicate.textContent = "Duplicate";
      duplicate.onclick = () => duplicateAssignment(a.id);
      actions.appendChild(duplicate);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "Delete";
      del.onclick = () => deleteAssignment(a.id);
      actions.appendChild(del);
    }

    card.appendChild(actions);
    return card;
  }

  function renderLists(){
    const student = activeStudent();
    const list = student ? studentAssignments(student.id) : [];
    [el.teacherList,el.studentList].forEach(node => { if(node) node.innerHTML = ""; });

    if(!student){
      const text = '<div class="assignment-empty">Add a student to create assignments.</div>';
      if(el.teacherList) el.teacherList.innerHTML = text;
      if(el.studentList) el.studentList.innerHTML = text;
      return;
    }

    if(!list.length){
      const text = '<div class="assignment-empty">No assignments yet.</div>';
      if(el.teacherList) el.teacherList.innerHTML = text;
      if(el.studentList) el.studentList.innerHTML = text;
      return;
    }

    list.forEach(a => {
      if(el.teacherList) el.teacherList.appendChild(buildAssignmentCard(a,false));
      if(el.studentList) el.studentList.appendChild(buildAssignmentCard(a,true));
    });
  }

  function renderAll(){
    renderStudentSelect();
    renderLaunchSummary();
    renderStudentHeaders();
    renderLists();
  }

  function openModal(){
    if(!el.modal) return;
    document.body.classList.add("assignment-modal-open");
    el.modal.classList.add("show");
    el.modal.setAttribute("aria-hidden","false");
    loadSongs();
    renderAll();
  }

  function closeModal(){
    if(!el.modal) return;
    el.modal.classList.remove("show");
    el.modal.setAttribute("aria-hidden","true");
    document.body.classList.remove("assignment-modal-open");
  }

  function showView(name){
    const teacher = name === "teacher";
    el.teacherTab.classList.toggle("active",teacher);
    el.studentTab.classList.toggle("active",!teacher);
    el.teacherView.classList.toggle("active",teacher);
    el.studentView.classList.toggle("active",!teacher);
  }

  function addStudent(){
    const name = prompt("Student name:");
    if(!name || !name.trim()) return;
    const student = {id:makeId("student"),name:name.trim(),createdAt:new Date().toISOString()};
    data.students.push(student);
    data.activeStudentId = student.id;
    saveData();
    toast("Student added.");
  }

  function removeStudent(){
    const student = activeStudent();
    if(!student) return;
    if(!confirm('Remove "' + student.name + '" and all of this student\'s assignments?')) return;
    data.students = data.students.filter(s => s.id !== student.id);
    data.assignments = data.assignments.filter(a => a.studentId !== student.id);
    data.activeStudentId = data.students.length ? data.students[0].id : "";
    saveData();
  }

  function currentPracticeSettings(){
    if(window.DTMusicTrainerPractice && typeof window.DTMusicTrainerPractice.getState === "function"){
      return window.DTMusicTrainerPractice.getState().settings;
    }
    return null;
  }

  function useCurrentPractice(){
    const state = currentPracticeSettings();
    if(!state){ toast("Open Practice Mode first."); return; }
    el.startBar.value = state.startBar;
    el.endBar.value = state.endBar;
    el.startSpeed.value = state.startSpeed;
    el.targetSpeed.value = state.targetSpeed;
    el.step.value = state.increment;
    el.reps.value = state.repsPerStep;
    const selectedSong = localStorage.getItem("dtmtp-selected-song") || "";
    if(songs.some(s => s.id === selectedSong)) el.song.value = selectedSong;
    toast("Current Practice Mode settings copied.");
  }

  function createAssignment(){
    const student = activeStudent();
    if(!student){ toast("Add a student first."); return; }

    const song = songs.find(s => s.id === el.song.value);
    if(!song){ toast("Choose a song."); return; }

    let startBar = Math.max(1,Math.round(Number(el.startBar.value)||1));
    let endBar = Math.max(1,Math.round(Number(el.endBar.value)||startBar));
    if(endBar < startBar) [startBar,endBar] = [endBar,startBar];

    const startSpeed = Math.max(25,Math.min(150,Math.round(Number(el.startSpeed.value)||60)));
    const targetSpeed = Math.max(startSpeed,Math.min(150,Math.round(Number(el.targetSpeed.value)||100)));
    const requirementCount = Math.max(1,Math.min(20,Math.round(Number(el.practiceCount && el.practiceCount.value)||1)));
    const requirementPeriod = el.practicePeriod && ["day","week","total"].includes(el.practicePeriod.value) ? el.practicePeriod.value : "day";

    const assignment = {
      id:makeId("assignment"),
      studentId:student.id,
      songId:song.id,
      songTitle:song.title || "Untitled Song",
      createdAt:new Date().toISOString(),
      dueDate:el.due.value || "",
      note:(el.note.value || "").trim(),
      source:el.source.value || "either",
      requirement:{count:requirementCount,period:requirementPeriod},
      settings:{
        startBar,
        endBar,
        startSpeed,
        targetSpeed,
        increment:Math.max(1,Math.min(25,Math.round(Number(el.step.value)||5))),
        repsPerStep:Math.max(1,Math.min(20,Math.round(Number(el.reps.value)||3))),
        countIn:true
      },
      progress:{
        status:"Not Started",
        highestSpeed:0,
        repsCompleted:0,
        practiceMs:0,
        lastPractisedAt:"",
        completedAt:"",
        sessions:[]
      }
    };

    data.assignments.push(assignment);
    saveData();
    window.dispatchEvent(new CustomEvent("dtmtp:assignment-created",{
      detail:{assignmentId:assignment.id,studentId:assignment.studentId,songId:assignment.songId}
    }));
    el.note.value = "";
    toast("Assignment created for " + student.name + ". Uploading song materials to cloud…");
  }

  function duplicateAssignment(id){
    const old = data.assignments.find(a => a.id === id);
    if(!old) return;
    const copy = JSON.parse(JSON.stringify(old));
    copy.id = makeId("assignment");
    copy.createdAt = new Date().toISOString();
    copy.progress = {
      status:"Not Started",
      highestSpeed:0,
      repsCompleted:0,
      practiceMs:0,
      lastPractisedAt:"",
      completedAt:"",
      sessions:[]
    };
    data.assignments.push(copy);
    saveData();
  }

  function deleteAssignment(id){
    const a = data.assignments.find(x => x.id === id);
    if(!a) return;
    if(!confirm('Delete assignment "' + a.songTitle + '"?')) return;
    data.assignments = data.assignments.filter(x => x.id !== id);
    if(localStorage.getItem(ACTIVE_ASSIGNMENT_KEY) === id) localStorage.removeItem(ACTIVE_ASSIGNMENT_KEY);
    saveData();
  }

  function savePracticeSettingsForSong(a){
    const key = "dtmtp-practice-v4:" + a.songId;
    try{ localStorage.setItem(key,JSON.stringify({...a.settings})); }catch(e){}
  }

  function applyAssignmentSource(a){
    if(a.source === "backing"){
      const btn = $("backingModeBtn");
      if(btn && !btn.disabled && !btn.classList.contains("active-source")) btn.click();
    }else if(a.source === "synth"){
      const btn = $("synthModeBtn");
      if(btn && !btn.disabled && !btn.classList.contains("active-source")) btn.click();
    }
  }

  async function loadAssignmentIntoPractice(id){
    const a = data.assignments.find(x => x.id === id);
    if(!a) return;

    if(window.DTMusicTrainerSongCloud && typeof window.DTMusicTrainerSongCloud.ensureSong === "function"){
      try{
        toast("Checking assignment materials…");
        await window.DTMusicTrainerSongCloud.ensureSong(a.songId);
      }catch(error){
        console.error("Assignment materials unavailable",error);
        toast(error && error.message ? error.message : "Assignment materials are not available yet.");
        return;
      }
    }

    localStorage.setItem(ACTIVE_ASSIGNMENT_KEY,a.id);
    savePracticeSettingsForSong(a);
    const selected = localStorage.getItem("dtmtp-selected-song") || "";

    if(selected !== a.songId){
      localStorage.setItem("dtmtp-selected-song",a.songId);
      localStorage.setItem(PENDING_ASSIGNMENT_KEY,a.id);
      location.reload();
      return;
    }

    if(window.DTMusicTrainerPractice && typeof window.DTMusicTrainerPractice.setSettings === "function"){
      window.DTMusicTrainerPractice.setSettings(a.settings);
    }

    applyAssignmentSource(a);
    closeModal();

    const state = window.DTMusicTrainerPractice && window.DTMusicTrainerPractice.selfTest ?
      window.DTMusicTrainerPractice.selfTest() : null;

    if(!state || !state.scoreReady){
      const open = $("openInteractiveBtn");
      if(open && !open.disabled) open.click();
      toast("Assignment loaded. Wait for the score, then press Start Practice.");
    }else{
      toast("Assignment loaded into Practice Mode.");
    }
  }

  function findTrackedAssignment(detail){
    const explicit = localStorage.getItem(ACTIVE_ASSIGNMENT_KEY) || "";
    let a = data.assignments.find(x => x.id === explicit);
    if(a && a.songId === detail.songId) return a;

    const student = activeStudent();
    if(!student) return null;

    a = studentAssignments(student.id).find(x =>
      x.songId === detail.songId &&
      assignmentStatus(x) !== "Completed" &&
      x.settings.startBar === detail.settings.startBar &&
      x.settings.endBar === detail.settings.endBar
    ) || null;

    if(a) localStorage.setItem(ACTIVE_ASSIGNMENT_KEY,a.id);
    return a;
  }

  function accruePracticeTime(p,detail){
    if(!detail.sessionId) return;
    if(p.lastSessionId !== detail.sessionId){
      p.lastSessionId = detail.sessionId;
      p.lastSessionElapsedMs = 0;
    }
    const elapsed = Math.max(0,Number(detail.elapsedMs)||0);
    if(elapsed > p.lastSessionElapsedMs){
      p.practiceMs += elapsed - p.lastSessionElapsedMs;
      p.lastSessionElapsedMs = elapsed;
    }
  }

  function recordCompletedSession(a,p,detail){
    const id = detail.sessionId || ("session-" + Date.now());
    if(p.sessions.some(s => s.id === id)) return false;
    p.sessions.push({id,completedAt:new Date().toISOString()});
    return true;
  }

  function onPracticeEvent(type,event){
    const detail = event.detail || {};
    if(!detail.songId || !detail.settings) return;

    const a = findTrackedAssignment(detail);
    if(!a) return;

    const p = assignmentProgress(a);
    accruePracticeTime(p,detail);
    p.lastPractisedAt = new Date().toISOString();
    p.highestSpeed = Math.max(p.highestSpeed,Number(detail.currentSpeed)||0);

    if(type === "start"){
      if(assignmentStatus(a) !== "Completed") p.status = "In Progress";
    }else if(type === "rep"){
      const repKey = detail.sessionId + ":" + detail.totalReps;
      if(p.lastRepKey !== repKey){
        p.repsCompleted += 1;
        p.lastRepKey = repKey;
      }
      if(assignmentStatus(a) !== "Completed") p.status = "In Progress";
    }else if(type === "complete"){
      recordCompletedSession(a,p,detail);
      p.completedAt = new Date().toISOString();
      p.highestSpeed = Math.max(p.highestSpeed,a.settings.targetSpeed);
      p.status = assignmentStatus(a) === "Completed" ? "Completed" : "In Progress";
    }

    saveData();
  }

  function resumePendingAssignment(){
    const id = localStorage.getItem(PENDING_ASSIGNMENT_KEY) || "";
    if(!id) return;

    const a = data.assignments.find(x => x.id === id);
    if(!a){
      localStorage.removeItem(PENDING_ASSIGNMENT_KEY);
      return;
    }

    if((localStorage.getItem("dtmtp-selected-song") || "") !== a.songId) return;

    savePracticeSettingsForSong(a);
    if(window.DTMusicTrainerPractice && typeof window.DTMusicTrainerPractice.setSettings === "function"){
      window.DTMusicTrainerPractice.setSettings(a.settings);
    }
    localStorage.removeItem(PENDING_ASSIGNMENT_KEY);

    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      const test = window.DTMusicTrainerPractice && window.DTMusicTrainerPractice.selfTest ?
        window.DTMusicTrainerPractice.selfTest() : null;

      if(test && test.scoreReady){
        applyAssignmentSource(a);
        clearInterval(timer);
        toast("Assignment ready. Press Start Practice.");
        return;
      }

      const open = $("openInteractiveBtn");
      if(open && !open.disabled) open.click();
      if(tries >= 20) clearInterval(timer);
    },500);
  }

  function bind(){
    if(!el.launch || !el.modal) return false;

    el.launch.onclick = openModal;
    el.close.onclick = closeModal;
    el.modal.addEventListener("click",e => { if(e.target === el.modal) closeModal(); });
    el.studentSelect.addEventListener("change",() => setActiveStudent(el.studentSelect.value));
    el.addStudent.onclick = addStudent;
    el.removeStudent.onclick = removeStudent;
    el.teacherTab.onclick = () => showView("teacher");
    el.studentTab.onclick = () => showView("student");
    el.create.onclick = createAssignment;
    el.usePractice.onclick = useCurrentPractice;

    document.addEventListener("keydown",e => {
      if(e.key === "Escape" && el.modal.classList.contains("show")) closeModal();
    });

    window.addEventListener("dtmtp:practice-start",e => onPracticeEvent("start",e));
    window.addEventListener("dtmtp:practice-rep",e => onPracticeEvent("rep",e));
    window.addEventListener("dtmtp:practice-speed-change",e => onPracticeEvent("speed",e));
    window.addEventListener("dtmtp:practice-stop",e => onPracticeEvent("stop",e));
    window.addEventListener("dtmtp:practice-complete",e => onPracticeEvent("complete",e));
    window.addEventListener("dtmtp:cloud-data-applied",() => reloadCloudData());

    return true;
  }

  function init(){
    injectPracticeRequirementControls();
    if(!bind()) return;
    if(data.students.length && !data.students.some(s => s.id === data.activeStudentId)){
      data.activeStudentId = data.students[0].id;
    }
    renderAll();
    loadSongs();
    showView("teacher");
    setTimeout(resumePendingAssignment,300);
  }

  window.DTMusicTrainerAssignments = {
    open:openModal,
    getData:() => JSON.parse(JSON.stringify(data)),
    getActiveStudent:() => activeStudent(),
    reloadCloudData,
    loadAssignment:loadAssignmentIntoPractice
  };

  init();
})();
