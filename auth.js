(function(){
  "use strict";

  const $ = id => document.getElementById(id);
  const LEGACY_ACCOUNTS_KEY = "dtmtp-auth-accounts-v1";
  let currentAccount = null;
  let studentAccounts = [];
  let firebaseConnected = false;
  let authUnsubscribe = null;
  let toastTimer = null;
  let creatingTeacher = false;

  function fb(){ return window.DTMTPFirebase || null; }

  function legacyTeacherName(){
    try{
      const rows = JSON.parse(localStorage.getItem(LEGACY_ACCOUNTS_KEY) || "[]");
      const teacher = Array.isArray(rows) ? rows.find(a => a.role === "teacher") : null;
      return teacher && teacher.displayName ? teacher.displayName : "";
    }catch(error){ return ""; }
  }

  function injectStyle(){
    if($("authCloudInlineStyle")) return;
    const style = document.createElement("style");
    style.id = "authCloudInlineStyle";
    style.textContent = `
      .auth-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px}
      .auth-switch button{border:1px solid #4b4b4b;background:#2c2c2c;color:#ddd;border-radius:9px;padding:8px;font-weight:800;cursor:pointer}
      .auth-switch button.active{background:var(--accent);color:#181818;border-color:transparent}
      .auth-cloud-status{display:flex;align-items:center;gap:7px;margin:10px 0 2px;padding:8px 9px;border:1px solid #444;border-radius:9px;background:#292929;font-size:10px;color:#bbb}
      .auth-cloud-dot{width:8px;height:8px;border-radius:50%;background:#777;flex:0 0 auto}
      .auth-cloud-status.synced .auth-cloud-dot{background:#7bd995}.auth-cloud-status.syncing .auth-cloud-dot{background:#f2b66a}
      .auth-cloud-status.error .auth-cloud-dot{background:#ff7777}.auth-cloud-status.pending .auth-cloud-dot{background:#e5c76c}
      .auth-account-disabled{opacity:.55}.auth-account-row em{font-style:normal;color:#ffadad;font-size:9px}
    `;
    document.head.appendChild(style);
  }

  function injectUi(){
    if($("authGate")) return;
    injectStyle();

    const topbar = document.querySelector(".topbar");
    const status = $("statusPill");
    if(topbar){
      const wrap = document.createElement("div");
      wrap.className = "auth-topbar-wrap";
      const accountBtn = document.createElement("button");
      accountBtn.id = "authAccountBtn";
      accountBtn.className = "auth-account-btn";
      accountBtn.type = "button";
      accountBtn.textContent = "Cloud Account";
      if(status && status.parentElement === topbar){
        topbar.insertBefore(wrap,status);
        wrap.append(status,accountBtn);
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
        <div class="auth-kicker">Phase 6B · Firebase Cloud Sync</div>
        <div class="auth-switch">
          <button id="authShowLogin" class="active" type="button">Sign In</button>
          <button id="authShowSetup" type="button">Teacher Setup</button>
        </div>

        <div id="authLoginView" class="auth-view">
          <h2>Sign In</h2>
          <p>Use your DT Music Trainer teacher or student cloud account.</p>
          <label>EMAIL<input id="authLoginEmail" type="email" autocomplete="username" placeholder="name@example.com"></label>
          <label>PASSWORD<input id="authLoginPassword" type="password" autocomplete="current-password" placeholder="Password"></label>
          <button id="authLoginBtn" class="auth-primary" type="button">Sign In</button>
        </div>

        <div id="authSetupView" class="auth-view" style="display:none">
          <h2>Create Cloud Teacher Account</h2>
          <p>Your current local students and assignments will be migrated to this Firebase account automatically.</p>
          <label>YOUR NAME<input id="authSetupName" type="text" autocomplete="name" placeholder="Teacher name"></label>
          <label>EMAIL<input id="authSetupEmail" type="email" autocomplete="email" placeholder="name@example.com"></label>
          <label>PASSWORD<input id="authSetupPassword" type="password" autocomplete="new-password" placeholder="Minimum 6 characters"></label>
          <label>ACADEMY NAME<input id="authAcademyName" type="text" value="DT Music Academy"></label>
          <button id="authSetupBtn" class="auth-primary" type="button">Create Cloud Teacher Account</button>
        </div>

        <div id="authGateMessage" class="auth-message">Connecting to Firebase…</div>
        <div class="auth-local-note">Phase 6A local passwords are not uploaded. Student cloud logins are recreated by the teacher in this phase.</div>
      </div>`;
    document.body.appendChild(gate);

    const panel = document.createElement("div");
    panel.id = "authPanel";
    panel.className = "auth-modal";
    panel.innerHTML = `
      <div class="auth-panel-shell">
        <div class="auth-panel-head">
          <div><div class="auth-panel-title">Cloud Account</div><div id="authPanelSubtitle" class="auth-panel-sub"></div></div>
          <button id="authPanelClose" class="auth-close" type="button">×</button>
        </div>
        <div class="auth-panel-body">
          <div id="authCurrentCard" class="auth-current-card"></div>
          <div id="authCloudStatus" class="auth-cloud-status"><span class="auth-cloud-dot"></span><span>Connecting…</span></div>

          <div id="authTeacherTools" class="auth-teacher-tools">
            <h3>Student Cloud Logins</h3>
            <p>Create a Firebase login and link it to an existing student profile.</p>
            <div class="auth-grid two">
              <label>STUDENT PROFILE<select id="authStudentProfile"></select></label>
              <label>EMAIL<input id="authStudentEmail" type="email" placeholder="student@example.com"></label>
            </div>
            <label>TEMPORARY PASSWORD<input id="authStudentPassword" type="password" placeholder="Minimum 6 characters"></label>
            <button id="authCreateStudentBtn" class="auth-primary" type="button">Create Student Cloud Login</button>
            <div id="authStudentAccountList" class="auth-account-list"></div>
          </div>

          <button id="authLogoutBtn" class="auth-danger" type="button">Log Out</button>
          <div class="auth-local-note">Accounts and assignment progress now use Firebase. Song files are still stored locally in this build.</div>
        </div>
      </div>`;
    document.body.appendChild(panel);

    const toast = document.createElement("div");
    toast.id = "authToast";
    toast.className = "auth-toast";
    document.body.appendChild(toast);

    const legacyName = legacyTeacherName();
    if(legacyName) $("authSetupName").value = legacyName;
  }

  function loadCloudScripts(){
    if(!document.querySelector('script[data-dtmtp-firebase]')){
      const module = document.createElement("script");
      module.type = "module";
      module.src = "./firebase-cloud.js?v=20261008-5";
      module.dataset.dtmpFirebase = "1";
      document.head.appendChild(module);
    }
    if(!document.querySelector('script[data-dtmtp-cloud-sync]')){
      const script = document.createElement("script");
      script.src = "./cloud-sync.js?v=20261008-5";
      script.dataset.dtmpCloudSync = "1";
      script.onload = () => {
        const current = getPublicSession();
        if(current) window.dispatchEvent(new CustomEvent("dtmtp:auth-changed",{detail:current}));
      };
      document.head.appendChild(script);
    }
  }

  function toast(message){
    const node = $("authToast");
    if(!node) return;
    clearTimeout(toastTimer);
    node.textContent = message;
    node.classList.add("show");
    toastTimer = setTimeout(() => node.classList.remove("show"),2800);
  }

  function setGateMessage(text,error){
    const node = $("authGateMessage");
    if(!node) return;
    node.textContent = text || "";
    node.classList.toggle("error",!!error);
  }

  function showView(name){
    const login = name !== "setup";
    $("authLoginView").style.display = login ? "block" : "none";
    $("authSetupView").style.display = login ? "none" : "block";
    $("authShowLogin").classList.toggle("active",login);
    $("authShowSetup").classList.toggle("active",!login);
    setGateMessage(firebaseConnected ? "" : "Connecting to Firebase…",false);
  }

  function showGate(view){
    if(view) showView(view);
    $("authGate").classList.add("show");
    document.body.classList.add("auth-signed-out");
  }

  function hideGate(){ $("authGate").classList.remove("show"); }

  function assignmentData(){
    try{
      return window.DTMusicTrainerAssignments && window.DTMusicTrainerAssignments.getData ? window.DTMusicTrainerAssignments.getData() : {students:[],assignments:[]};
    }catch(error){ return {students:[],assignments:[]}; }
  }

  function linkedStudentName(studentId){
    const student = (assignmentData().students || []).find(s => s.id === studentId);
    return student ? student.name : "Linked student";
  }

  function syncStudentProfile(account){
    if(!account || account.role !== "student" || !account.studentId) return;
    const select = $("assignmentStudentSelect");
    if(select){
      select.value = account.studentId;
      select.dispatchEvent(new Event("change",{bubbles:true}));
    }
  }

  function getPublicSession(){
    if(!currentAccount) return null;
    return {
      uid:currentAccount.uid,
      id:currentAccount.uid,
      email:currentAccount.email || "",
      displayName:currentAccount.displayName || "",
      role:currentAccount.role,
      academyId:currentAccount.academyId || "",
      studentId:currentAccount.studentId || ""
    };
  }

  function applyRole(account){
    document.body.classList.remove("role-teacher","role-student","auth-signed-out");
    if(!account){ document.body.classList.add("auth-signed-out"); return; }
    document.body.classList.add(account.role === "student" ? "role-student" : "role-teacher");

    const accountBtn = $("authAccountBtn");
    if(accountBtn) accountBtn.textContent = (account.role === "student" ? "Student · " : "Teacher · ") + (account.displayName || account.email);
    const sub = document.querySelector(".topbar .sub");
    if(sub) sub.textContent = "Phase 6B · Firebase Cloud Sync";

    if(account.role === "student"){
      const launch = $("assignmentLaunchBtn");
      if(launch) launch.textContent = "My Assignments";
      setTimeout(() => {
        syncStudentProfile(account);
        const tab = $("assignmentStudentTab");
        if(tab) tab.click();
      },120);
    }else{
      const launch = $("assignmentLaunchBtn");
      if(launch) launch.textContent = "Open Assignment Dashboard";
    }

    window.dispatchEvent(new CustomEvent("dtmtp:auth-changed",{detail:getPublicSession()}));
  }

  async function waitForProfile(uid,tries){
    const F = fb();
    for(let i=0;i<(tries || 1);i++){
      const snap = await F.getDoc(F.doc(F.db,"users",uid));
      if(snap.exists()) return snap;
      await new Promise(r => setTimeout(r,180));
    }
    return null;
  }

  async function bootstrapTeacherProfile(user){
    const F = fb();
    const academyId = "academy-" + user.uid;
    const academyName = String($("authAcademyName") && $("authAcademyName").value || "DT Music Academy").trim() || "DT Music Academy";
    await F.setDoc(F.doc(F.db,"academies",academyId),{
      name:academyName,
      ownerUid:user.uid,
      createdAt:F.serverTimestamp(),
      updatedAt:F.serverTimestamp()
    },{merge:true});
    await F.setDoc(F.doc(F.db,"users",user.uid),{
      uid:user.uid,
      email:user.email || "",
      displayName:user.displayName || legacyTeacherName() || "Teacher",
      role:"teacher",
      academyId,
      studentId:"",
      disabled:false,
      createdAt:F.serverTimestamp(),
      updatedAt:F.serverTimestamp()
    },{merge:true});
    return waitForProfile(user.uid,3);
  }

  async function activateFirebaseUser(user){
    if(!user){
      currentAccount = null;
      applyRole(null);
      showGate("login");
      return;
    }

    try{
      let profileSnap = await waitForProfile(user.uid,creatingTeacher ? 8 : 2);
      if(!profileSnap){
        profileSnap = await bootstrapTeacherProfile(user);
      }
      if(!profileSnap || !profileSnap.exists()) throw new Error("Cloud profile could not be created.");
      const profile = profileSnap.data();
      if(profile.disabled === true){
        await fb().signOut(fb().auth);
        setGateMessage("This login has been disabled by the teacher.",true);
        return;
      }

      currentAccount = {
        uid:user.uid,
        email:user.email || profile.email || "",
        displayName:profile.displayName || user.displayName || user.email || "Account",
        role:profile.role === "student" ? "student" : "teacher",
        academyId:profile.academyId || "",
        studentId:profile.studentId || ""
      };
      hideGate();
      applyRole(currentAccount);
      renderAccountPanel();
    }catch(error){
      console.error("Firebase account activation failed",error);
      currentAccount = null;
      applyRole(null);
      showGate("login");
      setGateMessage("Firebase signed in, but Firestore access failed. Publish the DT Music Trainer Firestore rules, then sign in again.",true);
    }
  }

  async function createTeacher(){
    const F = fb();
    if(!F){ setGateMessage("Firebase is still loading.",true); return; }
    const displayName = String($("authSetupName").value || "").trim();
    const email = String($("authSetupEmail").value || "").trim().toLowerCase();
    const password = String($("authSetupPassword").value || "");
    if(!displayName){ setGateMessage("Enter your name.",true); return; }
    if(!email.includes("@")){ setGateMessage("Enter a valid email address.",true); return; }
    if(password.length < 6){ setGateMessage("Password must be at least 6 characters.",true); return; }

    creatingTeacher = true;
    setGateMessage("Creating your Firebase teacher account…");
    try{
      const credential = await F.createUserWithEmailAndPassword(F.auth,email,password);
      await F.updateProfile(credential.user,{displayName});
      await bootstrapTeacherProfile(credential.user);
      await activateFirebaseUser(credential.user);
      toast("Cloud teacher account created. Local assignment data is being migrated.");
    }catch(error){
      console.error("Teacher setup failed",error);
      setGateMessage(friendlyError(error),true);
    }finally{
      creatingTeacher = false;
    }
  }

  async function signIn(){
    const F = fb();
    if(!F){ setGateMessage("Firebase is still loading.",true); return; }
    const email = String($("authLoginEmail").value || "").trim().toLowerCase();
    const password = String($("authLoginPassword").value || "");
    if(!email || !password){ setGateMessage("Enter your email and password.",true); return; }
    setGateMessage("Signing in…");
    try{
      await F.signInWithEmailAndPassword(F.auth,email,password);
    }catch(error){
      console.error("Firebase sign in failed",error);
      setGateMessage(friendlyError(error),true);
    }
  }

  function friendlyError(error){
    const code = String(error && error.code || "");
    if(code.includes("email-already-in-use")) return "That email already has a Firebase account. Use Sign In instead.";
    if(code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Email or password is incorrect.";
    if(code.includes("weak-password")) return "Use a stronger password with at least 6 characters.";
    if(code.includes("permission-denied")) return "Firestore permission denied. Publish the DT Music Trainer security rules first.";
    if(code.includes("network-request-failed")) return "Firebase could not connect. Check your internet connection.";
    return (error && error.message) ? error.message : "Something went wrong with Firebase.";
  }

  async function logout(){
    const F = fb();
    if(F) await F.signOut(F.auth);
    const panel = $("authPanel");
    if(panel) panel.classList.remove("show");
  }

  function normalizeStudentLinkName(value){
    return String(value || "").trim().toLowerCase().replace(/\s+/g," ");
  }

  async function repairBrokenStudentLinks(){
    if(!currentAccount || currentAccount.role !== "teacher" || !fb()) return;
    const F = fb();
    const students = assignmentData().students || [];
    if(!students.length) return;

    for(const account of studentAccounts){
      if(students.some(s => s.id === account.studentId)) continue;
      const accountName = normalizeStudentLinkName(account.displayName);
      const matches = students.filter(s => normalizeStudentLinkName(s.name) === accountName);
      if(matches.length !== 1) continue;

      const matched = matches[0];
      await F.updateDoc(F.doc(F.db,"users",account.uid),{
        studentId:matched.id,
        updatedAt:F.serverTimestamp()
      });
      account.studentId = matched.id;
    }
  }

  async function relinkStudent(account){
    if(!account || !currentAccount || currentAccount.role !== "teacher" || !fb()) return;
    const students = assignmentData().students || [];
    if(!students.length){ toast("Create a student profile first."); return; }

    const choices = students.map((s,i) => (i+1) + ". " + s.name).join("\n");
    const answer = prompt("Link " + (account.displayName || account.email || "student") + " to which student?\n\n" + choices + "\n\nEnter the number:");
    if(answer === null) return;
    const index = Number.parseInt(String(answer).trim(),10) - 1;
    const student = students[index];
    if(!student){ toast("Invalid student number."); return; }

    try{
      const F = fb();
      await F.updateDoc(F.doc(F.db,"users",account.uid),{
        studentId:student.id,
        displayName:student.name,
        updatedAt:F.serverTimestamp()
      });
      await loadStudentAccounts();
      toast("Student login linked to " + student.name + ".");
    }catch(error){
      console.error("Student relink failed",error);
      toast(friendlyError(error));
    }
  }

  async function loadStudentAccounts(){
    if(!currentAccount || currentAccount.role !== "teacher" || !fb()) return;
    const F = fb();
    try{
      const q = F.query(F.collection(F.db,"users"),F.where("academyId","==",currentAccount.academyId));
      const snap = await F.getDocs(q);
      studentAccounts = snap.docs.map(d => ({uid:d.id,...d.data()})).filter(a => a.role === "student");
      await repairBrokenStudentLinks();
      populateStudentProfiles();
      renderStudentAccounts();
    }catch(error){
      console.error("Student accounts could not be loaded",error);
      toast("Could not load student cloud logins.");
    }
  }

  function populateStudentProfiles(){
    const select = $("authStudentProfile");
    if(!select) return;
    const data = assignmentData();
    const linked = new Set(studentAccounts.filter(a => !a.disabled && a.studentId).map(a => a.studentId));
    const students = (data.students || []).filter(s => !linked.has(s.id));
    select.innerHTML = "";
    if(!students.length){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = (data.students || []).length ? "All profiles already have active logins" : "Create a student in Assignment Dashboard first";
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
    if(!studentAccounts.length){ list.innerHTML = '<div class="auth-empty">No student cloud logins yet.</div>'; return; }
    studentAccounts.forEach(account => {
      const row = document.createElement("div");
      row.className = "auth-account-row" + (account.disabled ? " auth-account-disabled" : "");
      const text = document.createElement("div");
      text.innerHTML = '<strong></strong><span></span>' + (account.disabled ? '<em>Disabled</em>' : '');
      text.querySelector("strong").textContent = account.displayName || account.email || "Student";
      text.querySelector("span").textContent = (account.email || "No email") + " · " + linkedStudentName(account.studentId);
      const actions = document.createElement("div");
      actions.className = "auth-row-actions";
      const reset = document.createElement("button");
      reset.type = "button";
      reset.textContent = "Send Password Reset";
      reset.onclick = () => sendStudentReset(account);
      const relink = document.createElement("button");
      relink.type = "button";
      relink.textContent = "Link Profile";
      relink.onclick = () => relinkStudent(account);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = account.disabled ? "" : "danger";
      toggle.textContent = account.disabled ? "Enable Login" : "Disable Login";
      toggle.onclick = () => toggleStudent(account);
      actions.append(reset,relink,toggle);
      row.append(text,actions);
      list.appendChild(row);
    });
  }

  async function createStudentLogin(){
    if(!currentAccount || currentAccount.role !== "teacher" || !fb()) return;
    const studentId = String($("authStudentProfile").value || "");
    const email = String($("authStudentEmail").value || "").trim().toLowerCase();
    const password = String($("authStudentPassword").value || "");
    const student = (assignmentData().students || []).find(s => s.id === studentId);
    if(!student){ toast("Choose an available student profile."); return; }
    if(!email.includes("@")){ toast("Enter a valid student email address."); return; }
    if(password.length < 6){ toast("Temporary password must be at least 6 characters."); return; }

    try{
      const F = fb();
      const created = await F.createSecondaryUser(email,password,student.name);
      await F.setDoc(F.doc(F.db,"users",created.uid),{
        uid:created.uid,
        email:created.email,
        displayName:student.name,
        role:"student",
        academyId:currentAccount.academyId,
        studentId:student.id,
        disabled:false,
        createdAt:F.serverTimestamp(),
        updatedAt:F.serverTimestamp()
      });
      $("authStudentEmail").value = "";
      $("authStudentPassword").value = "";
      await loadStudentAccounts();
      toast("Cloud login created for " + student.name + ".");
    }catch(error){
      console.error("Student cloud account creation failed",error);
      toast(friendlyError(error));
    }
  }

  async function sendStudentReset(account){
    if(!account || !account.email || !fb()) return;
    try{
      await fb().sendPasswordResetEmail(fb().auth,account.email);
      toast("Password reset email sent to " + account.email + ".");
    }catch(error){ toast(friendlyError(error)); }
  }

  async function toggleStudent(account){
    if(!account || !fb()) return;
    const next = !account.disabled;
    if(next && !confirm("Disable login for " + (account.displayName || account.email) + "? Their student profile and assignments will stay intact.")) return;
    try{
      await fb().updateDoc(fb().doc(fb().db,"users",account.uid),{disabled:next,updatedAt:fb().serverTimestamp()});
      await loadStudentAccounts();
      toast(next ? "Student login disabled." : "Student login enabled.");
    }catch(error){ toast(friendlyError(error)); }
  }

  function renderAccountPanel(){
    if(!currentAccount) return;
    const subtitle = $("authPanelSubtitle");
    if(subtitle) subtitle.textContent = currentAccount.role === "teacher" ? "Teacher · Firebase cloud account" : "Student · Firebase cloud account";
    const card = $("authCurrentCard");
    if(card){
      card.innerHTML = "";
      const name = document.createElement("div");
      name.className = "auth-current-name";
      name.textContent = currentAccount.displayName || currentAccount.email;
      const meta = document.createElement("div");
      meta.className = "auth-current-meta";
      meta.textContent = (currentAccount.role === "teacher" ? "Teacher" : "Student") + " · " + currentAccount.email + (currentAccount.role === "student" ? " · " + linkedStudentName(currentAccount.studentId) : "");
      card.append(name,meta);
    }
    const tools = $("authTeacherTools");
    if(tools) tools.style.display = currentAccount.role === "teacher" ? "block" : "none";
    if(currentAccount.role === "teacher") loadStudentAccounts();
  }

  function setCloudStatus(detail){
    const node = $("authCloudStatus");
    if(!node || !detail) return;
    node.className = "auth-cloud-status " + (detail.state || "");
    const text = node.querySelector("span:last-child");
    if(text) text.textContent = detail.text || "Cloud";
  }

  function openAccountPanel(){
    if(!currentAccount) return;
    renderAccountPanel();
    $("authPanel").classList.add("show");
  }

  function connectFirebase(){
    if(firebaseConnected || !fb()) return;
    firebaseConnected = true;
    setGateMessage("");
    if(authUnsubscribe) authUnsubscribe();
    authUnsubscribe = fb().onAuthStateChanged(fb().auth,user => activateFirebaseUser(user));
  }

  function bind(){
    $("authShowLogin").onclick = () => showView("login");
    $("authShowSetup").onclick = () => showView("setup");
    $("authSetupBtn").onclick = createTeacher;
    $("authLoginBtn").onclick = signIn;
    $("authLoginPassword").addEventListener("keydown",e => { if(e.key === "Enter") signIn(); });
    $("authSetupPassword").addEventListener("keydown",e => { if(e.key === "Enter") createTeacher(); });
    $("authAccountBtn").onclick = openAccountPanel;
    $("authPanelClose").onclick = () => $("authPanel").classList.remove("show");
    $("authPanel").addEventListener("click",e => { if(e.target === $("authPanel")) $("authPanel").classList.remove("show"); });
    $("authLogoutBtn").onclick = logout;
    $("authCreateStudentBtn").onclick = createStudentLogin;

    const launch = $("assignmentLaunchBtn");
    if(launch) launch.addEventListener("click",() => {
      if(currentAccount && currentAccount.role === "student") setTimeout(() => {
        syncStudentProfile(currentAccount);
        const tab = $("assignmentStudentTab"); if(tab) tab.click();
      },80);
    });

    window.addEventListener("dtmtp:cloud-status",e => setCloudStatus(e.detail));
    window.addEventListener("dtmtp:cloud-data-applied",() => { if(currentAccount) syncStudentProfile(currentAccount); });
    window.addEventListener("dtmtp:firebase-ready",connectFirebase);
  }

  function init(){
    injectUi();
    bind();
    showGate("login");
    loadCloudScripts();
    if(window.DTMTPFirebase) connectFirebase();
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
