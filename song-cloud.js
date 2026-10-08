(function(){
  "use strict";

  const DB_NAME = "dt-music-trainer-pro";
  const DB_VERSION = 1;
  const STORE_NAME = "songs";
  const ASSIGNMENTS_KEY = "dtmtp-phase5-assignments-v1";

  const GOOGLE_CLIENT_ID = "19844780595-pfas3r99o39m679oabln8p2uehm0deek.apps.googleusercontent.com";
  const GOOGLE_API_KEY = "AIzaSyAJvltLC7N4pXYfZu_0La8ee-W7T11uUC0";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const ROOT_NAME = "DT Music Trainer Pro";
  const MATERIALS_NAME = "Assigned Materials";
  const DRIVE_CONNECTED_KEY = "dtmtp-pro-drive-connected-v1";
  const DRIVE_TOKEN_KEY = "dtmtp-pro-drive-token-v1";
  const DRIVE_TOKEN_EXPIRY_KEY = "dtmtp-pro-drive-token-expiry-v1";

  let session = null;
  let googleTokenClient = null;
  let driveToken = "";
  let driveRootId = "";
  let materialsFolderId = "";
  let uploadTimer = null;
  let startupTimer = null;
  let toastTimer = null;
  const publishing = new Map();
  const downloading = new Map();

  const $ = id => document.getElementById(id);
  function fb(){ return window.DTMTPFirebase || null; }

  function currentSession(){
    try{
      return window.DTMusicTrainerAuth && window.DTMusicTrainerAuth.getSession
        ? window.DTMusicTrainerAuth.getSession()
        : null;
    }catch(error){ return null; }
  }

  function emit(state,text){
    window.dispatchEvent(new CustomEvent("dtmtp:materials-status",{detail:{state,text}}));
    window.dispatchEvent(new CustomEvent("dtmtp:cloud-status",{detail:{state,text}}));
    setDriveStatus(text,state);
  }

  function toast(message){
    const node = $("authToast") || $("assignmentToast") || $("toast");
    if(!node) return;
    clearTimeout(toastTimer);
    node.textContent = message;
    node.classList.add("show");
    node.style.display = "block";
    toastTimer = setTimeout(() => {
      node.classList.remove("show");
      if(node.id === "toast") node.style.display = "none";
    },3200);
  }

  function injectDriveUi(){
    if($("dtmtpDriveMaterialsCard")) return;
    const host = $("authTeacherTools");
    if(!host) return;

    const card = document.createElement("div");
    card.id = "dtmtpDriveMaterialsCard";
    card.style.cssText = "margin:14px 0;padding:12px;border:1px solid #444;border-radius:10px;background:#242424";
    card.innerHTML = `
      <h3 style="margin:0 0 5px">Google Drive Materials</h3>
      <p style="margin:0 0 9px;color:#aaa;font-size:10px;line-height:1.45">
        Assigned MusicXML/Guitar Pro, PDF and MP3/WAV files are stored in your Google Drive.
        Students download them through the assignment and cache them on their device.
      </p>
      <button id="dtmtpDriveConnectBtn" class="auth-primary" type="button">Connect Google Drive</button>
      <div id="dtmtpDriveStatus" class="auth-cloud-status" style="margin-top:8px">
        <span class="auth-cloud-dot"></span><span>Google Drive not connected</span>
      </div>
      <div style="margin-top:7px;color:#888;font-size:9px;line-height:1.4">
        Assigned files are shared as “Anyone with the link” so students do not need a Google account.
      </div>
    `;
    host.insertBefore(card,host.firstChild);

    $("dtmtpDriveConnectBtn").onclick = connectGoogleDrive;
    if(restoreToken()){
      $("dtmtpDriveConnectBtn").textContent = "Google Drive Connected";
      setDriveStatus("Google Drive session restored","synced");
    }else if(localStorage.getItem(DRIVE_CONNECTED_KEY)){
      setDriveStatus("Reconnect Google Drive to upload materials","pending");
    }
  }

  function setDriveStatus(text,state){
    const node = $("dtmtpDriveStatus");
    if(!node) return;
    node.className = "auth-cloud-status " + (state || "");
    const span = node.querySelector("span:last-child");
    if(span) span.textContent = text || "";
  }

  function loadGoogleIdentity(){
    if(window.google && google.accounts && google.accounts.oauth2){
      initGoogleTokenClient();
      return;
    }
    if(document.querySelector('script[data-dtmtp-google-identity]')) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.dtmpGoogleIdentity = "1";
    script.onload = () => initGoogleTokenClient();
    document.head.appendChild(script);
  }

  function storeToken(response){
    if(!response || !response.access_token) return;
    driveToken = response.access_token;
    const expiresIn = Math.max(60,Number(response.expires_in)||3600);
    const expiry = Date.now() + expiresIn * 1000 - 60000;
    try{
      sessionStorage.setItem(DRIVE_TOKEN_KEY,driveToken);
      sessionStorage.setItem(DRIVE_TOKEN_EXPIRY_KEY,String(expiry));
    }catch(error){}
  }

  function restoreToken(){
    try{
      const token = sessionStorage.getItem(DRIVE_TOKEN_KEY) || "";
      const expiry = Number(sessionStorage.getItem(DRIVE_TOKEN_EXPIRY_KEY)||0);
      if(token && expiry > Date.now()){
        driveToken = token;
        return true;
      }
    }catch(error){}
    driveToken = "";
    try{
      sessionStorage.removeItem(DRIVE_TOKEN_KEY);
      sessionStorage.removeItem(DRIVE_TOKEN_EXPIRY_KEY);
    }catch(error){}
    return false;
  }

  function clearToken(){
    driveToken = "";
    try{
      sessionStorage.removeItem(DRIVE_TOKEN_KEY);
      sessionStorage.removeItem(DRIVE_TOKEN_EXPIRY_KEY);
    }catch(error){}
  }

  function initGoogleTokenClient(){
    if(googleTokenClient || !(window.google && google.accounts && google.accounts.oauth2)) return !!googleTokenClient;
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id:GOOGLE_CLIENT_ID,
      scope:DRIVE_SCOPE,
      callback:async response => {
        if(!response || response.error || !response.access_token){
          clearToken();
          setDriveStatus("Google Drive sign-in was not completed","error");
          return;
        }
        storeToken(response);
        localStorage.setItem(DRIVE_CONNECTED_KEY,"1");
        const btn = $("dtmtpDriveConnectBtn");
        if(btn) btn.textContent = "Google Drive Connected";
        try{
          await ensureDriveFolders();
          await publishAssignedSongs();
          emit("synced","Google Drive materials ready");
        }catch(error){
          console.error("Google Drive materials setup failed",error);
          emit("error",friendlyDriveError(error).message);
        }
      },
      error_callback:() => {
        clearToken();
        setDriveStatus("Google Drive reconnect required","error");
      }
    });
    return true;
  }

  function connectGoogleDrive(){
    if(!(session && session.role === "teacher")){
      toast("Only the teacher account connects the academy Google Drive.");
      return;
    }
    if(!googleTokenClient && !initGoogleTokenClient()){
      setDriveStatus("Google sign-in is still loading. Try again in a moment.","pending");
      return;
    }
    setDriveStatus("Connecting to Google Drive…","syncing");
    googleTokenClient.requestAccessToken({
      prompt:localStorage.getItem(DRIVE_CONNECTED_KEY) ? "" : "consent"
    });
  }

  async function driveFetch(url,options){
    if(!driveToken && !restoreToken()) throw new Error("Connect Google Drive from Cloud Account first.");
    const response = await fetch(url,{
      ...(options||{}),
      headers:{
        Authorization:"Bearer " + driveToken,
        ...((options&&options.headers)||{})
      }
    });
    if(!response.ok){
      const detail = await response.text().catch(()=>"");
      if(response.status === 401) clearToken();
      const error = new Error("Google Drive " + response.status + (detail ? " · " + detail.slice(0,300) : ""));
      error.status = response.status;
      throw error;
    }
    return response;
  }

  async function createFolder(name,parentId){
    const body = {name,mimeType:"application/vnd.google-apps.folder"};
    if(parentId) body.parents=[parentId];
    const response = await driveFetch(
      "https://www.googleapis.com/drive/v3/files?fields=id",
      {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}
    );
    return (await response.json()).id;
  }

  async function folderExists(id){
    if(!id) return false;
    try{
      await driveFetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?fields=id");
      return true;
    }catch(error){
      if(error && error.status === 404) return false;
      throw error;
    }
  }

  async function ensureDriveFolders(){
    const F=fb();
    const s=session||currentSession();
    if(!F || !s || s.role!=="teacher" || !s.academyId) throw new Error("Teacher cloud account is not ready.");

    const academyRef=F.doc(F.db,"academies",s.academyId);
    const snap=await F.getDoc(academyRef);
    const academy=snap.exists()?snap.data():{};

    driveRootId=academy.driveRootId||"";
    materialsFolderId=academy.driveMaterialsFolderId||"";

    if(!(await folderExists(driveRootId))){
      driveRootId=await createFolder(ROOT_NAME,"");
      materialsFolderId="";
    }
    if(!(await folderExists(materialsFolderId))){
      materialsFolderId=await createFolder(MATERIALS_NAME,driveRootId);
    }

    await F.updateDoc(academyRef,{
      driveRootId,
      driveMaterialsFolderId:materialsFolderId,
      driveProvider:"google-drive",
      updatedAt:F.serverTimestamp()
    });

    return {driveRootId,materialsFolderId};
  }

  function assignments(){
    try{
      if(window.DTMusicTrainerAssignments && window.DTMusicTrainerAssignments.getData){
        return window.DTMusicTrainerAssignments.getData().assignments || [];
      }
      const data=JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY)||"null");
      return data&&Array.isArray(data.assignments)?data.assignments:[];
    }catch(error){ return []; }
  }

  function assignedSongIds(){
    return [...new Set(assignments().map(a=>a&&a.songId).filter(Boolean))];
  }

  function isAssigned(songId){
    return assignments().some(a=>a&&a.songId===songId);
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME,{keyPath:"id"});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error("Could not open local song library."));
    });
  }

  async function localSong(songId){
    if(window.DTMusicTrainerLibrary && window.DTMusicTrainerLibrary.getSong){
      try{return await window.DTMusicTrainerLibrary.getSong(songId);}catch(error){}
    }
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const req=db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).get(songId);
        req.onsuccess=()=>resolve(req.result||null);
        req.onerror=()=>reject(req.error);
      });
    }finally{try{db.close();}catch(error){}}
  }

  async function saveLocalSong(song){
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,"readwrite");
        const req=tx.objectStore(STORE_NAME).put(song);
        req.onsuccess=()=>resolve();
        req.onerror=()=>reject(req.error);
      });
    }finally{try{db.close();}catch(error){}}
    if(window.DTMusicTrainerLibrary && window.DTMusicTrainerLibrary.refresh){
      try{await window.DTMusicTrainerLibrary.refresh();}catch(error){}
    }
    window.dispatchEvent(new CustomEvent("dtmtp:materials-ready",{detail:{songId:song.id}}));
  }

  function safeName(name){
    return String(name||"file").replace(/[\\/]+/g,"_").replace(/[?#\[\]*]+/g,"_").slice(0,180)||"file";
  }

  function assetRevision(asset){
    if(!asset) return "";
    return [String(asset.name||""),Number(asset.size||0),Number(asset.updatedAt||0),String(asset.mime||"")].join("|");
  }

  function assetMeta(asset,file){
    if(!asset||!file) return null;
    return {
      provider:"google-drive",
      fileId:file.id,
      resourceKey:file.resourceKey||"",
      name:String(asset.name||"file"),
      mime:String(asset.mime||""),
      size:Number(asset.size||0),
      updatedAt:Number(asset.updatedAt||0),
      revision:assetRevision(asset)
    };
  }

  async function makeAnyoneReader(fileId){
    try{
      await driveFetch(
        "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "/permissions?sendNotificationEmail=false",
        {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"anyone",role:"reader",allowFileDiscovery:false})}
      );
    }catch(error){
      const text=String(error&&error.message||"");
      if(!text.includes("already") && !text.includes("duplicate")) throw error;
    }
  }

  async function createDriveAsset(asset){
    const boundary="dtmtp_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const meta={name:safeName(asset.name),parents:[materialsFolderId]};
    if(asset.mime) meta.mimeType=asset.mime;
    const body=new Blob([
      "--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+JSON.stringify(meta)+"\r\n",
      "--"+boundary+"\r\nContent-Type: "+(asset.mime||"application/octet-stream")+"\r\n\r\n",
      asset.blob,
      "\r\n--"+boundary+"--"
    ]);
    const response=await driveFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,resourceKey",
      {method:"POST",headers:{"Content-Type":"multipart/related; boundary="+boundary},body}
    );
    const file=await response.json();
    await makeAnyoneReader(file.id);
    const metaResponse=await driveFetch(
      "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.id) + "?fields=id,resourceKey"
    );
    return await metaResponse.json();
  }

  async function updateDriveAsset(existing,asset){
    if(!existing||!existing.fileId) return await createDriveAsset(asset);
    try{
      await driveFetch(
        "https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(existing.fileId) + "?uploadType=media&fields=id,resourceKey",
        {method:"PATCH",headers:{"Content-Type":asset.mime||"application/octet-stream"},body:asset.blob}
      );
      if(existing.name !== asset.name){
        await driveFetch(
          "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(existing.fileId) + "?fields=id,resourceKey",
          {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:safeName(asset.name)})}
        );
      }
      const response=await driveFetch(
        "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(existing.fileId) + "?fields=id,resourceKey"
      );
      return await response.json();
    }catch(error){
      if(error&&error.status===404) return await createDriveAsset(asset);
      throw error;
    }
  }

  async function uploadAsset(asset,existing){
    if(!asset||!asset.blob) return null;
    if(existing&&existing.provider==="google-drive"&&existing.revision===assetRevision(asset)) return existing;
    const file=existing&&existing.provider==="google-drive"
      ? await updateDriveAsset(existing,asset)
      : await createDriveAsset(asset);
    return assetMeta(asset,file);
  }

  function friendlyDriveError(error){
    const message=String(error&&error.message||"");
    if(message.includes("403")){
      return new Error("Google Drive access was denied. Make sure the Google Drive API is enabled for the same Google Cloud project.");
    }
    if(message.includes("401")){
      return new Error("Google Drive session expired. Reconnect Google Drive from Cloud Account.");
    }
    return error instanceof Error?error:new Error("Google Drive materials are unavailable.");
  }

  async function publishSong(songId){
    if(!songId) return null;
    if(publishing.has(songId)) return publishing.get(songId);

    const task=(async()=>{
      const F=fb();
      const s=session||currentSession();
      if(!F||!s||s.role!=="teacher"||!s.academyId) return null;
      if(!driveToken&&!restoreToken()){
        emit("pending","Connect Google Drive to upload assigned song materials");
        return null;
      }

      const song=await localSong(songId);
      if(!song) return null;

      await ensureDriveFolders();
      emit("syncing","Uploading " + (song.title||"song") + " to Google Drive…");

      try{
        const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
        const oldSnap=await F.getDoc(metaRef);
        const old=oldSnap.exists()?oldSnap.data():{};
        const oldAssets=old.assets||{};
        const assets={};

        for(const kind of ["interactive","pdf","audio"]){
          assets[kind]=song[kind]&&song[kind].blob
            ? await uploadAsset(song[kind],oldAssets[kind]||null)
            : null;
        }

        await F.setDoc(metaRef,{
          id:song.id,
          title:song.title||"Untitled Song",
          provider:"google-drive",
          createdAt:Number(song.createdAt||Date.now()),
          localUpdatedAt:Number(song.updatedAt||Date.now()),
          syncPoints:Array.isArray(song.syncPoints)?song.syncPoints:[],
          assets,
          updatedAt:F.serverTimestamp()
        },{merge:true});

        emit("synced",(song.title||"Song") + " materials synced to Google Drive");
        return {songId,assets};
      }catch(error){
        console.error("Google Drive song upload failed",error);
        const friendly=friendlyDriveError(error);
        emit("error",friendly.message);
        throw friendly;
      }
    })().finally(()=>publishing.delete(songId));

    publishing.set(songId,task);
    return task;
  }

  async function publishAssignedSongs(){
    const s=session||currentSession();
    if(!s||s.role!=="teacher") return;
    const ids=assignedSongIds();
    for(const id of ids){
      await publishSong(id);
    }
  }

  function schedulePublish(delay){
    if(uploadTimer) clearTimeout(uploadTimer);
    uploadTimer=setTimeout(()=>{
      uploadTimer=null;
      publishAssignedSongs().catch(error=>console.error(error));
    },delay==null?350:delay);
  }

  async function downloadDriveAsset(meta){
    if(!meta||!meta.fileId) return null;
    let url="https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(meta.fileId) + "?alt=media&key=" + encodeURIComponent(GOOGLE_API_KEY);
    const headers={};
    if(meta.resourceKey) headers["X-Goog-Drive-Resource-Keys"]=meta.fileId + "/" + meta.resourceKey;
    const response=await fetch(url,{headers});
    if(!response.ok){
      const detail=await response.text().catch(()=>"");
      if(response.status===403){
        throw new Error("Google Drive download is blocked. Enable the Google Drive API for the API key used by Music Trainer Pro.");
      }
      if(response.status===404){
        throw new Error("The teacher's Google Drive material could not be found.");
      }
      throw new Error("Google Drive download failed ("+response.status+"). " + detail.slice(0,180));
    }
    const blob=await response.blob();
    return {
      name:meta.name||"file",
      mime:meta.mime||blob.type||"",
      size:Number(meta.size||blob.size||0),
      updatedAt:Number(meta.updatedAt||Date.now()),
      blob
    };
  }

  function sameAsset(local,remote){
    return !!(local&&local.blob&&remote&&
      String(local.name||"")===String(remote.name||"")&&
      Number(local.size||0)===Number(remote.size||0)&&
      Number(local.updatedAt||0)===Number(remote.updatedAt||0));
  }

  async function ensureSong(songId){
    if(!songId) throw new Error("This assignment has no song linked.");
    if(downloading.has(songId)) return downloading.get(songId);

    const task=(async()=>{
      const F=fb();
      const s=session||currentSession();
      if(!F||!s||!s.academyId) throw new Error("Cloud account is still loading.");

      const local=await localSong(songId);
      const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
      const snap=await F.getDoc(metaRef);

      if(!snap.exists()){
        if(local&&local.interactive&&local.interactive.blob) return local;
        throw new Error("The teacher has not uploaded this assignment's materials to Google Drive yet.");
      }

      const meta=snap.data()||{};
      const assets=meta.assets||{};
      const next={
        id:songId,
        title:meta.title||(local&&local.title)||"Untitled Song",
        createdAt:Number(meta.createdAt||(local&&local.createdAt)||Date.now()),
        updatedAt:Number(meta.localUpdatedAt||Date.now()),
        syncPoints:Array.isArray(meta.syncPoints)?meta.syncPoints:[],
        interactive:local&&local.interactive?local.interactive:null,
        pdf:local&&local.pdf?local.pdf:null,
        audio:local&&local.audio?local.audio:null
      };

      emit("syncing","Downloading " + next.title + " from Google Drive…");
      let downloaded=0;
      for(const kind of ["interactive","pdf","audio"]){
        const remote=assets[kind]||null;
        if(!remote){
          next[kind]=null;
          continue;
        }
        if(!sameAsset(next[kind],remote)){
          next[kind]=await downloadDriveAsset(remote);
          downloaded+=1;
        }
      }

      if(!next.interactive||!next.interactive.blob){
        throw new Error("This assignment has no interactive score uploaded yet.");
      }

      await saveLocalSong(next);
      emit("synced",downloaded?(next.title+" downloaded from Google Drive"):(next.title+" ready"));
      return next;
    })().catch(error=>{
      console.error("Google Drive material download failed",error);
      const friendly=friendlyDriveError(error);
      emit("error",friendly.message);
      throw friendly;
    }).finally(()=>downloading.delete(songId));

    downloading.set(songId,task);
    return task;
  }

  function begin(nextSession){
    session=nextSession||null;
    if(uploadTimer){clearTimeout(uploadTimer);uploadTimer=null;}
    injectDriveUi();
    if(session&&session.role==="teacher"){
      loadGoogleIdentity();
      if(restoreToken()){
        const btn=$("dtmtpDriveConnectBtn");
        if(btn) btn.textContent="Google Drive Connected";
        schedulePublish(600);
      }else{
        setDriveStatus("Connect Google Drive to sync assigned materials","pending");
      }
    }
  }

  function beginFromCurrentAuth(){
    const s=currentSession();
    if(!s||!s.academyId) return false;
    const same=session&&session.uid===s.uid&&session.role===s.role&&session.academyId===s.academyId&&session.studentId===s.studentId;
    if(!same) begin(s);
    return true;
  }

  window.addEventListener("dtmtp:auth-changed",event=>begin(event.detail||null));
  window.addEventListener("dtmtp:firebase-ready",()=>beginFromCurrentAuth());
  window.addEventListener("dtmtp:assignment-created",event=>{
    const id=event.detail&&event.detail.songId;
    if(session&&session.role==="teacher"&&id) publishSong(id).catch(error=>console.error(error));
  });
  window.addEventListener("dtmtp:library-changed",event=>{
    const id=event.detail&&event.detail.songId;
    if(session&&session.role==="teacher"&&id&&isAssigned(id)) publishSong(id).catch(error=>console.error(error));
  });
  window.addEventListener("dtmtp:cloud-data-applied",()=>{
    if(session&&session.role==="teacher") schedulePublish(500);
  });

  injectDriveUi();
  loadGoogleIdentity();
  let tries=0;
  startupTimer=setInterval(()=>{
    tries+=1;
    if(beginFromCurrentAuth()||tries>=30){
      clearInterval(startupTimer);
      startupTimer=null;
    }
  },150);
  beginFromCurrentAuth();

  window.DTMusicTrainerSongCloud={
    ensureSong,
    publishSong,
    publishAssignedSongs,
    connectGoogleDrive,
    getSession:()=>session,
    isDriveConnected:()=>!!(driveToken||restoreToken())
  };
})();