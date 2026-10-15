
(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const ROUTE_KEY = "dtmtp-p7-route";
  let session = null;
  let currentRoute = "";
  let shellBuilt = false;
  let moved = {};
  let navButtons = [];
  let mobileButtons = [];
  let selectedTeacherStudentId = "";
  let assignmentWizard = null;
  let assignmentWizardSongs = [];

  const routes = {
    teacher:[
      ["dashboard","⌂","Dashboard"],
      ["students","♙","Students"],
      ["assignments","✓","Assignments"],
      ["library","♫","Library"],
      ["practice","▶","Practice"]
    ],
    student:[
      ["home","⌂","Home"],
      ["assignments","✓","Assignments"],
      ["practice","▶","Practice"],
      ["progress","↗","Progress"]
    ]
  };

  function authSession(){
    try{
      return window.DTMusicTrainerAuth && window.DTMusicTrainerAuth.getSession
        ? window.DTMusicTrainerAuth.getSession()
        : null;
    }catch(error){ return null; }
  }

  function assignmentData(){
    try{
      return window.DTMusicTrainerAssignments && window.DTMusicTrainerAssignments.getData
        ? window.DTMusicTrainerAssignments.getData()
        : {students:[],assignments:[]};
    }catch(error){ return {students:[],assignments:[]}; }
  }

  function fmtMinutes(ms){
    const m=Math.round((Number(ms)||0)/60000);
    return m<60 ? m+"m" : Math.floor(m/60)+"h "+(m%60)+"m";
  }

  function assignmentStatus(a){
    if(!a) return "";
    try{
      const api=window.DTMusicTrainerAssignments;
      if(api && typeof api.getStatus==="function" && a.id){
        const status=api.getStatus(a.id);
        if(status) return status;
      }
    }catch(error){}
    return a.progress && a.progress.status ? a.progress.status : "Not Started";
  }

  function isCompleted(a){
    return assignmentStatus(a)==="Completed";
  }

  function todayKey(){
    const d=new Date();
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }

  function practicedToday(a){
    const sessions=(a&&a.progress&&Array.isArray(a.progress.sessions))?a.progress.sessions:[];
    return sessions.some(s=>{
      const d=new Date(s.completedAt||"");
      if(Number.isNaN(d.getTime())) return false;
      return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")===todayKey();
    });
  }

  function metric(label,value,foot){
    return '<div class="p7-metric"><div class="p7-metric-label">'+label+'</div><div class="p7-metric-value">'+value+'</div><div class="p7-metric-foot">'+foot+'</div></div>';
  }

  function sectionFor(id){
    const node=$(id);
    return node ? node.closest(".section") : null;
  }

  function buildShell(){
    if(shellBuilt || $("p7Shell")) return;
    const app=document.querySelector(".app");
    const workspace=document.querySelector(".workspace");
    const oldMain=document.querySelector(".workspace > .main");
    if(!app || !workspace || !oldMain) return;

    moved={
      library:sectionFor("librarySearch"),
      selected:sectionFor("selectedTitle"),
      assignment:sectionFor("assignmentLaunchBtn"),
      scoreInfo:sectionFor("scoreSongTitle"),
      tracks:sectionFor("trackList"),
      loop:sectionFor("loopStart"),
      practice:sectionFor("practiceModeSection"),
      backing:sectionFor("syncBarInput"),
      main:oldMain
    };

    const shell=document.createElement("div");
    shell.id="p7Shell";
    shell.innerHTML=`
      <aside class="p7-side">
        <div class="p7-side-brand"><strong>DT Music Academy</strong><span>Music Trainer Pro</span></div>
        <nav id="p7Nav" class="p7-nav"></nav>
        <div class="p7-side-bottom">
          <div id="p7SideUser" class="p7-side-user">Cloud account</div>
          <div id="p7SideRole" class="p7-side-role">Signed out</div>
        </div>
      </aside>
      <div id="p7Stage" class="p7-stage">
        <section id="p7PageDashboard" class="p7-page"></section>
        <section id="p7PageHome" class="p7-page"></section>
        <section id="p7PageStudents" class="p7-page"></section>
        <section id="p7PageStudentProfile" class="p7-page"></section>
        <section id="p7PageAssignments" class="p7-page"></section>
        <section id="p7PageAssignmentWizard" class="p7-page"></section>
        <section id="p7PageLibrary" class="p7-page"></section>
        <section id="p7PageProgress" class="p7-page"></section>
        <section id="p7PagePractice" class="p7-page p7-practice-page">
          <div class="p7-practice-top">
            <div><strong id="p7PracticeHeading">Practice</strong><span id="p7PracticeSub">Score & playback</span></div>
            <div class="p7-practice-top-actions">
              <button id="p7PracticeStart" class="p7-primary" type="button">Start Practice</button>
              <button id="p7PracticeStop" class="p7-secondary" type="button">Stop</button>
              <button id="p7PracticeAssignments" class="p7-secondary" type="button">Assignments</button>
            </div>
          </div>
          <div id="p7StudentPracticeGuide" class="p7-student-practice-guide" hidden>
            <div class="p7-guide-song"><strong id="p7GuideSong">Assignment</strong><span id="p7GuideBars">Ready to practise</span></div>
            <div class="p7-guide-stat"><strong id="p7GuideSpeed">—</strong><span>Speed</span></div>
            <div class="p7-guide-stat"><strong id="p7GuideReps">0 / 0</strong><span>Reps</span></div>
            <div class="p7-guide-message" id="p7GuideMessage">Press Start Practice when you're ready.</div>
          </div>
          <div class="p7-practice-body">
            <div id="p7PracticeMain" class="p7-practice-main"></div>
            <aside id="p7PracticeTools" class="p7-practice-tools"></aside>
          </div>
        </section>
      </div>
      <nav id="p7MobileNav" class="p7-mobile-nav"></nav>
    `;
    app.appendChild(shell);

    const libraryPage=$("p7PageLibrary");
    const libraryWrap=document.createElement("div");
    libraryWrap.className="p7-tool-grid";
    libraryWrap.innerHTML='<div id="p7LibraryLeft" class="p7-tool-column"></div><div id="p7LibraryRight" class="p7-tool-column"></div>';
    libraryPage.appendChild(libraryWrap);
    if(moved.library) $("p7LibraryLeft").appendChild(moved.library);
    if(moved.selected) $("p7LibraryRight").appendChild(moved.selected);

    $("p7PracticeMain").appendChild(moved.main);

    // Keep the practice count-in inside the score viewport so the score stays visible.
    const countdown=$("practiceCountdown");
    const scoreViewport=$("scoreViewport");
    if(countdown && scoreViewport) scoreViewport.appendChild(countdown);

    const tools=$("p7PracticeTools");
    [
      ["Practice setup",moved.practice,true],
      ["Loop controls",moved.loop,false],
      ["Score & tracks",moved.scoreInfo,false],
      ["Track controls",moved.tracks,false],
      ["Backing track sync",moved.backing,false]
    ].forEach(([title,node,open])=>{
      if(!node) return;
      const details=document.createElement("details");
      if(open) details.open=true;
      const summary=document.createElement("summary");
      summary.textContent=title;
      details.append(summary,node);
      tools.appendChild(details);
    });

    workspace.style.display="none";
    document.body.classList.add("p7-ready");
    shellBuilt=true;

    $("p7PracticeAssignments").onclick=()=>openAssignments(session&&session.role==="student"?"student":"teacher");
    $("p7PracticeStart").onclick=()=>{ const b=$("practiceStartBtn"); if(b && !b.disabled) b.click(); };
    $("p7PracticeStop").onclick=()=>{ const b=$("practiceStopBtn"); if(b && !b.disabled) b.click(); };
    renderStaticPages();
    applySession(authSession());
  }

  function pageHead(eyebrow,title,copy,actions){
    return `
      <div class="p7-head">
        <div><div class="p7-eyebrow">${eyebrow}</div><h1 class="p7-title">${title}</h1><div class="p7-copy">${copy}</div></div>
        <div class="p7-head-actions">${actions||""}</div>
      </div>`;
  }

  function renderStaticPages(){
    $("p7PageStudents").innerHTML=
      pageHead("Teacher workspace","Students","Open a student to review assignments, practice history, progress and teacher notes.",
        '<button id="p7OpenStudents" class="p7-primary" type="button">Open student manager</button>')+
      '<div id="p7StudentDirectory" class="p7-card"></div>';

    $("p7PageAssignments").innerHTML=
      pageHead("Practice planning","Assignments","Create, review and monitor student practice from one place.",
        '<button id="p7OpenAssignments" class="p7-primary" type="button">+ New Assignment</button>')+
      '<div id="p7AssignmentOverview" class="p7-card"></div>';

    $("p7PageLibrary").insertAdjacentHTML("afterbegin",
      pageHead("Teaching materials","Song Library","Manage local song materials here. Assigned materials continue to sync through your existing Google Drive workflow.",""));

    $("p7PageProgress").innerHTML=
      pageHead("Your practice","Progress","A simple summary for now. Phase 7.3 will expand this into full practice history and progress reporting.","")+
      '<div id="p7ProgressSummary"></div>';

    $("p7OpenStudents").onclick=()=>openAssignments("teacher");
    $("p7OpenAssignments").onclick=()=>{ if(session&&session.role==="teacher") openAssignmentWizard(); };
  }

  function teacherLastPractice(list){
    let latest=0;
    (list||[]).forEach(a=>{
      const p=a&&a.progress?a.progress:{};
      const hasRecordedActivity=
        Number(p.lastSessionElapsedMs||0)>0 ||
        (!p.lastSessionId && Number(p.practiceMs||0)>0);
      if(hasRecordedActivity){
        const direct=new Date(p.lastPractisedAt||"").getTime();
        if(Number.isFinite(direct)) latest=Math.max(latest,direct);
      }
      const sessions=Array.isArray(p.sessions)?p.sessions:[];
      sessions.forEach(s=>{
        const t=new Date(s.completedAt||"").getTime();
        if(Number.isFinite(t)) latest=Math.max(latest,t);
      });
    });
    return latest;
  }

  function teacherRelativeTime(value){
    const t=Number(value)||new Date(value||"").getTime();
    if(!Number.isFinite(t)||!t) return "No practice yet";
    const diff=Math.max(0,Date.now()-t);
    const mins=Math.floor(diff/60000);
    if(mins<1) return "Just now";
    if(mins<60) return mins+"m ago";
    const hours=Math.floor(mins/60);
    if(hours<24) return hours+"h ago";
    const days=Math.floor(hours/24);
    if(days===1) return "Yesterday";
    if(days<14) return days+" days ago";
    return new Date(t).toLocaleDateString(undefined,{day:"numeric",month:"short"});
  }

  function teacherIsOverdue(a){
    if(!a) return false;
    const status=assignmentStatus(a);
    if(status==="Overdue") return true;
    if(status==="Completed") return false;
    if(!a.dueDate) return false;
    const due=new Date(a.dueDate+"T23:59:59");
    return !Number.isNaN(due.getTime()) && Date.now()>due.getTime();
  }

  function teacherWeekStart(){
    const d=new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()-((d.getDay()+6)%7));
    return d.getTime();
  }

  function teacherSessions(data){
    const students=new Map((data.students||[]).map(s=>[s.id,s]));
    const rows=[];
    (data.assignments||[]).forEach(a=>{
      const p=a&&a.progress?a.progress:{};
      const sessions=Array.isArray(p.sessions)?p.sessions:[];
      sessions.forEach(s=>{
        const t=new Date(s.completedAt||"").getTime();
        if(!Number.isFinite(t)) return;
        const student=students.get(a.studentId);
        rows.push({
          time:t,
          studentId:a.studentId,
          studentName:student&&student.name?student.name:"Student",
          songTitle:a.songTitle||"Assignment",
          practiceMs:Math.max(0,Number(s.practiceMs)||0),
          highestSpeed:Math.max(0,Number(s.highestSpeed)||0),
          reps:Math.max(0,Number(s.reps)||0)
        });
      });
    });
    return rows.sort((a,b)=>b.time-a.time);
  }

  function teacherStudentSessions(assignments){
    const rows=[];
    (assignments||[]).forEach(a=>{
      const p=a&&a.progress?a.progress:{};
      const sessions=Array.isArray(p.sessions)?p.sessions:[];
      sessions.forEach(s=>{
        const t=new Date(s.completedAt||"").getTime();
        if(!Number.isFinite(t)) return;
        rows.push({
          time:t,
          assignmentId:a.id,
          songTitle:a.songTitle||"Assignment",
          practiceMs:Math.max(0,Number(s.practiceMs)||0),
          highestSpeed:Math.max(0,Number(s.highestSpeed)||0),
          reps:Math.max(0,Number(s.reps)||0),
          source:s.source||""
        });
      });
    });
    return rows.sort((a,b)=>b.time-a.time);
  }

  function teacherStudentStreak(assignments){
    const days=new Set();
    teacherStudentSessions(assignments).forEach(s=>days.add(dateKey(s.time)));
    if(!days.size) return 0;
    let cursor=new Date();
    cursor.setHours(0,0,0,0);
    if(!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
    let streak=0;
    while(days.has(dateKey(cursor))){
      streak++;
      cursor.setDate(cursor.getDate()-1);
    }
    return streak;
  }

  function openTeacherAssignmentManager(studentId){
    try{
      const api=window.DTMusicTrainerAssignments;
      if(api && typeof api.setActiveStudent==="function" && studentId) api.setActiveStudent(studentId);
    }catch(error){}
    openAssignments("teacher");
  }

  async function loadTeacherNote(studentId){
    const notes=$("p74Notes"), status=$("p74NoteStatus"), save=$("p74SaveNotes");
    if(!notes || !session || session.role!=="teacher" || !session.uid) return;
    const expectedId=studentId;
    try{
      const F=window.DTMTPFirebase;
      if(!F){ if(status) status.textContent="Cloud not ready"; return; }
      if(status) status.textContent="Loading note…";
      const snap=await F.getDoc(F.doc(F.db,"users",session.uid));
      if(selectedTeacherStudentId!==expectedId || currentRoute!=="studentprofile") return;
      const data=snap.exists()?snap.data():{};
      const map=data&&data.studentNotes&&typeof data.studentNotes==="object"?data.studentNotes:{};
      notes.value=String(map[expectedId]||"").slice(0,4000);
      notes.disabled=false;
      if(save) save.disabled=false;
      if(status) status.textContent=notes.value.length.toLocaleString()+" / 4,000";
    }catch(error){
      console.error("Teacher note load failed",error);
      if(status) status.textContent="Could not load note";
    }
  }

  async function saveTeacherNote(studentId,text){
    if(!session || session.role!=="teacher" || !session.uid) return false;
    const F=window.DTMTPFirebase;
    if(!F) return false;
    const ref=F.doc(F.db,"users",session.uid);
    const snap=await F.getDoc(ref);
    const current=snap.exists()?snap.data():{};
    const notes=current&&current.studentNotes&&typeof current.studentNotes==="object"?{...current.studentNotes}:{};
    notes[studentId]=String(text||"").trim().slice(0,4000);
    await F.setDoc(ref,{studentNotes:notes,updatedAt:F.serverTimestamp()},{merge:true});
    return true;
  }

  function openTeacherStudent(studentId){
    if(!session || session.role!=="teacher") return;
    const data=assignmentData();
    if(!(data.students||[]).some(s=>s.id===studentId)){
      navigate("students");
      return;
    }
    selectedTeacherStudentId=studentId;
    currentRoute="studentprofile";
    try{localStorage.setItem(ROUTE_KEY,"students");}catch(error){}
    document.querySelectorAll("#p7Stage > .p7-page").forEach(p=>p.classList.remove("active"));
    const page=$("p7PageStudentProfile");
    if(page) page.classList.add("active");
    navButtons.concat(mobileButtons).forEach(b=>b.classList.toggle("active",b.dataset.route==="students"));
    renderTeacherStudentProfile();
  }

  function renderTeacherStudentProfile(){
    if(!session || session.role!=="teacher") return;
    const page=$("p7PageStudentProfile");
    if(!page) return;
    const data=assignmentData();
    const student=(data.students||[]).find(s=>s.id===selectedTeacherStudentId);
    if(!student){
      navigate("students");
      return;
    }

    const assignments=(data.assignments||[]).filter(a=>a.studentId===student.id);
    const active=assignments.filter(a=>!isCompleted(a));
    const completed=assignments.filter(isCompleted);
    const overdue=active.filter(teacherIsOverdue);
    const sessions=teacherStudentSessions(assignments);
    const weekStart=teacherWeekStart();
    const weekSessions=sessions.filter(s=>s.time>=weekStart);
    const weekMs=weekSessions.reduce((n,s)=>n+Number(s.practiceMs||0),0);
    const last=teacherLastPractice(assignments);
    const today=!!(last&&dateKey(last)===todayKey());
    const streak=teacherStudentStreak(assignments);
    const best=assignments.reduce((n,a)=>Math.max(n,Number(a.progress&&a.progress.highestSpeed)||0),0);
    const statusText=today?"Practised today":last?"Last practice "+teacherRelativeTime(last):"No practice recorded";
    const statusClass=today?"ok":overdue.length?"danger":"";

    const activeCards=active.map(a=>{
      const s=a.settings||{}, p=a.progress||{}, req=requirementProgress(a);
      const due=dueLabel(a);
      const status=assignmentStatus(a);
      const pct=Math.max(0,Math.min(100,Math.round((Math.min(req.done,req.count)/Math.max(1,req.count))*100)));
      return '<article class="p74-assignment-card">'+
        '<div class="p74-assignment-head"><div><span class="p7-assignment-status">'+escapeHtml(status.toUpperCase())+'</span><h3>'+escapeHtml(a.songTitle||"Assignment")+'</h3></div>'+
        (due?'<span class="p7-due '+(teacherIsOverdue(a)?"overdue":"")+'">'+escapeHtml(due)+'</span>':'')+'</div>'+
        '<div class="p74-assignment-specs">'+
          '<span><b>Bars</b> '+(s.startBar||1)+'–'+(s.endBar||1)+'</span>'+
          '<span><b>Speed</b> '+(s.startSpeed||100)+'% → '+(s.targetSpeed||100)+'%</span>'+
          '<span><b>Best</b> '+(Number(p.highestSpeed)||0)+'%</span>'+
          '<span><b>'+escapeHtml(req.label)+'</b> '+Math.min(req.done,req.count)+' / '+req.count+'</span>'+
        '</div>'+
        '<div class="p7-goal-track p74-goal-track"><i style="width:'+pct+'%"></i></div>'+
        (a.note?'<div class="p74-teacher-note-inline">'+escapeHtml(a.note)+'</div>':'')+
        '<div class="p74-assignment-actions"><button class="p7-secondary" data-profile-manage="'+escapeHtml(a.id)+'" type="button">Manage Assignment</button></div>'+
      '</article>';
    }).join("");

    const recentRows=sessions.slice(0,12).map(s=>{
      const detail=[];
      if(s.practiceMs) detail.push(fmtMinutes(s.practiceMs));
      if(s.highestSpeed) detail.push(s.highestSpeed+"%");
      if(s.reps) detail.push(s.reps+" reps");
      return '<div class="p74-session-row">'+
        '<div class="p74-session-date">'+escapeHtml(new Date(s.time).toLocaleDateString(undefined,{day:"numeric",month:"short"}))+'</div>'+
        '<div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(s.songTitle)+'</div><div class="p7-list-meta">'+escapeHtml(detail.join(" · ")||"Completed session")+'</div></div>'+
        '<span class="p7-activity-time">'+escapeHtml(teacherRelativeTime(s.time))+'</span></div>';
    }).join("");

    const historyRows=assignments.slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).map(a=>{
      const status=assignmentStatus(a), p=a.progress||{};
      return '<button class="p74-history-row" data-profile-manage="'+escapeHtml(a.id)+'" type="button">'+
        '<div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(a.songTitle||"Assignment")+'</div>'+
        '<div class="p7-list-meta">'+(a.dueDate?"Due "+escapeHtml(a.dueDate)+" · ":"")+(p.highestSpeed?"Best "+Number(p.highestSpeed)+"%":"No speed recorded")+'</div></div>'+
        '<span class="p7-attention-pill '+(status==="Completed"?"ok":status==="Overdue"?"danger":"")+'">'+escapeHtml(status)+'</span></button>';
    }).join("");

    page.innerHTML=
      '<div class="p74-profile-top">'+
        '<button id="p74Back" class="p74-back" type="button">← Students</button>'+
        '<div class="p74-profile-heading"><div class="p74-avatar">'+escapeHtml((student.name||"S").trim().charAt(0).toUpperCase())+'</div>'+
          '<div><div class="p7-eyebrow">Student profile</div><h1>'+escapeHtml(student.name||"Student")+'</h1><span class="p7-attention-pill '+statusClass+'">'+escapeHtml(statusText)+'</span></div></div>'+
        '<div class="p74-profile-actions"><button id="p74Manage" class="p7-secondary" type="button">Manage Assignments</button><button id="p74NewAssignment" class="p7-primary" type="button">+ New Assignment</button></div>'+
      '</div>'+
      '<div class="p7-metrics p74-metrics">'+
        metric("This week",fmtMinutes(weekMs),"Completed practice time")+
        metric("Sessions",weekSessions.length,"Completed this week")+
        metric("Streak",streak+" day"+(streak===1?"":"s"),"Current practice streak")+
        metric("Overdue",overdue.length,"Assignments needing attention")+
      '</div>'+
      '<div class="p74-profile-grid">'+
        '<section class="p7-card p74-active"><div class="p7-card-heading"><div><div class="p7-card-title">Active assignments</div><div class="p7-card-sub">'+active.length+' currently active · Highest speed '+(best?best+"%":"—")+'</div></div><span class="p7-count-chip">'+active.length+'</span></div>'+
          '<div class="p74-assignment-list">'+(activeCards||'<div class="p7-empty">No active assignments.</div>')+'</div></section>'+
        '<aside class="p7-card p74-notes"><div class="p7-card-title">Teacher notes</div><div class="p7-card-sub">Private teacher-only notes. Students cannot see these in their account.</div>'+
          '<textarea id="p74Notes" maxlength="4000" placeholder="Lesson focus, technique reminders, goals…" disabled></textarea>'+
          '<div class="p74-note-actions"><span id="p74NoteStatus">Loading note…</span><button id="p74SaveNotes" class="p7-primary" type="button" disabled>Save Notes</button></div></aside>'+
        '<section class="p7-card p74-recent"><div class="p7-card-title">Recent practice</div><div class="p7-card-sub">Completed sessions, newest first.</div>'+
          '<div class="p74-session-list">'+(recentRows||'<div class="p7-empty">No completed practice sessions yet.</div>')+'</div></section>'+
        '<section class="p7-card p74-history"><div class="p7-card-heading"><div><div class="p7-card-title">Assignment history</div><div class="p7-card-sub">'+completed.length+' completed · '+assignments.length+' total</div></div></div>'+
          '<div class="p74-history-list">'+(historyRows||'<div class="p7-empty">No assignments yet.</div>')+'</div></section>'+
      '</div>';

    $("p74Back").onclick=()=>navigate("students");
    $("p74Manage").onclick=()=>openTeacherAssignmentManager(student.id);
    $("p74NewAssignment").onclick=()=>openAssignmentWizard(student.id);
    page.querySelectorAll("[data-profile-manage]").forEach(b=>b.onclick=()=>openTeacherAssignmentManager(student.id));

    const notes=$("p74Notes"), save=$("p74SaveNotes"), noteStatus=$("p74NoteStatus");
    if(notes){
      notes.addEventListener("input",()=>{
        if(noteStatus) noteStatus.textContent=notes.value.length.toLocaleString()+" / 4,000";
      });
    }
    if(save){
      save.onclick=async()=>{
        save.disabled=true;
        if(noteStatus) noteStatus.textContent="Saving…";
        try{
          const ok=await saveTeacherNote(student.id,notes?notes.value:"");
          if(noteStatus) noteStatus.textContent=ok?"Saved to cloud":"Could not save note";
        }catch(error){
          console.error("Teacher note save failed",error);
          if(noteStatus) noteStatus.textContent="Could not save note";
        }finally{
          save.disabled=false;
        }
      };
    }
    loadTeacherNote(student.id);
  }


  function wizardStudent(){
    const data=assignmentData();
    return (data.students||[]).find(s=>assignmentWizard&&s.id===assignmentWizard.studentId)||null;
  }

  function wizardSong(){
    return assignmentWizardSongs.find(s=>assignmentWizard&&s.id===assignmentWizard.songId)||null;
  }

  function wizardFrequencyLabel(period,count){
    if(period==="day") return count+"× per day";
    if(period==="week") return count+"× per week";
    return count+" session"+(count===1?"":"s")+" total";
  }

  function showAssignmentWizardPage(){
    currentRoute="assignmentwizard";
    try{localStorage.setItem(ROUTE_KEY,"assignments");}catch(error){}
    document.querySelectorAll("#p7Stage > .p7-page").forEach(p=>p.classList.remove("active"));
    const page=$("p7PageAssignmentWizard");
    if(page) page.classList.add("active");
    navButtons.concat(mobileButtons).forEach(b=>b.classList.toggle("active",b.dataset.route==="assignments"));
  }

  async function loadAssignmentWizardSongs(){
    try{
      const api=window.DTMusicTrainerLibrary;
      const rows=api&&typeof api.getAllSongs==="function" ? await Promise.resolve(api.getAllSongs()) : [];
      assignmentWizardSongs=Array.isArray(rows)?rows.slice().sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""))):[];
    }catch(error){
      console.error("Assignment wizard library load failed",error);
      assignmentWizardSongs=[];
    }
  }

  async function openAssignmentWizard(studentId){
    if(!session || session.role!=="teacher") return;
    const data=assignmentData();
    const students=data.students||[];
    const preferred=studentId ? (students.find(s=>s.id===studentId)||null) : null;

    assignmentWizard={
      step:preferred?2:1,
      studentId:preferred?preferred.id:"",
      songId:"",
      startBar:1,
      endBar:4,
      startSpeed:60,
      targetSpeed:100,
      increment:5,
      repsPerStep:3,
      source:"either",
      requirementCount:1,
      requirementPeriod:"day",
      dueDate:"",
      note:"",
      countIn:true,
      created:null,
      error:"",
      songsLoading:true
    };
    assignmentWizardSongs=[];
    showAssignmentWizardPage();
    renderAssignmentWizard(true);
    await loadAssignmentWizardSongs();
    if(assignmentWizard) assignmentWizard.songsLoading=false;
    if(currentRoute==="assignmentwizard") renderAssignmentWizard(false);
  }

  function wizardStepsHtml(){
    const current=assignmentWizard?assignmentWizard.step:1;
    const steps=[["1","Student"],["2","Song"],["3","Practice"],["4","Review"]];
    return '<div class="p75-steps">'+steps.map((s,i)=>{
      const n=i+1, cls=current===5?"done":current>n?"done":current===n?"active":"";
      return '<div class="p75-step '+cls+'"><b>'+(current>n||current===5?"✓":s[0])+'</b><span>'+s[1]+'</span></div>';
    }).join("")+'</div>';
  }

  function renderWizardSongChoices(filter){
    const host=$("p75SongChoices");
    if(!host) return;
    const query=String(filter||"").trim().toLowerCase();
    const rows=assignmentWizardSongs.filter(s=>!query||String(s.title||"").toLowerCase().includes(query));
    host.innerHTML=rows.map(s=>{
      const assignable=!!s.interactive;
      const selected=assignmentWizard&&assignmentWizard.songId===s.id;
      const badges=[
        s.interactive?"Interactive ✓":"No interactive score",
        s.pdf?"PDF ✓":"",
        s.audio?"Backing ✓":""
      ].filter(Boolean);
      return '<button class="p75-song-card '+(selected?"selected ":"")+(assignable?"":"disabled")+'" type="button" '+(assignable?'data-wizard-song="'+escapeHtml(s.id)+'"':'disabled')+'>'+
        '<div><strong>'+escapeHtml(s.title||"Untitled Song")+'</strong><span>'+badges.map(escapeHtml).join(" · ")+'</span></div>'+
        '<b class="p75-song-check">'+(selected?"✓":assignable?"›":"—")+'</b></button>';
    }).join("") || '<div class="p7-empty">No songs match your search.</div>';

    host.querySelectorAll("[data-wizard-song]").forEach(b=>b.onclick=()=>{
      const song=assignmentWizardSongs.find(s=>s.id===b.dataset.wizardSong);
      if(!song) return;
      assignmentWizard.songId=song.id;
      if(assignmentWizard.source==="backing"&&!song.audio) assignmentWizard.source="either";
      renderWizardSongChoices($("p75SongSearch")?$("p75SongSearch").value:"");
      const next=$("p75WizardNext"); if(next) next.disabled=false;
    });
  }

  function readWizardPracticeForm(){
    const num=(id,fallback,min,max)=>{
      const el=$(id), raw=Math.round(Number(el&&el.value));
      return Math.max(min,Math.min(max,Number.isFinite(raw)?raw:fallback));
    };
    let start=num("p75StartBar",1,1,9999);
    let end=num("p75EndBar",start,1,9999);
    if(end<start) [start,end]=[end,start];
    assignmentWizard.startBar=start;
    assignmentWizard.endBar=end;
    assignmentWizard.startSpeed=num("p75StartSpeed",60,25,150);
    assignmentWizard.targetSpeed=Math.max(assignmentWizard.startSpeed,num("p75TargetSpeed",100,25,150));
    assignmentWizard.increment=num("p75Increment",5,1,25);
    assignmentWizard.repsPerStep=num("p75Reps",3,1,20);
    assignmentWizard.requirementCount=num("p75RequirementCount",1,1,20);
    assignmentWizard.requirementPeriod=$("p75RequirementPeriod")?$("p75RequirementPeriod").value:"day";
    if(!["day","week","total"].includes(assignmentWizard.requirementPeriod)) assignmentWizard.requirementPeriod="day";
    assignmentWizard.source=$("p75Source")?$("p75Source").value:"either";
    if(!["either","synth","backing"].includes(assignmentWizard.source)) assignmentWizard.source="either";
    assignmentWizard.dueDate=$("p75DueDate")?$("p75DueDate").value:"";
    assignmentWizard.note=String($("p75Note")?$("p75Note").value:"").trim().slice(0,2000);
    assignmentWizard.countIn=!!($("p75CountIn")&&$("p75CountIn").checked);
  }

  function renderAssignmentWizard(loading){
    const page=$("p7PageAssignmentWizard");
    if(!page || !assignmentWizard) return;
    loading=!!assignmentWizard.songsLoading;
    const data=assignmentData();
    const students=data.students||[];
    const student=wizardStudent();
    const song=wizardSong();
    const step=assignmentWizard.step;

    if(step===5 && assignmentWizard.created){
      page.innerHTML=
        '<div class="p75-wizard-shell"><button id="p75Cancel" class="p74-back" type="button">← Assignments</button>'+
        '<div class="p75-success"><div class="p75-success-icon">✓</div><div class="p7-eyebrow">Assignment created</div>'+
        '<h1>'+escapeHtml(assignmentWizard.created.songTitle||"Assignment")+'</h1>'+
        '<p>Assigned to '+escapeHtml(student?student.name:"student")+'. The existing cloud sync and Google Drive material workflow will take it from here.</p>'+
        '<div class="p75-success-actions"><button id="p75ViewStudent" class="p7-primary" type="button">View Student Profile</button>'+
        '<button id="p75Another" class="p7-secondary" type="button">Create Another</button></div></div></div>';
      $("p75Cancel").onclick=()=>navigate("assignments");
      $("p75ViewStudent").onclick=()=>student&&openTeacherStudent(student.id);
      $("p75Another").onclick=()=>openAssignmentWizard(student?student.id:"");
      return;
    }

    let body="";
    if(step===1){
      body='<div class="p75-step-content"><div class="p75-step-heading"><div class="p7-eyebrow">Step 1 of 4</div><h1>Who is this for?</h1><p>Choose the student receiving this assignment.</p></div>'+
        '<div class="p75-student-grid">'+students.map(s=>'<button class="p75-student-card '+(assignmentWizard.studentId===s.id?"selected":"")+'" data-wizard-student="'+escapeHtml(s.id)+'" type="button">'+
          '<div class="p7-teacher-student-avatar">'+escapeHtml((s.name||"S").trim().charAt(0).toUpperCase())+'</div><strong>'+escapeHtml(s.name||"Student")+'</strong><span>'+(assignmentWizard.studentId===s.id?"Selected":"Choose student")+'</span></button>').join("")+
        (students.length?"":'<div class="p7-empty">No students yet. Add a student first.<br><button id="p75ManageStudents" class="p7-secondary" type="button" style="margin-top:10px">Manage Students</button></div>')+'</div></div>';
    }else if(step===2){
      body='<div class="p75-step-content"><div class="p75-step-heading"><div class="p7-eyebrow">Step 2 of 4</div><h1>Choose a song</h1><p>'+(student?"For "+escapeHtml(student.name)+". ":"")+'Only songs with an interactive score can be assigned for guided practice.</p></div>'+
        '<input id="p75SongSearch" class="p75-search" type="search" placeholder="Search song library…" />'+
        '<div id="p75SongChoices" class="p75-song-list">'+(loading?'<div class="p7-empty">Loading song library…</div>':'')+'</div>'+
        (!loading&&!assignmentWizardSongs.some(s=>s.interactive)?'<button id="p75GoLibrary" class="p7-secondary" type="button">Go to Song Library</button>':'')+'</div>';
    }else if(step===3){
      const hasBacking=!!(song&&song.audio);
      body='<div class="p75-step-content"><div class="p75-step-heading"><div class="p7-eyebrow">Step 3 of 4</div><h1>Set the practice goal</h1><p>'+escapeHtml(song?song.title:"Song")+' for '+escapeHtml(student?student.name:"student")+'.</p></div>'+
        '<div class="p75-form">'+
          '<div class="p75-form-section"><h3>Section</h3><div class="p75-form-grid two">'+
            '<label>Start bar<input id="p75StartBar" type="number" min="1" value="'+assignmentWizard.startBar+'"></label>'+
            '<label>End bar<input id="p75EndBar" type="number" min="1" value="'+assignmentWizard.endBar+'"></label></div></div>'+
          '<div class="p75-form-section"><h3>Speed progression</h3><div class="p75-form-grid three">'+
            '<label>Start %<input id="p75StartSpeed" type="number" min="25" max="150" value="'+assignmentWizard.startSpeed+'"></label>'+
            '<label>Target %<input id="p75TargetSpeed" type="number" min="25" max="150" value="'+assignmentWizard.targetSpeed+'"></label>'+
            '<label>Increase %<input id="p75Increment" type="number" min="1" max="25" value="'+assignmentWizard.increment+'"></label></div>'+
            '<div class="p75-form-grid two"><label>Reps before increase<input id="p75Reps" type="number" min="1" max="20" value="'+assignmentWizard.repsPerStep+'"></label>'+
            '<label>Player<select id="p75Source"><option value="either" '+(assignmentWizard.source==="either"?"selected":"")+'>Student choice</option><option value="synth" '+(assignmentWizard.source==="synth"?"selected":"")+'>Synth</option><option value="backing" '+(assignmentWizard.source==="backing"?"selected":"")+' '+(hasBacking?"":"disabled")+'>Synced backing'+(hasBacking?"":" — unavailable")+'</option></select></label></div></div>'+
          '<div class="p75-form-section"><h3>Practice requirement</h3><div class="p75-form-grid two">'+
            '<label>Required<input id="p75RequirementCount" type="number" min="1" max="20" value="'+assignmentWizard.requirementCount+'"></label>'+
            '<label>Frequency<select id="p75RequirementPeriod"><option value="day" '+(assignmentWizard.requirementPeriod==="day"?"selected":"")+'>Per day</option><option value="week" '+(assignmentWizard.requirementPeriod==="week"?"selected":"")+'>Per week</option><option value="total" '+(assignmentWizard.requirementPeriod==="total"?"selected":"")+'>Total sessions</option></select></label></div>'+
            '<label class="p75-wide-label">Due date <span>optional</span><input id="p75DueDate" type="date" value="'+escapeHtml(assignmentWizard.dueDate)+'"></label></div>'+
          '<div class="p75-form-section"><h3>Instructions</h3><label class="p75-wide-label">Teacher note <span>optional</span><textarea id="p75Note" maxlength="2000" placeholder="e.g. Keep the chord changes even and clean.">'+escapeHtml(assignmentWizard.note)+'</textarea></label>'+
            '<label class="p75-check"><input id="p75CountIn" type="checkbox" '+(assignmentWizard.countIn?"checked":"")+'> Count-in before every repetition</label></div>'+
        '</div></div>';
    }else{
      body='<div class="p75-step-content"><div class="p75-step-heading"><div class="p7-eyebrow">Step 4 of 4</div><h1>Review assignment</h1><p>Check everything before it is sent to the student.</p></div>'+
        '<div class="p75-review-card"><div class="p75-review-title"><span>Student</span><strong>'+escapeHtml(student?student.name:"—")+'</strong></div>'+
          '<div class="p75-review-title"><span>Song</span><strong>'+escapeHtml(song?song.title:"—")+'</strong></div>'+
          '<div class="p75-review-grid">'+
            '<div><span>Bars</span><strong>'+assignmentWizard.startBar+'–'+assignmentWizard.endBar+'</strong></div>'+
            '<div><span>Speed</span><strong>'+assignmentWizard.startSpeed+'% → '+assignmentWizard.targetSpeed+'%</strong></div>'+
            '<div><span>Progression</span><strong>+'+assignmentWizard.increment+'% every '+assignmentWizard.repsPerStep+' reps</strong></div>'+
            '<div><span>Practice</span><strong>'+escapeHtml(wizardFrequencyLabel(assignmentWizard.requirementPeriod,assignmentWizard.requirementCount))+'</strong></div>'+
            '<div><span>Player</span><strong>'+escapeHtml(assignmentWizard.source==="either"?"Student choice":assignmentWizard.source==="synth"?"Synth":"Synced backing")+'</strong></div>'+
            '<div><span>Due</span><strong>'+escapeHtml(assignmentWizard.dueDate||"No due date")+'</strong></div>'+
          '</div>'+
          (assignmentWizard.note?'<div class="p75-review-note"><span>Teacher note</span><p>'+escapeHtml(assignmentWizard.note)+'</p></div>':'')+
          '<div class="p75-review-countin">'+(assignmentWizard.countIn?"✓ Count-in before every repetition":"Count-in disabled")+'</div>'+
        '</div></div>';
    }

    page.innerHTML='<div class="p75-wizard-shell">'+
      '<div class="p75-wizard-top"><button id="p75Cancel" class="p74-back" type="button">← Assignments</button><div><div class="p7-eyebrow">Phase 7.5</div><strong>New Assignment</strong></div></div>'+
      wizardStepsHtml()+
      (assignmentWizard.error?'<div class="p75-error">'+escapeHtml(assignmentWizard.error)+'</div>':'')+
      body+
      '<div class="p75-wizard-actions"><button id="p75WizardBack" class="p7-secondary" type="button" '+(step===1?"disabled":"")+'>Back</button>'+
      (step===4?'<button id="p75WizardAssign" class="p7-primary" type="button">Assign to Student</button>':'<button id="p75WizardNext" class="p7-primary" type="button">Continue</button>')+'</div></div>';

    $("p75Cancel").onclick=()=>navigate("assignments");
    const back=$("p75WizardBack");
    if(back) back.onclick=()=>{ if(step===3) readWizardPracticeForm(); assignmentWizard.error=""; assignmentWizard.step=Math.max(1,step-1); renderAssignmentWizard(false); };

    if(step===1){
      page.querySelectorAll("[data-wizard-student]").forEach(b=>b.onclick=()=>{
        assignmentWizard.studentId=b.dataset.wizardStudent;
        renderAssignmentWizard(false);
      });
      const manageStudents=$("p75ManageStudents"); if(manageStudents) manageStudents.onclick=()=>openAssignments("teacher");
      const next=$("p75WizardNext");
      if(next){ next.disabled=!assignmentWizard.studentId; next.onclick=()=>{ if(!assignmentWizard.studentId)return; assignmentWizard.step=2; renderAssignmentWizard(false); renderWizardSongChoices(""); }; }
    }else if(step===2){
      const search=$("p75SongSearch");
      if(search) search.addEventListener("input",()=>{ if(!loading) renderWizardSongChoices(search.value); });
      if(!loading) renderWizardSongChoices("");
      const lib=$("p75GoLibrary"); if(lib) lib.onclick=()=>navigate("library");
      const next=$("p75WizardNext");
      if(next){ next.disabled=loading||!assignmentWizard.songId; next.onclick=()=>{ if(loading||!assignmentWizard.songId)return; assignmentWizard.step=3; renderAssignmentWizard(false); }; }
    }else if(step===3){
      const next=$("p75WizardNext");
      if(next) next.onclick=()=>{ readWizardPracticeForm(); assignmentWizard.error=""; assignmentWizard.step=4; renderAssignmentWizard(false); };
    }else if(step===4){
      const assign=$("p75WizardAssign");
      if(assign) assign.onclick=()=>{
        assignmentWizard.error="";
        assign.disabled=true;
        assign.textContent="Assigning…";
        try{
          const api=window.DTMusicTrainerAssignments;
          if(!api||typeof api.createAssignment!=="function") throw new Error("Assignment system is not ready.");
          const selectedSong=wizardSong();
          const created=api.createAssignment({
            studentId:assignmentWizard.studentId,
            songId:assignmentWizard.songId,
            songTitle:selectedSong&&selectedSong.title,
            startBar:assignmentWizard.startBar,
            endBar:assignmentWizard.endBar,
            startSpeed:assignmentWizard.startSpeed,
            targetSpeed:assignmentWizard.targetSpeed,
            increment:assignmentWizard.increment,
            repsPerStep:assignmentWizard.repsPerStep,
            source:assignmentWizard.source,
            requirementCount:assignmentWizard.requirementCount,
            requirementPeriod:assignmentWizard.requirementPeriod,
            dueDate:assignmentWizard.dueDate,
            note:assignmentWizard.note,
            countIn:assignmentWizard.countIn
          });
          assignmentWizard.created=created;
          assignmentWizard.step=5;
          renderAssignmentWizard(false);
        }catch(error){
          console.error("Assignment wizard create failed",error);
          assignmentWizard.error=error&&error.message?error.message:"Could not create assignment.";
          renderAssignmentWizard(false);
        }
      };
    }
  }

  function renderTeacherDashboard(){
    const data=assignmentData();
    const students=data.students||[];
    const assignments=data.assignments||[];
    const weekStart=teacherWeekStart();
    const sessions=teacherSessions(data);
    const weekSessions=sessions.filter(s=>s.time>=weekStart);
    const weekMinutes=weekSessions.reduce((n,s)=>n+Number(s.practiceMs||0),0);

    const summaries=students.map(s=>{
      const mine=assignments.filter(a=>a.studentId===s.id);
      const active=mine.filter(a=>!isCompleted(a));
      const overdue=active.filter(teacherIsOverdue);
      const last=teacherLastPractice(mine);
      const practicedToday=last && dateKey(last)===todayKey();
      const inactiveDays=last?Math.floor((Date.now()-last)/86400000):null;
      let attention="";
      let priority=0;
      if(overdue.length){
        attention=overdue.length+" overdue assignment"+(overdue.length===1?"":"s");
        priority=3;
      }else if(active.length && !last){
        attention="Has assignments but no practice yet";
        priority=2;
      }else if(active.length && inactiveDays>=7){
        attention="No practice for "+inactiveDays+" days";
        priority=2;
      }else if(active.length && inactiveDays>=4){
        attention="Last practice "+inactiveDays+" days ago";
        priority=1;
      }
      return {student:s,mine,active,overdue,last,practicedToday,inactiveDays,attention,priority};
    });

    const practicedTodayCount=summaries.filter(x=>x.practicedToday).length;
    const weekStudents=new Set(summaries.filter(x=>x.last&&x.last>=weekStart).map(x=>x.student.id));
    const active=assignments.filter(a=>!isCompleted(a));
    const overdue=active.filter(teacherIsOverdue);
    const attention=summaries.filter(x=>x.priority>0).sort((a,b)=>b.priority-a.priority || (a.last||0)-(b.last||0));

    const attentionRows=attention.slice(0,6).map(x=>{
      const tone=x.priority>=3?"danger":x.priority===2?"warn":"";
      return '<button class="p7-teacher-attention-row" data-teacher-student="'+escapeHtml(x.student.id)+'" type="button">'+
        '<div class="p7-teacher-student-avatar">'+escapeHtml((x.student.name||"S").trim().charAt(0).toUpperCase())+'</div>'+
        '<div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(x.student.name||"Student")+'</div><div class="p7-list-meta">'+escapeHtml(x.attention)+'</div></div>'+
        '<span class="p7-attention-pill '+tone+'">'+(x.overdue.length?"Follow up":"Check in")+'</span></button>';
    }).join("");

    const recentRows=sessions.slice(0,7).map(s=>{
      const details=[];
      if(s.practiceMs) details.push(fmtMinutes(s.practiceMs));
      if(s.highestSpeed) details.push(s.highestSpeed+"%");
      if(s.reps) details.push(s.reps+" reps");
      return '<button class="p7-teacher-activity-row" data-teacher-student="'+escapeHtml(s.studentId)+'" type="button">'+
        '<div class="p7-activity-dot"></div>'+
        '<div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(s.studentName)+' · '+escapeHtml(s.songTitle)+'</div>'+
        '<div class="p7-list-meta">'+escapeHtml(details.join(" · ")||"Completed practice session")+'</div></div>'+
        '<span class="p7-activity-time">'+escapeHtml(teacherRelativeTime(s.time))+'</span></button>';
    }).join("");

    const dueSoon=active.filter(a=>a.dueDate).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).slice(0,5);
    const studentMap=new Map(students.map(s=>[s.id,s]));
    const dueRows=dueSoon.map(a=>{
      const who=studentMap.get(a.studentId);
      const due=dueLabel(a)||("Due "+a.dueDate);
      return '<button class="p7-teacher-due-row" data-teacher-student="'+escapeHtml(a.studentId)+'" type="button">'+
        '<div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(a.songTitle||"Assignment")+'</div>'+
        '<div class="p7-list-meta">'+escapeHtml((who&&who.name)||"Student")+'</div></div>'+
        '<span class="p7-due '+(teacherIsOverdue(a)?"overdue":"")+'">'+escapeHtml(due)+'</span></button>';
    }).join("");

    $("p7PageDashboard").innerHTML=
      pageHead("Teacher dashboard","Welcome back, "+escapeHtml((session&&session.displayName)||"Teacher"),"See who is practising, who needs attention, and what is coming up — without opening each student one by one.",
        '<button id="p7DashAssign" class="p7-primary" type="button">+ New assignment</button>')+
      '<div class="p7-metrics p7-teacher-metrics">'+
        metric("Students",students.length,"Current profiles")+
        metric("Practised today",practicedTodayCount,"Students active today")+
        metric("This week",weekStudents.size,"Students practised")+
        metric("Overdue",overdue.length,"Assignments to follow up")+
      '</div>'+
      '<div class="p7-teacher-week-card">'+
        '<div><div class="p7-eyebrow">This week</div><strong>'+weekSessions.length+'</strong><span>completed sessions</span></div>'+
        '<div><strong>'+fmtMinutes(weekMinutes)+'</strong><span>completed session time</span></div>'+
        '<div><strong>'+active.length+'</strong><span>active assignments</span></div>'+
        '<button id="p7TeacherAllStudents" class="p7-secondary" type="button">View all students</button>'+
      '</div>'+
      '<div class="p7-teacher-dashboard-grid">'+
        '<section class="p7-card p7-teacher-attention"><div class="p7-card-heading"><div><div class="p7-card-title">Needs attention</div><div class="p7-card-sub">Overdue work and students who have gone quiet.</div></div><span class="p7-count-chip">'+attention.length+'</span></div>'+
          '<div class="p7-teacher-list">'+(attentionRows||'<div class="p7-empty">Nothing urgent right now. Nice.</div>')+'</div></section>'+
        '<section class="p7-card"><div class="p7-card-title">Recent practice</div><div class="p7-card-sub">Latest completed student sessions.</div>'+
          '<div class="p7-teacher-list">'+(recentRows||'<div class="p7-empty">No completed practice sessions yet.</div>')+'</div></section>'+
        '<section class="p7-card"><div class="p7-card-title">Assignments coming up</div><div class="p7-card-sub">Closest due dates first.</div>'+
          '<div class="p7-teacher-list">'+(dueRows||'<div class="p7-empty">No assignments with due dates.</div>')+'</div></section>'+
        '<section class="p7-card"><div class="p7-card-title">Quick actions</div><div class="p7-card-sub">Get to the common jobs quickly.</div><div class="p7-quick-grid">'+
          '<button class="p7-quick" data-p7-go="students"><strong>Students</strong><span>See the whole class at a glance</span></button>'+
          '<button class="p7-quick" data-p7-open-assign><strong>Assign work</strong><span>Create or manage assignments</span></button>'+
          '<button class="p7-quick" data-p7-go="library"><strong>Song library</strong><span>Scores and backing tracks</span></button>'+
          '<button class="p7-quick" data-p7-go="practice"><strong>Practice tools</strong><span>Open the score player</span></button>'+
        '</div></section>'+
      '</div>';

    const assign=$("p7DashAssign"); if(assign) assign.onclick=()=>openAssignmentWizard();
    const allStudents=$("p7TeacherAllStudents"); if(allStudents) allStudents.onclick=()=>navigate("students");
    $("p7PageDashboard").querySelectorAll("[data-p7-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.p7Go));
    $("p7PageDashboard").querySelectorAll("[data-teacher-student]").forEach(b=>b.onclick=()=>openTeacherStudent(b.dataset.teacherStudent));
    const quick=$("p7PageDashboard").querySelector("[data-p7-open-assign]"); if(quick) quick.onclick=()=>openAssignmentWizard();
  }

  function studentAssignmentList(){
    const data=assignmentData();
    const sid=session&&session.studentId;
    return (data.assignments||[]).filter(a=>!sid||a.studentId===sid);
  }

  function assignmentById(id){
    return studentAssignmentList().find(a=>a.id===id) || null;
  }

  function activeAssignment(){
    const id=localStorage.getItem("dtmtp-active-assignment") || "";
    return assignmentById(id);
  }

  function dateKey(value){
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime())) return "";
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }

  function weekStartKey(value){
    const d=value instanceof Date?new Date(value.getTime()):new Date(value);
    if(Number.isNaN(d.getTime())) return "";
    d.setHours(0,0,0,0);
    const day=(d.getDay()+6)%7;
    d.setDate(d.getDate()-day);
    return dateKey(d);
  }

  function requirementProgress(a){
    const req=a&&a.requirement?a.requirement:{count:1,period:"total"};
    const count=Math.max(1,Number(req.count)||1);
    const period=["day","week","total"].includes(req.period)?req.period:"total";
    const sessions=(a&&a.progress&&Array.isArray(a.progress.sessions))?a.progress.sessions:[];
    let done=0,label="Total";
    if(period==="day"){
      const key=dateKey(new Date());
      done=sessions.filter(s=>dateKey(s.completedAt)===key).length;
      label="Today";
    }else if(period==="week"){
      const key=weekStartKey(new Date());
      done=sessions.filter(s=>weekStartKey(s.completedAt)===key).length;
      label="This week";
    }else{
      done=sessions.length;
    }
    return {count,period,done,met:done>=count,label};
  }

  function dueLabel(a){
    if(!a||!a.dueDate) return "";
    const due=new Date(a.dueDate+"T23:59:59");
    if(Number.isNaN(due.getTime())) return "";
    const days=Math.ceil((due.getTime()-Date.now())/86400000);
    if(days<0) return "Overdue";
    if(days===0) return "Due today";
    if(days===1) return "Due tomorrow";
    return "Due "+due.toLocaleDateString(undefined,{day:"numeric",month:"short"});
  }

  function studentAssignmentSort(list){
    return list.slice().sort((a,b)=>{
      const ac=isCompleted(a)?1:0, bc=isCompleted(b)?1:0;
      if(ac!==bc) return ac-bc;
      const ad=a.dueDate||"9999-12-31", bd=b.dueDate||"9999-12-31";
      return ad.localeCompare(bd) || String(b.createdAt||"").localeCompare(String(a.createdAt||""));
    });
  }

  function sessionDays(){
    const keys=new Set();
    studentAssignmentList().forEach(a=>{
      const sessions=a&&a.progress&&Array.isArray(a.progress.sessions)?a.progress.sessions:[];
      sessions.forEach(s=>{ const key=dateKey(s.completedAt); if(key) keys.add(key); });
    });
    return keys;
  }

  function practiceStreak(){
    const days=sessionDays();
    if(!days.size) return 0;
    let cursor=new Date();
    cursor.setHours(0,0,0,0);
    if(!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate()-1);
    let streak=0;
    while(days.has(dateKey(cursor))){
      streak++;
      cursor.setDate(cursor.getDate()-1);
    }
    return streak;
  }

  function startStudentAssignment(id){
    const a=assignmentById(id);
    if(!a) return;
    try{ localStorage.setItem(ROUTE_KEY,"practice"); }catch(error){}
    navigate("practice");
    updateStudentPracticeGuide({assignment:a,message:"Preparing your materials…"});
    if(window.DTMusicTrainerAssignments && typeof window.DTMusicTrainerAssignments.loadAssignment==="function"){
      window.DTMusicTrainerAssignments.loadAssignment(id);
    }
  }

  function renderStudentHome(){
    const list=studentAssignmentSort(studentAssignmentList());
    const active=list.filter(a=>!isCompleted(a));
    const next=active[0]||null;
    const todayDone=list.filter(practicedToday).length;
    const totalMs=list.reduce((n,a)=>n+Number(a.progress&&a.progress.practiceMs||0),0);
    const best=list.reduce((n,a)=>Math.max(n,Number(a.progress&&a.progress.highestSpeed||0)),0);
    const streak=practiceStreak();

    let today='<div class="p7-student-empty"><div class="p7-student-empty-icon">✓</div><strong>You are all caught up</strong><span>No active assignments right now.</span></div>';
    if(next){
      const s=next.settings||{};
      const req=requirementProgress(next);
      const due=dueLabel(next);
      today='<div class="p7-today-card">'+
        '<div class="p7-today-top"><div><div class="p7-today-kicker">NEXT UP</div><div class="p7-today-title">'+escapeHtml(next.songTitle||"Practice assignment")+'</div></div>'+
        (due?'<span class="p7-due '+(due==="Overdue"?"overdue":"")+'">'+escapeHtml(due)+'</span>':'')+'</div>'+
        '<div class="p7-assignment-specs">'+
          '<span><b>Bars</b> '+(s.startBar||1)+'–'+(s.endBar||1)+'</span>'+
          '<span><b>Speed</b> '+(s.startSpeed||100)+'% → '+(s.targetSpeed||100)+'%</span>'+
          '<span><b>'+escapeHtml(req.label)+'</b> '+Math.min(req.done,req.count)+' / '+req.count+'</span>'+
        '</div>'+
        (next.note?'<div class="p7-today-note"><strong>From your teacher</strong><br>'+escapeHtml(next.note)+'</div>':'')+
        '<button class="p7-big-action" data-student-start="'+escapeHtml(next.id)+'" type="button">▶ Start Practice</button></div>';
    }

    const upcoming=active.slice(1,4).map(a=>{
      const s=a.settings||{}, due=dueLabel(a), req=requirementProgress(a);
      return '<button class="p7-student-assignment-row" data-student-start="'+escapeHtml(a.id)+'" type="button">'+
        '<div><strong>'+escapeHtml(a.songTitle||"Assignment")+'</strong><span>Bars '+(s.startBar||1)+'–'+(s.endBar||1)+' · '+Math.min(req.done,req.count)+'/'+req.count+' '+req.label.toLowerCase()+'</span></div>'+
        '<div class="p7-student-row-side">'+(due?'<span>'+escapeHtml(due)+'</span>':'')+'<b>›</b></div></button>';
    }).join("");

    $("p7PageHome").innerHTML=
      '<div class="p7-student-welcome"><div><div class="p7-eyebrow">Student home</div><h1>Hi, '+escapeHtml((session&&session.displayName)||"Student")+'</h1><p>Everything you need for today is right here.</p></div>'+
      '<div class="p7-streak-pill">🔥 <strong>'+streak+'</strong><span>day streak</span></div></div>'+
      '<div class="p7-student-home-grid"><div><div class="p7-section-label">Today\'s practice</div>'+today+'</div>'+
      '<div class="p7-student-side-card"><div class="p7-card-title">Your progress</div>'+
        '<div class="p7-student-stat"><strong>'+todayDone+'</strong><span>practised today</span></div>'+
        '<div class="p7-student-stat"><strong>'+fmtMinutes(totalMs)+'</strong><span>total practice time</span></div>'+
        '<div class="p7-student-stat"><strong>'+(best?best+"%":"—")+'</strong><span>highest speed</span></div>'+
        '<button id="p7ViewProgress" class="p7-secondary p7-full-button" type="button">View my progress</button></div></div>'+
      '<div class="p7-home-upcoming"><div class="p7-section-heading"><div><div class="p7-section-label">Coming up</div><strong>More assignments</strong></div><button id="p7ViewAllAssignments" type="button">View all</button></div>'+
      (upcoming||'<div class="p7-student-empty compact"><span>No other active assignments.</span></div>')+'</div>';

    $("p7PageHome").querySelectorAll("[data-student-start]").forEach(b=>b.onclick=()=>startStudentAssignment(b.dataset.studentStart));
    const progress=$("p7ViewProgress"); if(progress) progress.onclick=()=>navigate("progress");
    const all=$("p7ViewAllAssignments"); if(all) all.onclick=()=>navigate("assignments");
  }

  function renderStudents(){
    const data=assignmentData();
    const students=data.students||[];
    const assignments=data.assignments||[];
    const weekStart=teacherWeekStart();

    const rows=students.map(s=>{
      const mine=assignments.filter(a=>a.studentId===s.id);
      const active=mine.filter(a=>!isCompleted(a));
      const overdue=active.filter(teacherIsOverdue);
      const last=teacherLastPractice(mine);
      const weekSessions=[];
      mine.forEach(a=>{
        const sessions=a&&a.progress&&Array.isArray(a.progress.sessions)?a.progress.sessions:[];
        sessions.forEach(x=>{
          const t=new Date(x.completedAt||"").getTime();
          if(Number.isFinite(t)&&t>=weekStart) weekSessions.push(x);
        });
      });
      const weekMs=weekSessions.reduce((n,x)=>n+Number(x.practiceMs||0),0);
      const today=last&&dateKey(last)===todayKey();
      let status=today?"Practised today":last?teacherRelativeTime(last):"No practice yet";
      let cls=today?"ok":"";
      if(overdue.length){status=overdue.length+" overdue";cls="danger";}
      return '<button class="p7-teacher-student-row" data-teacher-student="'+escapeHtml(s.id)+'" type="button">'+
        '<div class="p7-teacher-student-avatar">'+escapeHtml((s.name||"S").trim().charAt(0).toUpperCase())+'</div>'+
        '<div class="p7-teacher-student-name"><strong>'+escapeHtml(s.name||"Student")+'</strong><span>'+active.length+' active assignment'+(active.length===1?"":"s")+'</span></div>'+
        '<div class="p7-teacher-student-week"><strong>'+weekSessions.length+'</strong><span>sessions this week</span></div>'+
        '<div class="p7-teacher-student-week"><strong>'+fmtMinutes(weekMs)+'</strong><span>session time</span></div>'+
        '<span class="p7-attention-pill '+cls+'">'+escapeHtml(status)+'</span>'+
        '<span class="p7-row-arrow">›</span></button>';
    }).join("");

    $("p7StudentDirectory").innerHTML=
      '<div class="p7-card-heading"><div><div class="p7-card-title">All students</div><div class="p7-card-sub">Practice activity and assignment status in one place. Click a student to open their full profile.</div></div>'+
      '<span class="p7-count-chip">'+students.length+'</span></div>'+
      '<div class="p7-teacher-student-table-head"><span>Student</span><span>Sessions</span><span>Practice time</span><span>Status</span></div>'+
      '<div class="p7-teacher-student-list">'+(rows||'<div class="p7-empty">No students yet.</div>')+'</div>';

    $("p7StudentDirectory").querySelectorAll("[data-teacher-student]").forEach(b=>b.onclick=()=>openTeacherStudent(b.dataset.teacherStudent));
  }

  function renderAssignmentsOverview(){
    const studentMode=!!(session&&session.role==="student");
    const assignmentHeaderButton=$("p7OpenAssignments");
    if(assignmentHeaderButton) assignmentHeaderButton.hidden=studentMode;
    if(!studentMode){
      const data=assignmentData();
      const students=data.students||[];
      const studentMap=new Map(students.map(s=>[s.id,s]));
      const list=(data.assignments||[]).slice().sort((a,b)=>{
        const ac=isCompleted(a)?1:0, bc=isCompleted(b)?1:0;
        if(ac!==bc) return ac-bc;
        return String(a.dueDate||"9999-12-31").localeCompare(String(b.dueDate||"9999-12-31"));
      });
      const active=list.filter(a=>!isCompleted(a));
      const overdue=active.filter(teacherIsOverdue);
      const completed=list.filter(isCompleted);

      const rows=list.map(a=>{
        const p=a.progress||{}, who=studentMap.get(a.studentId), status=assignmentStatus(a);
        const detail=[];
        if(a.dueDate) detail.push(dueLabel(a));
        if(Number(p.highestSpeed)) detail.push("Best "+Number(p.highestSpeed)+"%");
        else detail.push("No speed recorded");
        return '<div class="p75-assignment-row">'+
          '<button class="p75-assignment-main" data-assignment-student="'+escapeHtml(a.studentId)+'" type="button"><div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(a.songTitle||"Assignment")+'</div>'+
          '<div class="p7-list-meta">'+escapeHtml((who&&who.name)||"Student")+' · '+escapeHtml(detail.join(" · "))+'</div></div></button>'+
          '<span class="p7-attention-pill '+(status==="Completed"?"ok":status==="Overdue"?"danger":"")+'">'+escapeHtml(status)+'</span>'+
          '<button class="p7-secondary p75-manage-btn" data-assignment-manage="'+escapeHtml(a.studentId)+'" type="button">Manage</button></div>';
      }).join("");

      const button=$("p7OpenAssignments"); if(button){button.hidden=false;button.textContent="+ New Assignment";}
      $("p7AssignmentOverview").innerHTML=
        '<div class="p75-assignment-summary">'+
          '<div><strong>'+active.length+'</strong><span>Active</span></div>'+
          '<div><strong>'+overdue.length+'</strong><span>Overdue</span></div>'+
          '<div><strong>'+completed.length+'</strong><span>Completed</span></div>'+
          '<button id="p75AdvancedManager" class="p7-secondary" type="button">Advanced Manager</button></div>'+
        '<div class="p7-card-heading"><div><div class="p7-card-title">All assignments</div><div class="p7-card-sub">Create new work with the guided wizard. The Advanced Manager remains available for duplicate/delete actions.</div></div><span class="p7-count-chip">'+list.length+'</span></div>'+
        '<div class="p75-assignment-list">'+(rows||'<div class="p7-empty">No assignments yet. Create your first one.</div>')+'</div>';

      $("p7AssignmentOverview").querySelectorAll("[data-assignment-student]").forEach(b=>b.onclick=()=>openTeacherStudent(b.dataset.assignmentStudent));
      $("p7AssignmentOverview").querySelectorAll("[data-assignment-manage]").forEach(b=>b.onclick=()=>openTeacherAssignmentManager(b.dataset.assignmentManage));
      const advanced=$("p75AdvancedManager"); if(advanced) advanced.onclick=()=>openAssignments("teacher");
      return;
    }

    const list=studentAssignmentSort(studentAssignmentList());
    const active=list.filter(a=>!isCompleted(a));
    const completed=list.filter(isCompleted);

    const cards=active.map(a=>{
      const s=a.settings||{}, req=requirementProgress(a), p=a.progress||{}, due=dueLabel(a);
      const pct=Math.max(0,Math.min(100,Math.round((Math.min(req.done,req.count)/req.count)*100)));
      return '<article class="p7-student-assignment-card">'+
        '<div class="p7-assignment-card-head"><div><span class="p7-assignment-status">ACTIVE</span><h3>'+escapeHtml(a.songTitle||"Assignment")+'</h3></div>'+
        (due?'<span class="p7-due '+(due==="Overdue"?"overdue":"")+'">'+escapeHtml(due)+'</span>':'')+'</div>'+
        '<div class="p7-assignment-specs large">'+
          '<span><b>Bars</b> '+(s.startBar||1)+'–'+(s.endBar||1)+'</span>'+
          '<span><b>Start</b> '+(s.startSpeed||100)+'%</span>'+
          '<span><b>Target</b> '+(s.targetSpeed||100)+'%</span>'+
          '<span><b>Best</b> '+(Number(p.highestSpeed)||0)+'%</span></div>'+
        (a.note?'<div class="p7-today-note"><strong>Teacher note</strong><br>'+escapeHtml(a.note)+'</div>':'')+
        '<div class="p7-goal-row"><div><strong>'+escapeHtml(req.label)+' '+Math.min(req.done,req.count)+' / '+req.count+'</strong><span>Practice goal</span></div><div class="p7-goal-track"><i style="width:'+pct+'%"></i></div></div>'+
        '<button class="p7-big-action" data-student-start="'+escapeHtml(a.id)+'" type="button">▶ Practice Assignment</button></article>';
    }).join("");

    const history=completed.slice(0,8).map(a=>{
      const p=a.progress||{};
      return '<div class="p7-history-row"><div><strong>'+escapeHtml(a.songTitle||"Assignment")+'</strong><span>'+(p.lastPractisedAt?new Date(p.lastPractisedAt).toLocaleDateString():"Completed")+'</span></div><span class="p7-complete-mark">✓ Completed</span></div>';
    }).join("");

    $("p7AssignmentOverview").innerHTML=
      '<div class="p7-student-assignment-layout"><div><div class="p7-section-label">Active</div>'+
      (cards||'<div class="p7-student-empty"><div class="p7-student-empty-icon">✓</div><strong>No active assignments</strong><span>Nice work — you are caught up.</span></div>')+
      '</div><aside class="p7-student-history"><div class="p7-card-title">Completed</div><div class="p7-card-sub">Your recent finished assignments.</div>'+
      (history||'<div class="p7-student-empty compact"><span>No completed assignments yet.</span></div>')+'</aside></div>';

    $("p7AssignmentOverview").querySelectorAll("[data-student-start]").forEach(b=>b.onclick=()=>startStudentAssignment(b.dataset.studentStart));
  }

  function renderProgress(){
    const list=studentAssignmentList();
    const totalMs=list.reduce((n,a)=>n+Number(a.progress&&a.progress.practiceMs||0),0);
    const allSessions=[];
    list.forEach(a=>{
      const sessions=a&&a.progress&&Array.isArray(a.progress.sessions)?a.progress.sessions:[];
      sessions.forEach(s=>allSessions.push({...s,songTitle:a.songTitle||"Assignment"}));
    });
    allSessions.sort((a,b)=>String(b.completedAt||"").localeCompare(String(a.completedAt||"")));
    const completed=list.filter(isCompleted).length;
    const streak=practiceStreak();
    const best=list.reduce((n,a)=>Math.max(n,Number(a.progress&&a.progress.highestSpeed||0)),0);

    const recent=allSessions.slice(0,12).map(s=>{
      const date=s.completedAt?new Date(s.completedAt):null;
      const dateText=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString(undefined,{day:"numeric",month:"short"}):"Practice";
      const details=[];
      if(Number(s.practiceMs)) details.push(fmtMinutes(s.practiceMs));
      if(Number(s.highestSpeed)) details.push(Number(s.highestSpeed)+"%");
      if(Number(s.reps)) details.push(Number(s.reps)+" reps");
      return '<div class="p7-progress-history-row"><div class="p7-progress-date">'+escapeHtml(dateText)+'</div><div class="p7-progress-session"><strong>'+escapeHtml(s.songTitle)+'</strong><span>'+escapeHtml(details.join(" · ")||"Completed session")+'</span></div><span class="p7-complete-dot">✓</span></div>';
    }).join("");

    const days=sessionDays();
    const week=[];
    const monday=new Date();
    monday.setHours(0,0,0,0);
    monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    for(let i=0;i<7;i++){
      const d=new Date(monday); d.setDate(monday.getDate()+i);
      week.push('<div class="p7-week-day '+(days.has(dateKey(d))?"done":"")+'"><span>'+["M","T","W","T","F","S","S"][i]+'</span><b>'+(days.has(dateKey(d))?"✓":"")+'</b></div>');
    }

    $("p7ProgressSummary").innerHTML=
      '<div class="p7-progress-hero"><div><div class="p7-eyebrow">My progress</div><h2>Keep the momentum going</h2><p>Every completed session adds to your practice history.</p></div><div class="p7-streak-large">🔥 <strong>'+streak+'</strong><span>day streak</span></div></div>'+
      '<div class="p7-metrics p7-student-metrics">'+
        metric("Practice time",fmtMinutes(totalMs),"All assignments")+
        metric("Sessions",allSessions.length,"Completed sessions")+
        metric("Completed",completed,"Assignments")+
        metric("Best speed",best?best+"%":"—","Highest recorded")+
      '</div>'+
      '<div class="p7-progress-grid"><div class="p7-card"><div class="p7-card-title">This week</div><div class="p7-card-sub">Days with a completed practice session.</div><div class="p7-week-strip">'+week.join("")+'</div></div>'+
      '<div class="p7-card"><div class="p7-card-title">Recent practice</div><div class="p7-card-sub">Your latest completed sessions.</div><div class="p7-progress-history">'+(recent||'<div class="p7-student-empty compact"><span>Complete your first practice session to start your history.</span></div>')+'</div></div></div>';
  }

  function openAssignments(view){
    if(view==="student"){
      navigate("assignments");
      return;
    }
    const btn=$("assignmentLaunchBtn");
    if(btn) btn.click();
    setTimeout(()=>{
      const tab=$("assignmentTeacherTab");
      if(tab) tab.click();
    },30);
  }

  function updateStudentPracticeGuide(options){
    if(!session || session.role!=="student") return;
    const guide=$("p7StudentPracticeGuide");
    if(!guide) return;
    guide.hidden=false;
    const a=(options&&options.assignment)||activeAssignment();
    if(a){
      const s=a.settings||{};
      $("p7GuideSong").textContent=a.songTitle||"Practice assignment";
      $("p7GuideBars").textContent="Bars "+(s.startBar||1)+"–"+(s.endBar||1)+" · Target "+(s.targetSpeed||100)+"%";
    }
    if(options&&options.speed!=null) $("p7GuideSpeed").textContent=Math.round(Number(options.speed)||0)+"%";
    else if(a) $("p7GuideSpeed").textContent=Math.round(Number(a.settings&&a.settings.startSpeed)||100)+"%";
    if(options&&options.repsText) $("p7GuideReps").textContent=options.repsText;
    else if(a) $("p7GuideReps").textContent="0 / "+Math.max(1,Number(a.settings&&a.settings.repsPerStep)||1);
    $("p7GuideMessage").textContent=(options&&options.message)||"Press Start Practice when you're ready.";
    if(a){
      $("p7PracticeHeading").textContent=a.songTitle||"Practice";
      $("p7PracticeSub").textContent="Bars "+(a.settings&&a.settings.startBar||1)+"–"+(a.settings&&a.settings.endBar||1);
    }
  }

  function hideCompletion(){
    const node=$("p7Completion");
    if(node) node.remove();
  }

  function showCompletion(detail){
    if(!session || session.role!=="student") return;
    hideCompletion();
    const a=activeAssignment();
    const overlay=document.createElement("div");
    overlay.id="p7Completion";
    overlay.className="p7-completion-overlay";
    const req=a?requirementProgress(a):null;
    overlay.innerHTML='<div class="p7-completion-card">'+
      '<div class="p7-completion-check">✓</div>'+
      '<div class="p7-eyebrow">Practice complete</div>'+
      '<h2>'+escapeHtml((a&&a.songTitle)||"Great work")+'</h2>'+
      '<p>You finished this practice session.</p>'+
      '<div class="p7-completion-stats">'+
        '<div><strong>'+Math.round(Number(detail.currentSpeed)||0)+'%</strong><span>Highest speed</span></div>'+
        '<div><strong>'+Math.max(0,Number(detail.totalReps)||0)+'</strong><span>Repetitions</span></div>'+
        '<div><strong>'+fmtMinutes(detail.elapsedMs||0)+'</strong><span>Practice time</span></div>'+
      '</div>'+
      (req?'<div class="p7-completion-goal '+(req.met?"done":"")+'"><span>'+escapeHtml(req.label)+' goal</span><strong>'+Math.min(req.done,req.count)+' / '+req.count+(req.met?" ✓":"")+'</strong></div>':'')+
      '<div class="p7-completion-actions"><button id="p7CompletionDone" class="p7-primary" type="button">Done</button><button id="p7CompletionAgain" class="p7-secondary" type="button">Practice Again</button></div>'+
      '</div>';
    document.body.appendChild(overlay);
    $("p7CompletionDone").onclick=()=>{ hideCompletion(); navigate("home"); };
    $("p7CompletionAgain").onclick=()=>{ hideCompletion(); if(a) startStudentAssignment(a.id); };
  }

  function escapeHtml(value){
    const d=document.createElement("div");
    d.textContent=String(value==null?"":value);
    return d.innerHTML;
  }

  function buildNav(){
    if(!session) return;
    const list=routes[session.role]||routes.student;
    const nav=$("p7Nav"), mobile=$("p7MobileNav");
    nav.innerHTML=""; mobile.innerHTML="";
    navButtons=[]; mobileButtons=[];
    list.forEach(([route,icon,label])=>{
      [nav,mobile].forEach((host,index)=>{
        const b=document.createElement("button");
        b.type="button"; b.className="p7-nav-button"; b.dataset.route=route;
        b.innerHTML='<span class="p7-nav-icon">'+icon+'</span><span>'+label+'</span>';
        b.onclick=()=>navigate(route);
        host.appendChild(b);
        (index?mobileButtons:navButtons).push(b);
      });
    });
    $("p7SideUser").textContent=session.displayName||session.email||"Cloud account";
    $("p7SideRole").textContent=session.role==="teacher"?"Teacher workspace":"Student workspace";
  }

  function validRoute(route){
    if(!session) return false;
    return (routes[session.role]||[]).some(r=>r[0]===route);
  }

  function navigate(route){
    if(!session) return;
    if(!validRoute(route)) route=session.role==="teacher"?"dashboard":"home";
    currentRoute=route;
    try{localStorage.setItem(ROUTE_KEY,route);}catch(error){}

    document.querySelectorAll("#p7Stage > .p7-page").forEach(p=>p.classList.remove("active"));
    const page=$("p7Page"+route.charAt(0).toUpperCase()+route.slice(1));
    if(page) page.classList.add("active");
    navButtons.concat(mobileButtons).forEach(b=>b.classList.toggle("active",b.dataset.route===route));

    if(route==="dashboard") renderTeacherDashboard();
    if(route==="home") renderStudentHome();
    if(route==="students") renderStudents();
    if(route==="assignments") renderAssignmentsOverview();
    if(route==="progress") renderProgress();

    if(route==="practice" && session.role==="student") updateStudentPracticeGuide({});
  }

  function applySession(next){
    session=next||authSession();
    if(!shellBuilt || !session) return;
    buildNav();

    const sub=document.querySelector(".topbar .sub");
    if(sub) sub.textContent=session.role==="teacher"?"Phase 7.5 · Assignment Wizard":"Phase 7.2 · Student Experience";

    let desired="";
    try{desired=localStorage.getItem(ROUTE_KEY)||"";}catch(error){}
    const pending=localStorage.getItem("dtmtp-pending-assignment")||"";
    if(pending) desired="practice";
    if(!validRoute(desired)) desired=session.role==="teacher"?"dashboard":"home";
    navigate(desired);
  }

  function refreshData(){
    if(!shellBuilt || !session) return;
    if(currentRoute==="dashboard") renderTeacherDashboard();
    if(currentRoute==="home") renderStudentHome();
    if(currentRoute==="students") renderStudents();
    if(currentRoute==="studentprofile") renderTeacherStudentProfile();
    if(currentRoute==="assignments") renderAssignmentsOverview();
    if(currentRoute==="progress") renderProgress();
  }

  window.addEventListener("dtmtp:auth-changed",e=>applySession(e.detail||null));
  window.addEventListener("dtmtp:cloud-data-applied",refreshData);
  window.addEventListener("dtmtp:practice-start",e=>{
    if(session&&session.role==="student"){
      const d=e.detail||{};
      updateStudentPracticeGuide({
        speed:d.currentSpeed,
        repsText:(Number(d.repsAtStep)||0)+" / "+Math.max(1,Number(d.settings&&d.settings.repsPerStep)||1),
        message:"Listen, play, and keep the section steady."
      });
    }
  });
  window.addEventListener("dtmtp:practice-rep",e=>{
    if(session&&session.role==="student"){
      const d=e.detail||{}, need=Math.max(1,Number(d.settings&&d.settings.repsPerStep)||1);
      const reps=Math.max(0,Number(d.repsAtStep)||0);
      updateStudentPracticeGuide({
        speed:d.currentSpeed,
        repsText:reps+" / "+need,
        message:reps>=need?"Nice — moving to the next speed.":"Good rep. Keep going."
      });
    }
  });
  window.addEventListener("dtmtp:practice-speed-change",e=>{
    if(session&&session.role==="student"){
      const d=e.detail||{};
      updateStudentPracticeGuide({
        speed:d.currentSpeed,
        repsText:"0 / "+Math.max(1,Number(d.settings&&d.settings.repsPerStep)||1),
        message:"Great! Speed increased to "+Math.round(Number(d.currentSpeed)||0)+"%."
      });
    }
  });
  window.addEventListener("dtmtp:practice-complete",e=>{
    refreshData();
    if(session&&session.role==="student"){
      const d=e.detail||{};
      updateStudentPracticeGuide({speed:d.currentSpeed,repsText:"✓",message:"Practice complete — great work!"});
      setTimeout(()=>showCompletion(d),120);
    }
  });
  window.addEventListener("dtmtp:practice-stop",e=>{
    refreshData();
    if(session&&session.role==="student"){
      const d=e.detail||{};
      updateStudentPracticeGuide({speed:d.currentSpeed,message:"Practice paused. Start again whenever you're ready."});
    }
  });
  window.addEventListener("dtmtp:materials-ready",refreshData);

  document.addEventListener("DOMContentLoaded",buildShell);
  if(document.readyState!=="loading") setTimeout(buildShell,0);

  window.DTMusicTrainerPhase7={
    navigate,
    refresh:refreshData,
    getRoute:()=>currentRoute
  };
})();