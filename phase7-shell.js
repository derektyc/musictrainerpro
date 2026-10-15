
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
            <button id="p7PracticeAssignments" class="p7-secondary" type="button">Assignments</button>
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

    $("p7PracticeAssignments").onclick=()=>openAssignments();
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

  function renderStudentHome(){
    const list=studentAssignmentList();
    const active=list.filter(a=>!isCompleted(a));
    const next=active[0]||list[0]||null;
    const todayDone=list.filter(practicedToday).length;
    const totalMs=list.reduce((n,a)=>n+Number(a.progress&&a.progress.practiceMs||0),0);
    const best=list.reduce((n,a)=>Math.max(n,Number(a.progress&&a.progress.highestSpeed||0)),0);

    let today='<div class="p7-empty">No assignments yet. Your teacher will add your practice here.</div>';
    if(next){
      const s=next.settings||{};
      today='<div class="p7-today-card"><div class="p7-today-title">'+escapeHtml(next.songTitle||"Practice assignment")+'</div>'+
        '<div class="p7-today-meta">Bars '+(s.startBar||1)+'–'+(s.endBar||1)+' · '+(s.startSpeed||100)+'% → '+(s.targetSpeed||100)+'%</div>'+
        (next.note?'<div class="p7-today-note"><strong>Teacher note</strong><br>'+escapeHtml(next.note)+'</div>':'')+
        '<button id="p7StudentStart" class="p7-big-action" type="button">▶ Start Practice</button></div>';
    }

    $("p7PageHome").innerHTML=
      '<div class="p7-student-hero"><div class="p7-eyebrow">Today</div><h2>Hi, '+escapeHtml((session&&session.displayName)||"Student")+'</h2><p>Your practice is kept simple here — open your assignment and start playing.</p>'+today+'</div>'+
      '<div class="p7-progress-strip">'+
        '<div class="p7-progress-box"><div class="v">'+todayDone+'</div><div class="k">Practised today</div></div>'+
        '<div class="p7-progress-box"><div class="v">'+fmtMinutes(totalMs)+'</div><div class="k">Total practice</div></div>'+
        '<div class="p7-progress-box"><div class="v">'+(best?best+"%":"—")+'</div><div class="k">Highest speed</div></div>'+
      '</div>';

    const start=$("p7StudentStart");
    if(start) start.onclick=()=>openAssignments("student");
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
    const list=session&&session.role==="student"?studentAssignmentList():(assignmentData().assignments||[]);
    const rows=list.slice(0,10).map(a=>{
      const p=a.progress||{};
      return '<div class="p7-list-row"><div class="p7-list-main"><div class="p7-list-title">'+escapeHtml(a.songTitle||"Assignment")+'</div><div class="p7-list-meta">'+(a.dueDate?"Due "+a.dueDate+" · ":"")+(p.highestSpeed?("Highest "+p.highestSpeed+"%"):"Not practised yet")+'</div></div><span class="p7-badge '+(isCompleted(a)?"ok":"")+'">'+(isCompleted(a)?"Completed":"Active")+'</span></div>';
    }).join("");
    $("p7AssignmentOverview").innerHTML='<div class="p7-card-title">'+(session&&session.role==="student"?"My assignments":"Assignment overview")+'</div><div class="p7-card-sub">The current assignment dashboard remains available while we redesign the full workflow in Phase 7.5.</div><div class="p7-list">'+(rows||'<div class="p7-empty">No assignments yet.</div>')+'</div>';
  }

  function renderProgress(){
    const list=studentAssignmentList();
    const totalMs=list.reduce((n,a)=>n+Number(a.progress&&a.progress.practiceMs||0),0);
    const sessions=list.reduce((n,a)=>n+((a.progress&&Array.isArray(a.progress.sessions))?a.progress.sessions.length:0),0);
    const completed=list.filter(isCompleted).length;
    $("p7ProgressSummary").innerHTML=
      '<div class="p7-metrics" style="grid-template-columns:repeat(3,minmax(0,1fr))">'+
      metric("Practice time",fmtMinutes(totalMs),"All recorded assignments")+
      metric("Sessions",sessions,"Completed practice sessions")+
      metric("Completed",completed,"Assignments completed")+
      '</div>'+
      '<div class="p7-placeholder"><div><strong>Detailed progress is coming next</strong>Phase 7.3 will add practice history, streaks and student progress views.</div></div>';
  }

  function openAssignments(view){
    const btn=$("assignmentLaunchBtn");
    if(btn) btn.click();
    setTimeout(()=>{
      if(view==="student"){
        const tab=$("assignmentStudentTab"); if(tab) tab.click();
      }else if(view==="teacher"){
        const tab=$("assignmentTeacherTab"); if(tab) tab.click();
      }
    },30);
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

    if(route==="assignments") setTimeout(()=>openAssignments(session.role==="student"?"student":"teacher"),80);
  }

  function applySession(next){
    session=next||authSession();
    if(!shellBuilt || !session) return;
    buildNav();

    const sub=document.querySelector(".topbar .sub");
    if(sub) sub.textContent="Phase 7.1 · New App Shell";

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
  window.addEventListener("dtmtp:practice-complete",refreshData);
  window.addEventListener("dtmtp:practice-stop",refreshData);
  window.addEventListener("dtmtp:materials-ready",refreshData);

  document.addEventListener("DOMContentLoaded",buildShell);
  if(document.readyState!=="loading") setTimeout(buildShell,0);

  window.DTMusicTrainerPhase7={
    navigate,
    refresh:refreshData,
    getRoute:()=>currentRoute
  };
})();