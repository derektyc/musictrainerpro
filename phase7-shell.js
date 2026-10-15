
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

  function isCompleted(a){
    return !!(a && a.progress && a.progress.status==="Completed");
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
        <section id="p7PageAssignments" class="p7-page"></section>
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
      pageHead("Teacher workspace","Students","View and manage student profiles. A full student detail page arrives in Phase 7.4.",
        '<button id="p7OpenStudents" class="p7-primary" type="button">Open student manager</button>')+
      '<div id="p7StudentDirectory" class="p7-card"></div>';

    $("p7PageAssignments").innerHTML=
      pageHead("Practice planning","Assignments","Create, review and monitor practice assignments without digging through the old sidebar.",
        '<button id="p7OpenAssignments" class="p7-primary" type="button">Open assignment dashboard</button>')+
      '<div id="p7AssignmentOverview" class="p7-card"></div>';

    $("p7PageLibrary").insertAdjacentHTML("afterbegin",
      pageHead("Teaching materials","Song Library","Manage local song materials here. Assigned materials continue to sync through your existing Google Drive workflow.",""));

    $("p7PageProgress").innerHTML=
      pageHead("Your practice","Progress","A simple summary for now. Phase 7.3 will expand this into full practice history and progress reporting.","")+
      '<div id="p7ProgressSummary"></div>';

    $("p7OpenStudents").onclick=()=>openAssignments("teacher");
    $("p7OpenAssignments").onclick=()=>openAssignments(session&&session.role==="student"?"student":"teacher");
  }

  function renderTeacherDashboard(){
    const data=assignmentData();
    const students=data.students||[];
    const assignments=data.assignments||[];
    const practiced=new Set(assignments.filter(practicedToday).map(a=>a.studentId));
    const active=assignments.filter(a=>!isCompleted(a));
    const overdue=active.filter(a=>{
      if(!a.dueDate) return false;
      const due=new Date(a.dueDate+"T23:59:59");
      return !Number.isNaN(due.getTime()) && Date.now()>due.getTime();
    });

    const studentRows=students.slice(0,6).map(s=>{
      const mine=assignments.filter(a=>a.studentId===s.id);
      const last=mine.map(a=>a.progress&&a.progress.lastPractisedAt).filter(Boolean).sort().reverse()[0];
      const meta=practiced.has(s.id)?"Practised today":last?"Last practice "+new Date(last).toLocaleDateString():"No practice recorded";
      return '<div class="p7-list-row"><div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(s.name||"Student")+'</div><div class="p7-list-meta">'+mine.filter(a=>!isCompleted(a)).length+' active assignments · '+meta+'</div></div><span class="p7-badge '+(practiced.has(s.id)?"ok":"")+'">'+(practiced.has(s.id)?"Today ✓":"View")+'</span></div>';
    }).join("");

    $("p7PageDashboard").innerHTML=
      pageHead("Teacher dashboard","Welcome back, "+escapeHtml((session&&session.displayName)||"Teacher"),"A cleaner overview of your studio. Phase 7.3 will add deeper analytics and activity history.",
        '<button id="p7DashAssign" class="p7-primary" type="button">+ New assignment</button>')+
      '<div class="p7-metrics">'+
        metric("Students",students.length,"Current profiles")+
        metric("Practised today",practiced.size,"Across all students")+
        metric("Active assignments",active.length,"Still in progress")+
        metric("Overdue",overdue.length,"Need attention")+
      '</div>'+
      '<div class="p7-grid">'+
        '<div class="p7-card"><div class="p7-card-title">Students</div><div class="p7-card-sub">Quick view of recent practice activity.</div><div class="p7-list">'+(studentRows||'<div class="p7-empty">No students yet.</div>')+'</div></div>'+
        '<div class="p7-card"><div class="p7-card-title">Quick actions</div><div class="p7-card-sub">Jump straight to the task you need.</div><div class="p7-quick-grid">'+
          '<button class="p7-quick" data-p7-go="students"><strong>Students</strong><span>Profiles and practice status</span></button>'+
          '<button class="p7-quick" data-p7-open-assign><strong>Assign work</strong><span>Create or manage assignments</span></button>'+
          '<button class="p7-quick" data-p7-go="library"><strong>Song library</strong><span>Scores and backing tracks</span></button>'+
          '<button class="p7-quick" data-p7-go="practice"><strong>Practice tools</strong><span>Score player and advanced tools</span></button>'+
        '</div></div>'+
      '</div>';

    const assign=$("p7DashAssign"); if(assign) assign.onclick=()=>openAssignments("teacher");
    $("p7PageDashboard").querySelectorAll("[data-p7-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.p7Go));
    const quick=$("p7PageDashboard").querySelector("[data-p7-open-assign]"); if(quick) quick.onclick=()=>openAssignments("teacher");
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
    const rows=(data.students||[]).map(s=>{
      const mine=(data.assignments||[]).filter(a=>a.studentId===s.id);
      const active=mine.filter(a=>!isCompleted(a)).length;
      const today=mine.some(practicedToday);
      return '<div class="p7-list-row"><div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(s.name||"Student")+'</div><div class="p7-list-meta">'+active+' active assignment'+(active===1?"":"s")+'</div></div><span class="p7-badge '+(today?"ok":"")+'">'+(today?"Practised today":"Open")+'</span></div>';
    }).join("");
    $("p7StudentDirectory").innerHTML='<div class="p7-card-title">Student directory</div><div class="p7-card-sub">Phase 7.4 will turn each row into a full student profile.</div><div class="p7-list">'+(rows||'<div class="p7-empty">No students yet.</div>')+'</div>';
  }

  function renderAssignmentsOverview(){
    const studentMode=!!(session&&session.role==="student");
    if(!studentMode){
      const list=assignmentData().assignments||[];
      const rows=list.slice(0,10).map(a=>{
        const p=a.progress||{};
        return '<div class="p7-list-row"><div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(a.songTitle||"Assignment")+'</div><div class="p7-list-meta">'+(a.dueDate?"Due "+a.dueDate+" · ":"")+(p.highestSpeed?("Highest "+p.highestSpeed+"%"):"Not practised yet")+'</div></div><span class="p7-badge '+(isCompleted(a)?"ok":"")+'">'+(isCompleted(a)?"Completed":"Active")+'</span></div>';
      }).join("");
      $("p7AssignmentOverview").innerHTML='<div class="p7-card-title">Assignment overview</div><div class="p7-card-sub">The teacher assignment workflow will be redesigned in Phase 7.5.</div><div class="p7-list">'+(rows||'<div class="p7-empty">No assignments yet.</div>')+'</div>';
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

    if(route==="assignments" && session.role==="teacher") setTimeout(()=>openAssignments("teacher"),80);
    if(route==="practice" && session.role==="student") updateStudentPracticeGuide({});
  }

  function applySession(next){
    session=next||authSession();
    if(!shellBuilt || !session) return;
    buildNav();

    const sub=document.querySelector(".topbar .sub");
    if(sub) sub.textContent="Phase 7.2 · Student Experience";

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