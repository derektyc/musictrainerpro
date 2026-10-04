(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const ACCOUNTS_KEY = "dtmtp-auth-accounts-v1";
  const SESSION_KEY = "dtmtp-auth-session-v1";

  let accounts = loadAccounts();
  let currentAccount = null;
  let toastTimer = null;

  function makeId(prefix){
    if(window.crypto && typeof crypto.randomUUID === "function") return prefix + "-" + crypto.randomUUID();
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2,9);
  }

  function loadAccounts(){
    try{
      const value = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    }catch(e){
      console.warn("Account data could not be read",e);
      return [];
    }
  }

  function saveAccounts(){
    localStorage.setItem(ACCOUNTS_KEY,JSON.stringify(accounts));
  }

  function normalizedLogin(value){
    return String(value || "").trim().toLowerCase();
  }

  function randomSalt(){
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,b => b.toString(16).padStart(2,"0")).join("");
  }

  async function passwordHash(login,password,salt){
    const input = new TextEncoder().encode(String(salt) + "|" + normalizedLogin(login) + "|" + String(password));
    const digest = await crypto.subtle.digest("SHA-256",input);
    return Array.from(new Uint8Array(digest),b => b.toString(16).padStart(2,"0")).join("");
  }

  function injectUi(){
    if($("authGate")) return;

    const topbar = document.querySelector(".topbar");
    const status = $("statusPill");
    if(topbar){
      const wrap = document.createElement("div");
      wrap.className = "auth-topbar-wrap";
      const accountBtn = document.createElement("button");
      accountBtn.id = "authAccountBtn";
      accountBtn.className = "auth-account-btn";
      accountBtn.type = "button";
      accountBtn.textContent = "Account";
      if(status && status.parentElement === topbar){
        topbar.insertBefore(wrap,status);
        wrap.appendChild(status);
        wrap.appendChild(accountBtn);
      }else{
        wrap.appendChild(accountBtn);
        topbar.appendChild(wrap);
      }
    }

    const gate = document.createElement("div");
    gate.id = "authGate";
    gate.className = "auth-gate";
    gate.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">DT Music Trainer Pro</div>
        <div class="auth-kicker">Phase 6A · Accounts & Roles</div>

        <div id="authSetupView" class="auth-view">
          <h2>Create Teacher Account</h2>
          <p>This first account controls students and assignments on this device.</p>
          <label>YOUR NAME<input id="authSetupName" type="text" autocomplete="name" placeholder="Teacher name"></label>
          <label>LOGIN ID<input id="authSetupLogin" type="text" autocomplete="username" placeholder="e.g. derek"></label>
          <label>PASSWORD<input id="authSetupPassword" type="password" autocomplete="new-password" placeholder="Minimum 6 characters"></label>
          <button id="authSetupBtn" class="auth-primary" type="button">Create Teacher Account</button>
        </div>

        <div id="authLoginView" class="auth-view">
          <h2>Sign In</h2>
          <p>Use your teacher or student login.</p>
          <label>LOGIN ID<input id="authLoginId" type="text" autocomplete="username" placeholder="Login ID"></label>
          <label>PASSWORD<input id="authLoginPassword" type="password" autocomplete="current-password" placeholder="Password"></label>
          <button id="authLoginBtn" class="auth-primary" type="button">Sign In</button>
        </div>

        <div id="authGateMessage" class="auth-message"></div>
        <div class="auth-local-note">Local account mode for Phase 6A. Cloud authentication and cross-device sync come in Phase 6B.</div>
      </div>`;
    document.body.appendChild(gate);

    const panel = document.createElement("div");
    panel.id = "authPanel";
    panel.className = "auth-modal";
    panel.innerHTML = `
      <div class="auth-panel-shell">
        <div class="auth-panel-head">
          <div>
            <div class="auth-panel-title">Account</div>
            <div id="authPanelSubtitle" class="auth-panel-sub"></div>
          </div>
          <button id="authPanelClose" class="auth-close" type="button">×</button>
        </div>
        <div class="auth-panel-body">
          <div id="authCurrentCard" class="auth-current-card"></div>

          <div id="authTeacherTools" class="auth-teacher-tools">
            <h3>Student Logins</h3>
            <p>Create a login and link it to an existing Phase 5 student profile.</p>
            <div class="auth-grid two">
              <label>STUDENT PROFILE<select id="authStudentProfile"></select></label>
              <label>LOGIN ID<input id="authStudentLogin" type="text" placeholder="e.g. bailey"></label>
            </div>
            <label>PASSWORD<input id="authStudentPassword" type="password" placeholder="Minimum 6 characters"></label>
            <button id="authCreateStudentBtn" class="auth-primary" type="button">Create Student Login</button>
            <div id="authStudentAccountList" class="auth-account-list"></div>
          </div>

          <button id="authLogoutBtn" class="auth-danger" type="button">Log Out</button>
          <div class="auth-local-note">Accounts created in 6A are stored only in this browser. Phase 6B will move authentication and data to the cloud.</div>
        </div>
      </div>`;
    document.body.appendChild(panel);

    const toast = document.createElement("div");
    toast.id = "authToast";
    toast.className = "auth-toast";
    document.body.appendChild(toast);
  }

  function toast(message){
    const node = $("authToast");
    if(!node) return;
    clearTimeout(toastTimer);
    node.textContent = message;
    node.classList.add("show");
    toastTimer = setTimeout(() => node.classList.remove("show"),2600);
  }

  function setGateMessage(text,error){
    const node = $("authGateMessage");
    if(!node) return;
    node.textContent = text || "";
    node.classList.toggle("error",!!error);
  }

  function showCorrectGate(){
    const hasTeacher = accounts.some(a => a.role === "teacher");
    const setup = $("authSetupView");
    const login = $("authLoginView");
    if(setup) setup.style.display = hasTeacher ? "none" : "block";
    if(login) login.style.display = hasTeacher ? "block" : "none";
    setGateMessage("");
  }

  function assignmentData(){
    try{
      if(window.DTMusicTrainerAssignments && typeof window.DTMusicTrainerAssignments.getData === "function"){
        return window.DTMusicTrainerAssignments.getData();
      }
    }catch(e){}
    return {students:[],assignments:[]};
  }

  function linkedStudentName(studentId){
    const data = assignmentData();
    const student = (data.students || []).find(s => s.id === studentId);
    return student ? student.name : "Unlinked student";
  }

  function syncStudentProfile(account){
    if(!account || account.role !== "student" || !account.studentId) return;
    const select = $("assignmentStudentSelect");
    if(select){
      select.value = account.studentId;
      select.dispatchEvent(new Event("change",{bubbles:true}));
    }
  }

  function applyRole(account){
    document.body.classList.remove("role-teacher","role-student","auth-signed-out");
    if(!account){
      document.body.classList.add("auth-signed-out");
      return;
    }

    document.body.classList.add(account.role === "student" ? "role-student" : "role-teacher");
    const accountBtn = $("authAccountBtn");
    if(accountBtn){
      accountBtn.textContent = (account.role === "student" ? "Student · " : "Teacher · ") + (account.displayName || account.login);
    }

    if(account.role === "student"){
      syncStudentProfile(account);
      const launch = $("assignmentLaunchBtn");
      if(launch) launch.textContent = "My Assignments";
      setTimeout(() => {
        syncStudentProfile(account);
        const studentTab = $("assignmentStudentTab");
        if(studentTab) studentTab.click();
      },80);
    }else{
      const launch = $("assignmentLaunchBtn");
      if(launch) launch.textContent = "Open Assignment Dashboard";
    }

    const sub = document.querySelector(".topbar .sub");
    if(sub) sub.textContent = "Phase 6A · Accounts & Roles";

    window.dispatchEvent(new CustomEvent("dtmtp:auth-changed",{detail:getPublicSession()}));
  }

  function getPublicSession(){
    if(!currentAccount) return null;
    return {
      id:currentAccount.id,
      login:currentAccount.login,
      displayName:currentAccount.displayName,
      role:currentAccount.role,
      studentId:currentAccount.studentId || ""
    };
  }

  function showGate(){
    showCorrectGate();
    const gate = $("authGate");
    if(gate) gate.classList.add("show");
    document.body.classList.add("auth-signed-out");
  }

  function hideGate(){
    const gate = $("authGate");
    if(gate) gate.classList.remove("show");
  }

  async function createTeacher(){
    const displayName = String($("authSetupName").value || "").trim();
    const login = normalizedLogin($("authSetupLogin").value);
    const password = String($("authSetupPassword").value || "");

    if(!displayName){ setGateMessage("Enter your name.",true); return; }
    if(login.length < 3){ setGateMessage("Login ID must be at least 3 characters.",true); return; }
    if(password.length < 6){ setGateMessage("Password must be at least 6 characters.",true); return; }
    if(accounts.some(a => a.login === login)){ setGateMessage("That Login ID is already in use.",true); return; }

    const salt = randomSalt();
    const account = {
      id:makeId("account"),
      login,
      displayName,
      role:"teacher",
      studentId:"",
      salt,
      passwordHash:await passwordHash(login,password,salt),
      createdAt:new Date().toISOString()
    };
    accounts.push(account);
    saveAccounts();
    signInAccount(account);
  }

  async function signIn(){
    const login = normalizedLogin($("authLoginId").value);
    const password = String($("authLoginPassword").value || "");
    const account = accounts.find(a => a.login === login);
    if(!account){ setGateMessage("Login ID or password is incorrect.",true); return; }
    const hash = await passwordHash(login,password,account.salt);
    if(hash !== account.passwordHash){ setGateMessage("Login ID or password is incorrect.",true); return; }
    signInAccount(account);
  }

  function signInAccount(account){
    currentAccount = account;
    localStorage.setItem(SESSION_KEY,account.id);
    hideGate();
    applyRole(account);
    renderAccountPanel();
  }

  function logout(){
    localStorage.removeItem(SESSION_KEY);
    currentAccount = null;
    const panel = $("authPanel");
    if(panel) panel.classList.remove("show");
    applyRole(null);
    showGate();
  }

  function restoreSession(){
    const id = localStorage.getItem(SESSION_KEY) || "";
    const account = accounts.find(a => a.id === id) || null;
    if(account){
      currentAccount = account;
      hideGate();
      applyRole(account);
      renderAccountPanel();
      return true;
    }
    currentAccount = null;
    showGate();
    return false;
  }

  function populateStudentProfiles(){
    const select = $("authStudentProfile");
    if(!select) return;
    const data = assignmentData();
    const linked = new Set(accounts.filter(a => a.role === "student" && a.studentId).map(a => a.studentId));
    const students = (data.students || []).filter(s => !linked.has(s.id));
    select.innerHTML = "";
    if(!students.length){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = (data.students || []).length ? "All student profiles already have logins" : "Create a student in Assignment Dashboard first";
      select.appendChild(opt);
      return;
    }
    students.forEach(student => {
      const opt = document.createElement("option");
      opt.value = student.id;
      opt.textContent = student.name;
      select.appendChild(opt);
    });
  }

  function renderStudentAccounts(){
    const list = $("authStudentAccountList");
    if(!list) return;
    list.innerHTML = "";
    const rows = accounts.filter(a => a.role === "student");
    if(!rows.length){
      list.innerHTML = '<div class="auth-empty">No student logins yet.</div>';
      return;
    }
    rows.forEach(account => {
      const row = document.createElement("div");
      row.className = "auth-account-row";
      const text = document.createElement("div");
      text.innerHTML = '<strong></strong><span></span>';
      text.querySelector("strong").textContent = account.displayName || account.login;
      text.querySelector("span").textContent = "Login: " + account.login + " · " + linkedStudentName(account.studentId);
      const actions = document.createElement("div");
      actions.className = "auth-row-actions";

      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "Reset Password";
      reset.onclick = () => resetStudentPassword(account.id);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "Delete Login";
      del.onclick = () => deleteStudentLogin(account.id);

      actions.append(reset,del);
      row.append(text,actions);
      list.appendChild(row);
    });
  }

  function renderAccountPanel(){
    if(!currentAccount) return;
    const subtitle = $("authPanelSubtitle");
    if(subtitle) subtitle.textContent = currentAccount.role === "teacher" ? "Teacher account · local Phase 6A" : "Student account · local Phase 6A";
    const current = $("authCurrentCard");
    if(current){
      current.innerHTML = "";
      const name = document.createElement("div");
      name.className = "auth-current-name";
      name.textContent = currentAccount.displayName || currentAccount.login;
      const meta = document.createElement("div");
      meta.className = "auth-current-meta";
      meta.textContent = (currentAccount.role === "teacher" ? "Teacher" : "Student") + " · Login ID: " + currentAccount.login +
        (currentAccount.role === "student" ? " · Profile: " + linkedStudentName(currentAccount.studentId) : "");
      current.append(name,meta);
    }
    const tools = $("authTeacherTools");
    if(tools) tools.style.display = currentAccount.role === "teacher" ? "block" : "none";
    if(currentAccount.role === "teacher"){
      populateStudentProfiles();
      renderStudentAccounts();
    }
  }

  async function createStudentLogin(){
    if(!currentAccount || currentAccount.role !== "teacher") return;
    const studentId = String($("authStudentProfile").value || "");
    const login = normalizedLogin($("authStudentLogin").value);
    const password = String($("authStudentPassword").value || "");
    const data = assignmentData();
    const student = (data.students || []).find(s => s.id === studentId);

    if(!student){ toast("Choose an available student profile."); return; }
    if(login.length < 3){ toast("Login ID must be at least 3 characters."); return; }
    if(password.length < 6){ toast("Password must be at least 6 characters."); return; }
    if(accounts.some(a => a.login === login)){ toast("That Login ID is already in use."); return; }

    const salt = randomSalt();
    accounts.push({
      id:makeId("account"),
      login,
      displayName:student.name,
      role:"student",
      studentId:student.id,
      salt,
      passwordHash:await passwordHash(login,password,salt),
      createdAt:new Date().toISOString()
    });
    saveAccounts();
    $("authStudentLogin").value = "";
    $("authStudentPassword").value = "";
    populateStudentProfiles();
    renderStudentAccounts();
    toast("Student login created for " + student.name + ".");
  }

  async function resetStudentPassword(accountId){
    const account = accounts.find(a => a.id === accountId && a.role === "student");
    if(!account) return;
    const password = prompt("New password for " + (account.displayName || account.login) + ":");
    if(password === null) return;
    if(password.length < 6){ toast("Password must be at least 6 characters."); return; }
    account.salt = randomSalt();
    account.passwordHash = await passwordHash(account.login,password,account.salt);
    saveAccounts();
    toast("Password reset.");
  }

  function deleteStudentLogin(accountId){
    const account = accounts.find(a => a.id === accountId && a.role === "student");
    if(!account) return;
    if(!confirm("Delete login for " + (account.displayName || account.login) + "? The Phase 5 student and assignments will not be deleted.")) return;
    accounts = accounts.filter(a => a.id !== accountId);
    saveAccounts();
    populateStudentProfiles();
    renderStudentAccounts();
    toast("Student login deleted.");
  }

  function openAccountPanel(){
    if(!currentAccount) return;
    renderAccountPanel();
    const panel = $("authPanel");
    if(panel) panel.classList.add("show");
  }

  function bind(){
    $("authSetupBtn").addEventListener("click",createTeacher);
    $("authLoginBtn").addEventListener("click",signIn);
    $("authLoginPassword").addEventListener("keydown",e => { if(e.key === "Enter") signIn(); });
    $("authSetupPassword").addEventListener("keydown",e => { if(e.key === "Enter") createTeacher(); });
    $("authAccountBtn").addEventListener("click",openAccountPanel);
    $("authPanelClose").addEventListener("click",() => $("authPanel").classList.remove("show"));
    $("authPanel").addEventListener("click",e => { if(e.target === $("authPanel")) $("authPanel").classList.remove("show"); });
    $("authLogoutBtn").addEventListener("click",logout);
    $("authCreateStudentBtn").addEventListener("click",createStudentLogin);

    const assignmentLaunch = $("assignmentLaunchBtn");
    if(assignmentLaunch){
      assignmentLaunch.addEventListener("click",() => {
        if(currentAccount && currentAccount.role === "student"){
          setTimeout(() => {
            syncStudentProfile(currentAccount);
            const tab = $("assignmentStudentTab");
            if(tab) tab.click();
          },80);
        }
      });
    }
  }

  function init(){
    injectUi();
    bind();
    showCorrectGate();
    restoreSession();

    setTimeout(() => {
      if(currentAccount) applyRole(currentAccount);
    },250);
  }

  window.DTMusicTrainerAuth = {
    getSession:getPublicSession,
    isTeacher:() => !!(currentAccount && currentAccount.role === "teacher"),
    isStudent:() => !!(currentAccount && currentAccount.role === "student"),
    open:openAccountPanel,
    logout
  };

  init();
})();
