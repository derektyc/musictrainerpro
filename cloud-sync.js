(function(){
  "use strict";

  const STORAGE_KEY = "dtmtp-phase5-assignments-v1";
  let session = null;
  let unsubscribers = [];
  let pollTimer = null;
  let syncTimer = null;
  let remoteApplyTimer = null;
  let remoteStudents = [];
  let remoteAssignments = [];
  let studentsReady = false;
  let assignmentsReady = false;
  let lastLocalFingerprint = "";
  let applyingRemote = false;
  let queuedRemote = null;
  let syncing = false;

  function fb(){ return window.DTMTPFirebase || null; }

  function emitStatus(state,text){
    window.dispatchEvent(new CustomEvent("dtmtp:cloud-status",{detail:{state,text}}));
  }

  function readLocal(){
    try{
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if(value && Array.isArray(value.students) && Array.isArray(value.assignments)) return value;
    }catch(error){}
    return {version:1,activeStudentId:"",students:[],assignments:[]};
  }

  function cleanDoc(value){
    const result = {...(value || {})};
    delete result.academyId;
    delete result.updatedAt;
    return result;
  }

  function stableClone(value){
    if(Array.isArray(value)) return value.map(stableClone);
    if(value && typeof value === "object"){
      const out = {};
      Object.keys(value).sort().forEach(key => {
        if(key === "activeStudentId") return;
        const v = value[key];
        if(v !== undefined) out[key] = stableClone(v);
      });
      return out;
    }
    return value;
  }

  function fingerprint(value){
    const source = value || {students:[],assignments:[]};
    const normalized = {
      students:(source.students || []).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))),
      assignments:(source.assignments || []).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)))
    };
    return JSON.stringify(stableClone(normalized));
  }

  function practiceRunning(){
    try{
      const state = window.DTMusicTrainerPractice && window.DTMusicTrainerPractice.getState ? window.DTMusicTrainerPractice.getState() : null;
      return !!(state && state.sessionActive);
    }catch(error){ return false; }
  }

  function stopSync(){
    unsubscribers.forEach(fn => { try{ fn(); }catch(error){} });
    unsubscribers = [];
    if(pollTimer){ clearInterval(pollTimer); pollTimer = null; }
    if(syncTimer){ clearTimeout(syncTimer); syncTimer = null; }
    if(remoteApplyTimer){ clearTimeout(remoteApplyTimer); remoteApplyTimer = null; }
    session = null;
    remoteStudents = [];
    remoteAssignments = [];
    studentsReady = false;
    assignmentsReady = false;
    lastLocalFingerprint = "";
    queuedRemote = null;
    syncing = false;
    applyingRemote = false;
  }

  function writeRemoteToLocal(next,label){
    applyingRemote = true;
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
      lastLocalFingerprint = fingerprint(next);
      window.dispatchEvent(new CustomEvent("dtmtp:cloud-data-applied",{
        detail:{role:session ? session.role : "",studentId:session ? session.studentId : ""}
      }));
    }finally{
      applyingRemote = false;
    }
    emitStatus("synced",label || "Cloud synced");
  }

  function scheduleRemoteApply(delay=220){
    if(remoteApplyTimer) clearTimeout(remoteApplyTimer);
    remoteApplyTimer = setTimeout(() => {
      remoteApplyTimer = null;
      if(syncing){
        scheduleRemoteApply(180);
        return;
      }
      applyRemoteData();
    },delay);
  }

  function applyRemoteData(){
    if(!session || !studentsReady || !assignmentsReady) return;

    const local = readLocal();
    let students = remoteStudents.map(cleanDoc);
    let assignments = remoteAssignments.map(cleanDoc);

    if(session.role === "student"){
      students = students.filter(s => s.id === session.studentId);
      assignments = assignments.filter(a => a.studentId === session.studentId);
    }

    const activeStudentId = session.role === "student"
      ? session.studentId
      : (students.some(s => s.id === local.activeStudentId)
          ? local.activeStudentId
          : (students[0] ? students[0].id : ""));

    const next = {version:1,activeStudentId,students,assignments};
    const remotePrint = fingerprint(next);
    const localPrint = fingerprint(local);

    if(remotePrint === localPrint){
      lastLocalFingerprint = localPrint;
      emitStatus("synced","Cloud synced");
      return;
    }

    if(practiceRunning()){
      queuedRemote = next;
      emitStatus("pending","Cloud update waiting for practice to finish");
      return;
    }

    writeRemoteToLocal(next,"Cloud update received");
  }

  function maybeApplyQueued(){
    if(!queuedRemote || practiceRunning()) return;
    const next = queuedRemote;
    queuedRemote = null;
    writeRemoteToLocal(next,"Cloud update received");
  }

  async function teacherUploadAll(local){
    const F = fb();
    if(!F || !session || syncing) return;
    syncing = true;
    emitStatus("syncing","Saving to cloud…");

    try{
      const studentsCol = F.collection(F.db,"academies",session.academyId,"students");
      const assignmentsCol = F.collection(F.db,"academies",session.academyId,"assignments");
      const [studentSnap,assignmentSnap] = await Promise.all([
        F.getDocs(studentsCol),
        F.getDocs(assignmentsCol)
      ]);
      const existingStudents = new Set(studentSnap.docs.map(d=>d.id));
      const existingAssignments = new Set(assignmentSnap.docs.map(d=>d.id));
      const batch = F.writeBatch(F.db);

      (local.students || []).forEach(student => {
        existingStudents.delete(student.id);
        batch.set(F.doc(F.db,"academies",session.academyId,"students",student.id),{
          ...student,
          academyId:session.academyId,
          updatedAt:F.serverTimestamp()
        },{merge:true});
      });

      (local.assignments || []).forEach(assignment => {
        existingAssignments.delete(assignment.id);
        batch.set(F.doc(F.db,"academies",session.academyId,"assignments",assignment.id),{
          ...assignment,
          academyId:session.academyId,
          updatedAt:F.serverTimestamp()
        },{merge:true});
      });

      existingStudents.forEach(id => batch.delete(F.doc(F.db,"academies",session.academyId,"students",id)));
      existingAssignments.forEach(id => batch.delete(F.doc(F.db,"academies",session.academyId,"assignments",id)));
      await batch.commit();
      lastLocalFingerprint = fingerprint(local);
      emitStatus("synced","Cloud synced");
    }catch(error){
      console.error("Teacher cloud sync failed",error);
      emitStatus("error","Cloud sync failed");
    }finally{
      syncing = false;
      scheduleRemoteApply(180);
    }
  }

  async function studentUploadProgress(local){
    const F = fb();
    if(!F || !session || syncing) return;
    syncing = true;
    emitStatus("syncing","Saving practice progress…");

    try{
      const mine = (local.assignments || []).filter(a => a.studentId === session.studentId);
      await Promise.all(mine.map(a => F.updateDoc(
        F.doc(F.db,"academies",session.academyId,"assignments",a.id),
        {progress:a.progress || {},updatedAt:F.serverTimestamp()}
      )));
      lastLocalFingerprint = fingerprint(local);
      emitStatus("synced","Practice progress synced");
    }catch(error){
      console.error("Student progress sync failed",error);
      emitStatus("error","Progress sync failed");
    }finally{
      syncing = false;
      scheduleRemoteApply(180);
    }
  }

  function scheduleLocalUpload(){
    if(!session || applyingRemote) return;
    if(syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      const local = readLocal();
      const print = fingerprint(local);
      if(print === lastLocalFingerprint) return;
      if(session.role === "teacher") await teacherUploadAll(local);
      else await studentUploadProgress(local);
    },300);
  }

  function startPolling(){
    if(pollTimer) clearInterval(pollTimer);
    lastLocalFingerprint = fingerprint(readLocal());
    pollTimer = setInterval(() => {
      maybeApplyQueued();
      const print = fingerprint(readLocal());
      if(print !== lastLocalFingerprint) scheduleLocalUpload();
    },650);
  }

  async function bootstrapTeacher(){
    const F = fb();
    emitStatus("syncing","Connecting cloud data…");
    const studentsCol = F.collection(F.db,"academies",session.academyId,"students");
    const assignmentsCol = F.collection(F.db,"academies",session.academyId,"assignments");

    try{
      const [studentSnap,assignmentSnap] = await Promise.all([
        F.getDocs(studentsCol),
        F.getDocs(assignmentsCol)
      ]);
      const cloudEmpty = studentSnap.empty && assignmentSnap.empty;
      const local = readLocal();
      const localHasData = (local.students || []).length || (local.assignments || []).length;
      if(cloudEmpty && localHasData){
        await teacherUploadAll(local);
        emitStatus("synced","Local students and assignments migrated to cloud");
      }
    }catch(error){
      console.error("Cloud migration check failed",error);
      emitStatus("error","Cloud permission denied — check Firestore rules");
    }

    unsubscribers.push(F.onSnapshot(studentsCol,snap => {
      remoteStudents = snap.docs.map(d => ({id:d.id,...d.data()}));
      studentsReady = true;
      scheduleRemoteApply();
    },error => {
      console.error("Students listener failed",error);
      emitStatus("error","Student sync unavailable");
    }));

    unsubscribers.push(F.onSnapshot(assignmentsCol,snap => {
      remoteAssignments = snap.docs.map(d => ({id:d.id,...d.data()}));
      assignmentsReady = true;
      scheduleRemoteApply();
    },error => {
      console.error("Assignments listener failed",error);
      emitStatus("error","Assignment sync unavailable");
    }));

    startPolling();
  }

  async function bootstrapStudent(){
    const F = fb();
    emitStatus("syncing","Loading your assignments…");
    const studentRef = F.doc(F.db,"academies",session.academyId,"students",session.studentId);
    const assignmentsCol = F.collection(F.db,"academies",session.academyId,"assignments");
    const mineQuery = F.query(assignmentsCol,F.where("studentId","==",session.studentId));

    unsubscribers.push(F.onSnapshot(studentRef,snap => {
      remoteStudents = snap.exists() ? [{id:snap.id,...snap.data()}] : [];
      studentsReady = true;
      scheduleRemoteApply();
    },error => {
      console.error("Student profile listener failed",error);
      emitStatus("error","Student profile unavailable");
    }));

    unsubscribers.push(F.onSnapshot(mineQuery,snap => {
      remoteAssignments = snap.docs.map(d => ({id:d.id,...d.data()}));
      assignmentsReady = true;
      scheduleRemoteApply();
    },error => {
      console.error("Student assignment listener failed",error);
      emitStatus("error","Assignments unavailable");
    }));

    startPolling();
  }

  function begin(nextSession){
    stopSync();
    if(!nextSession || !nextSession.academyId) return;
    session = nextSession;
    if(session.role === "teacher") bootstrapTeacher();
    else if(session.role === "student" && session.studentId) bootstrapStudent();
  }

  window.addEventListener("dtmtp:auth-changed",event => begin(event.detail || null));
  window.addEventListener("dtmtp:firebase-ready",() => {
    try{
      const s = window.DTMusicTrainerAuth && window.DTMusicTrainerAuth.getSession
        ? window.DTMusicTrainerAuth.getSession()
        : null;
      if(s) begin(s);
    }catch(error){}
  });

  window.DTMusicTrainerCloudSync = {
    getStatus:() => ({session,queued:!!queuedRemote,syncing}),
    force:() => scheduleLocalUpload()
  };
})();