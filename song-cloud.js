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
  const LIBRARY_NAME = "Library";
  const MATERIALS_NAME = "Assigned Materials";
  const DRIVE_CONNECTED_KEY = "dtmtp-pro-drive-connected-v1";
  const DRIVE_TOKEN_KEY = "dtmtp-pro-drive-token-v1";
  const DRIVE_TOKEN_EXPIRY_KEY = "dtmtp-pro-drive-token-expiry-v1";
  const DRIVE_SESSION_ACTIVE_KEY = "dtmtp-pro-drive-session-active-v1";

  let session = null;
  let googleTokenClient = null;
  let tokenRefreshPromise = null;
  let driveToken = "";
  let driveRootId = "";
  let libraryFolderId = "";
  let materialsFolderId = "";
  let uploadTimer = null;
  let librarySyncTimer = null;
  let startupTimer = null;
  let toastTimer = null;
  const publishing = new Map();
  const libraryPublishing = new Map();
  const libraryPublishTimers = new Map();
  const downloading = new Map();
  const libraryDownloading = new Map();

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
      <h3 style="margin:0 0 5px">Google Drive Library</h3>
      <p style="margin:0 0 9px;color:#aaa;font-size:12px;line-height:1.5">
        Google Drive stores the teacher Library master files. Music Trainer downloads and caches each score,
        PDF or backing track only when you open it. Assigned Materials stays separate for students.
      </p>
      <button id="dtmtpDriveConnectBtn" class="auth-primary" type="button">Connect Google Drive</button>
      <div id="dtmtpDriveStatus" class="auth-cloud-status" style="margin-top:8px">
        <span class="auth-cloud-dot"></span><span>Google Drive not connected</span>
      </div>
      <div style="margin-top:7px;color:#888;font-size:11px;line-height:1.45">
        Teacher Library files stay private. Only copies in Assigned Materials are shared for student access.
      </div>
    `;
    host.insertBefore(card,host.firstChild);

    $("dtmtpDriveConnectBtn").onclick = connectGoogleDrive;
    if(restoreToken()){
      $("dtmtpDriveConnectBtn").textContent = "Google Drive Connected";
      setDriveStatus("Google Drive session restored","synced");
    }else if(localStorage.getItem(DRIVE_CONNECTED_KEY)){
      setDriveStatus("Reconnect Google Drive to sync the Library","pending");
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
      sessionStorage.setItem(DRIVE_SESSION_ACTIVE_KEY,"1");
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

  function driveSessionActive(){
    try{return sessionStorage.getItem(DRIVE_SESSION_ACTIVE_KEY)==="1";}catch(error){return false;}
  }

  async function ensureDriveToken(){
    if(driveToken||restoreToken()) return driveToken;
    if(!driveSessionActive()||!localStorage.getItem(DRIVE_CONNECTED_KEY)){
      throw new Error("Connect Google Drive from Cloud Account first.");
    }
    if(!(window.google&&google.accounts&&google.accounts.oauth2)){
      throw new Error("Google sign-in is still loading. Try again in a moment.");
    }
    if(tokenRefreshPromise) return tokenRefreshPromise;

    tokenRefreshPromise=new Promise((resolve,reject)=>{
      const silentClient=google.accounts.oauth2.initTokenClient({
        client_id:GOOGLE_CLIENT_ID,
        scope:DRIVE_SCOPE,
        callback:response=>{
          if(!response||response.error||!response.access_token){
            reject(new Error("Google Drive session needs to be reconnected."));
            return;
          }
          storeToken(response);
          resolve(driveToken);
        },
        error_callback:()=>reject(new Error("Google Drive session needs to be reconnected."))
      });
      try{silentClient.requestAccessToken({prompt:""});}
      catch(error){reject(error);}
    }).finally(()=>{tokenRefreshPromise=null;});

    return tokenRefreshPromise;
  }

  async function restoreDriveSessionAndSync(){
    if(!(session&&session.role==="teacher")) return false;
    try{
      await ensureDriveToken();
      const btn=$("dtmtpDriveConnectBtn");
      if(btn) btn.textContent="Google Drive Connected";
      setDriveStatus("Google Drive Library connected","synced");
      await ensureDriveFolders();
      await syncTeacherLibrary();
      await publishAssignedSongs();
      return true;
    }catch(error){
      const btn=$("dtmtpDriveConnectBtn");
      if(btn) btn.textContent="Reconnect Google Drive";
      setDriveStatus("Reconnect Google Drive to continue cloud Library access","pending");
      return false;
    }
  }

  function initGoogleTokenClient(){
    if(!(window.google && google.accounts && google.accounts.oauth2)) return false;
    if(googleTokenClient){
      if(!driveToken&&session&&session.role==="teacher"&&driveSessionActive()&&localStorage.getItem(DRIVE_CONNECTED_KEY)){
        setTimeout(()=>restoreDriveSessionAndSync(),0);
      }
      return true;
    }
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
          await syncTeacherLibrary();
          await publishAssignedSongs();
          emit("synced","Google Drive Library ready");
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
    if(!driveToken&&driveSessionActive()&&localStorage.getItem(DRIVE_CONNECTED_KEY)){
      setTimeout(()=>restoreDriveSessionAndSync(),0);
    }
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
    await ensureDriveToken();

    const request=async()=>fetch(url,{
      ...(options||{}),
      headers:{
        Authorization:"Bearer " + driveToken,
        ...((options&&options.headers)||{})
      }
    });

    let response=await request();
    if(response.status===401&&driveSessionActive()){
      clearToken();
      try{
        await ensureDriveToken();
        response=await request();
      }catch(error){}
    }

    if(!response.ok){
      const detail=await response.text().catch(()=>"");
      if(response.status===401) clearToken();
      const error=new Error("Google Drive "+response.status+(detail?" · "+detail.slice(0,300):""));
      error.status=response.status;
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
    libraryFolderId=academy.driveLibraryFolderId||"";
    materialsFolderId=academy.driveMaterialsFolderId||"";

    if(!(await folderExists(driveRootId))){
      driveRootId=await createFolder(ROOT_NAME,"");
      libraryFolderId="";
      materialsFolderId="";
    }
    if(!(await folderExists(libraryFolderId))){
      libraryFolderId=await createFolder(LIBRARY_NAME,driveRootId);
    }
    if(!(await folderExists(materialsFolderId))){
      materialsFolderId=await createFolder(MATERIALS_NAME,driveRootId);
    }

    await F.updateDoc(academyRef,{
      driveRootId,
      driveLibraryFolderId:libraryFolderId,
      driveMaterialsFolderId:materialsFolderId,
      driveProvider:"google-drive",
      updatedAt:F.serverTimestamp()
    });

    return {driveRootId,libraryFolderId,materialsFolderId};
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

  async function localSongs(){
    if(window.DTMusicTrainerLibrary && window.DTMusicTrainerLibrary.getAllSongs){
      try{
        const rows=await window.DTMusicTrainerLibrary.getAllSongs();
        return Array.isArray(rows)?rows:[];
      }catch(error){}
    }
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const req=db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).getAll();
        req.onsuccess=()=>resolve(Array.isArray(req.result)?req.result:[]);
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

  async function createDriveAsset(asset,parentId,publicRead){
    const boundary="dtmtp_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const meta={name:safeName(asset.name),parents:[parentId||materialsFolderId]};
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
    if(publicRead!==false) await makeAnyoneReader(file.id);
    const metaResponse=await driveFetch(
      "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(file.id) + "?fields=id,resourceKey"
    );
    return await metaResponse.json();
  }

  async function updateDriveAsset(existing,asset,parentId,publicRead){
    if(!existing||!existing.fileId) return await createDriveAsset(asset,parentId,publicRead);
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
      if(publicRead!==false) await makeAnyoneReader(existing.fileId);
      const response=await driveFetch(
        "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(existing.fileId) + "?fields=id,resourceKey"
      );
      return await response.json();
    }catch(error){
      if(error&&error.status===404) return await createDriveAsset(asset,parentId,publicRead);
      throw error;
    }
  }

  async function uploadAsset(asset,existing,parentId,publicRead){
    if(!asset||!asset.blob) return null;
    if(existing&&existing.provider==="google-drive"&&existing.revision===assetRevision(asset)) return existing;
    const file=existing&&existing.provider==="google-drive"
      ? await updateDriveAsset(existing,asset,parentId,publicRead)
      : await createDriveAsset(asset,parentId,publicRead);
    return assetMeta(asset,file);
  }

  async function copyMasterAssetToAssigned(master,existing){
    if(!master||!master.fileId) return null;
    if(existing&&existing.fileId&&existing.sourceRevision&&existing.sourceRevision===master.revision) return existing;

    const headers={"Content-Type":"application/json"};
    if(master.resourceKey) headers["X-Goog-Drive-Resource-Keys"]=master.fileId+"/"+master.resourceKey;
    const response=await driveFetch(
      "https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(master.fileId)+"/copy?fields=id,resourceKey",
      {method:"POST",headers,body:JSON.stringify({name:safeName(master.name||"file"),parents:[materialsFolderId]})}
    );
    const file=await response.json();
    await makeAnyoneReader(file.id);

    if(existing&&existing.fileId&&existing.fileId!==file.id){
      try{await trashDriveItem(existing.fileId);}catch(error){console.warn("Could not trash superseded assigned material",error);}
    }

    return {
      provider:"google-drive",
      fileId:file.id,
      resourceKey:file.resourceKey||"",
      name:String(master.name||"file"),
      mime:String(master.mime||""),
      size:Number(master.size||0),
      updatedAt:Number(master.updatedAt||Date.now()),
      revision:String(master.revision||""),
      sourceRevision:String(master.revision||"")
    };
  }

  async function renameDriveItem(fileId,name){
    if(!fileId) return;
    await driveFetch(
      "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?fields=id",
      {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:safeName(name)})}
    );
  }

  async function trashDriveItem(fileId){
    if(!fileId) return;
    try{
      await driveFetch(
        "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?fields=id",
        {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({trashed:true})}
      );
    }catch(error){
      if(!(error&&error.status===404)) throw error;
    }
  }

  async function cloudSongRecords(){
    const F=fb();
    const s=session||currentSession();
    if(!F||!s||!s.academyId) return [];
    const snap=await F.getDocs(F.collection(F.db,"academies",s.academyId,"songs"));
    const rows=[];
    snap.forEach(docSnap=>{
      const value=docSnap.data()||{};
      rows.push({...value,id:value.id||docSnap.id});
    });
    return rows;
  }

  function masterAssets(meta){
    if(!meta) return {};
    const master=meta.libraryAssets&&typeof meta.libraryAssets==="object"?meta.libraryAssets:{};
    if(Object.values(master).some(Boolean)) return master;
    const legacy=meta.assets&&typeof meta.assets==="object"?meta.assets:{};
    return legacy;
  }

  function isMasterAsset(meta,kind){
    return !!(meta&&meta.libraryAssets&&meta.libraryAssets[kind]);
  }

  function mergedLibraryAsset(remote,local){
    if(!remote) return local||null;
    const cached=sameAsset(local,remote);
    return {
      ...remote,
      blob:cached&&local?local.blob:null,
      cached
    };
  }


  function localAudioVersions(song){
    if(!song) return [];
    if(Array.isArray(song.audioVersions)&&song.audioVersions.length) return song.audioVersions.filter(v=>v&&v.asset);
    if(song.audio) return [{id:"legacy-"+song.id,label:(song.audio.name||"Backing track"),asset:song.audio,syncPoints:Array.isArray(song.syncPoints)?song.syncPoints:[]}];
    return [];
  }

  function remoteLibraryAudioVersions(meta,assets){
    const list=Array.isArray(meta&&meta.libraryAudioVersions)?meta.libraryAudioVersions:[];
    if(list.length) return list.filter(v=>v&&v.asset);
    if(assets&&assets.audio) return [{id:(meta&&meta.activeAudioId)||"legacy-"+((meta&&meta.id)||""),label:(assets.audio.name||"Backing track"),asset:assets.audio,syncPoints:Array.isArray(meta&&meta.syncPoints)?meta.syncPoints:[]}];
    return [];
  }

  function mergeAudioVersions(meta,assets,local){
    const remotes=remoteLibraryAudioVersions(meta,assets);
    const locals=localAudioVersions(local);
    const localMap=new Map(locals.map(v=>[v.id,v]));
    if(!remotes.length) return locals;
    return remotes.map(v=>{
      const lv=localMap.get(v.id)||null;
      return {
        id:v.id,
        label:v.label||((v.asset&&v.asset.name)||"Backing track"),
        syncPoints:Array.isArray(v.syncPoints)?v.syncPoints:[],
        asset:mergedLibraryAsset(v.asset,lv&&lv.asset)
      };
    });
  }

  function mergeLibraryRecord(meta,local){
    const assets=masterAssets(meta);
    const hasCloud=!!meta;
    const audioVersions=mergeAudioVersions(meta,assets,local);
    const activeAudioId=(meta&&meta.activeAudioId)||(local&&local.activeAudioId)||(audioVersions[0]&&audioVersions[0].id)||"";
    const activeVersion=audioVersions.find(v=>v.id===activeAudioId)||audioVersions[0]||null;
    const song={
      id:(meta&&meta.id)||(local&&local.id)||"",
      title:(meta&&meta.title)||(local&&local.title)||"Untitled Song",
      createdAt:Number((meta&&meta.createdAt)||(local&&local.createdAt)||Date.now()),
      updatedAt:Number((meta&&meta.libraryUpdatedAt)||(meta&&meta.localUpdatedAt)||(local&&local.updatedAt)||Date.now()),
      activeAudioId:activeVersion?activeVersion.id:"",
      audioVersions,
      syncPoints:activeVersion?(Array.isArray(activeVersion.syncPoints)?activeVersion.syncPoints:[]):(Array.isArray(meta&&meta.syncPoints)?meta.syncPoints:(Array.isArray(local&&local.syncPoints)?local.syncPoints:[])),
      interactive:mergedLibraryAsset(assets.interactive||null,local&&local.interactive),
      pdf:mergedLibraryAsset(assets.pdf||null,local&&local.pdf),
      audio:activeVersion?activeVersion.asset:mergedLibraryAsset(assets.audio||null,local&&local.audio),
      _cloud:hasCloud,
      _masterReady:!!(meta&&meta.libraryFolderId&&meta.libraryAssets),
      _localOnly:!hasCloud,
      _libraryFolderId:(meta&&meta.libraryFolderId)||""
    };
    song._cachedKinds=["interactive","pdf","audio"].filter(kind=>song[kind]&&song[kind].blob);
    return song;
  }

  async function getLibraryIndex(){
    const locals=await localSongs().catch(()=>[]);
    const localMap=new Map(locals.map(song=>[song.id,song]));
    const s=session||currentSession();
    if(!s||s.role!=="teacher"||!s.academyId){
      return locals.map(song=>mergeLibraryRecord(null,song));
    }

    let cloud=[];
    try{
      cloud=await cloudSongRecords();
    }catch(error){
      console.warn("Cloud Library index unavailable",error);
      return locals.map(song=>mergeLibraryRecord(null,song));
    }

    const rows=[];
    for(const meta of cloud){
      const local=localMap.get(meta.id)||null;
      rows.push(mergeLibraryRecord(meta,local));
      localMap.delete(meta.id);
    }
    for(const local of localMap.values()) rows.push(mergeLibraryRecord(null,local));
    rows.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||"")));
    return rows;
  }

  async function ensureSongFolder(songId,title,existingId){
    let folderId=existingId||"";
    if(!(await folderExists(folderId))){
      folderId=await createFolder(safeName(title||"Untitled Song"),libraryFolderId);
    }else{
      await renameDriveItem(folderId,title||"Untitled Song");
    }
    return folderId;
  }

  async function downloadPrivateDriveAsset(meta){
    if(!meta||!meta.fileId) return null;
    const headers={};
    if(meta.resourceKey) headers["X-Goog-Drive-Resource-Keys"]=meta.fileId+"/"+meta.resourceKey;
    const response=await driveFetch(
      "https://www.googleapis.com/drive/v3/files/"+encodeURIComponent(meta.fileId)+"?alt=media",
      {headers}
    );
    const blob=await response.blob();
    return {
      name:meta.name||"file",
      mime:meta.mime||blob.type||"",
      size:Number(meta.size||blob.size||0),
      updatedAt:Number(meta.updatedAt||Date.now()),
      blob
    };
  }

  async function publishLibrarySong(songId){
    if(!songId) return null;
    if(libraryPublishing.has(songId)) return libraryPublishing.get(songId);

    const task=(async()=>{
      const F=fb();
      const s=session||currentSession();
      if(!F||!s||s.role!=="teacher"||!s.academyId) return null;
      try{await ensureDriveToken();}
      catch(error){
        emit("pending","Connect Google Drive to sync the teacher Library");
        return null;
      }

      const song=await localSong(songId);
      if(!song) return null;
      await ensureDriveFolders();

      const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
      const oldSnap=await F.getDoc(metaRef);
      const old=oldSnap.exists()?oldSnap.data():{};
      const oldMaster=old.libraryAssets||{};
      const folderId=await ensureSongFolder(songId,song.title,old.libraryFolderId||"");
      const libraryAssets={};
      const libraryAudioVersions=[];
      const oldAudioVersions=Array.isArray(old.libraryAudioVersions)?old.libraryAudioVersions:[];
      const oldAudioMap=new Map(oldAudioVersions.map(v=>[v.id,v]));

      emit("syncing","Syncing "+(song.title||"song")+" to the Drive Library…");

      for(const kind of ["interactive","pdf"]){
        if(song[kind]&&song[kind].blob){
          libraryAssets[kind]=await uploadAsset(song[kind],oldMaster[kind]||null,folderId,false);
        }else if(oldMaster[kind]){
          libraryAssets[kind]=oldMaster[kind];
        }else if(old.assets&&old.assets[kind]){
          const legacyAsset=await downloadDriveAsset(old.assets[kind]);
          libraryAssets[kind]=legacyAsset
            ? await uploadAsset(legacyAsset,null,folderId,false)
            : null;
        }else{
          libraryAssets[kind]=null;
        }
      }

      const localVersions=localAudioVersions(song);
      for(const version of localVersions){
        const oldVersion=oldAudioMap.get(version.id);
        const oldAsset=oldVersion&&oldVersion.asset||null;
        const remoteAsset=version.asset&&version.asset.blob
          ? await uploadAsset(version.asset,oldAsset,folderId,false)
          : oldAsset;
        if(remoteAsset){
          libraryAudioVersions.push({
            id:version.id,
            label:version.label||remoteAsset.name||"Backing track",
            syncPoints:Array.isArray(version.syncPoints)?version.syncPoints:[],
            asset:remoteAsset
          });
        }
      }
      const activeAudioId=song.activeAudioId||(libraryAudioVersions[0]&&libraryAudioVersions[0].id)||"";
      const activeRemote=libraryAudioVersions.find(v=>v.id===activeAudioId)||libraryAudioVersions[0]||null;
      libraryAssets.audio=activeRemote?activeRemote.asset:(oldMaster.audio||null);

      const masterUpdatedAt=Number(song.updatedAt||Date.now());
      await F.setDoc(metaRef,{
        id:song.id,
        title:song.title||"Untitled Song",
        provider:"google-drive",
        libraryProvider:"google-drive",
        libraryFolderId:folderId,
        libraryAssets,
        libraryAudioVersions,
        activeAudioId,
        libraryUpdatedAt:masterUpdatedAt,
        createdAt:Number(song.createdAt||old.createdAt||Date.now()),
        syncPoints:activeRemote&&Array.isArray(activeRemote.syncPoints)?activeRemote.syncPoints:(Array.isArray(song.syncPoints)?song.syncPoints:[]),
        updatedAt:F.serverTimestamp()
      },{merge:true});

      window.dispatchEvent(new CustomEvent("dtmtp:library-index-changed",{detail:{songId,type:"sync"}}));
      emit("synced",(song.title||"Song")+" saved to the Drive Library");
      return {songId,folderId,assets:libraryAssets};
    })().catch(error=>{
      console.error("Drive Library upload failed",error);
      const friendly=friendlyDriveError(error);
      emit("error",friendly.message);
      throw friendly;
    }).finally(()=>libraryPublishing.delete(songId));

    libraryPublishing.set(songId,task);
    return task;
  }

  function scheduleLibraryPublish(songId,delay){
    if(!songId) return;
    const old=libraryPublishTimers.get(songId);
    if(old) clearTimeout(old);
    const timer=setTimeout(()=>{
      libraryPublishTimers.delete(songId);
      publishLibrarySong(songId)
        .then(()=>{if(isAssigned(songId)) return publishSong(songId);})
        .catch(error=>console.error(error));
    },delay==null?500:delay);
    libraryPublishTimers.set(songId,timer);
  }

  async function syncTeacherLibrary(){
    const s=session||currentSession();
    if(!s||s.role!=="teacher"||!s.academyId) return [];
    try{await ensureDriveToken();}
    catch(error){return await getLibraryIndex();}

    await ensureDriveFolders();
    const cloud=await cloudSongRecords().catch(()=>[]);
    const cloudMap=new Map(cloud.map(row=>[row.id,row]));
    const locals=await localSongs().catch(()=>[]);

    for(const song of locals){
      const remote=cloudMap.get(song.id)||null;
      const remoteUpdated=Number(remote&&remote.libraryUpdatedAt||0);
      const hasMaster=!!(remote&&remote.libraryFolderId&&remote.libraryAssets);
      if(!hasMaster||Number(song.updatedAt||0)>remoteUpdated){
        await publishLibrarySong(song.id);
      }
    }

    window.dispatchEvent(new CustomEvent("dtmtp:library-index-changed",{detail:{type:"refresh"}}));
    return await getLibraryIndex();
  }

  async function ensureLocalLibraryRecord(songId){
    let local=await localSong(songId);
    if(local) return local;

    const F=fb();
    const s=session||currentSession();
    if(!F||!s||s.role!=="teacher"||!s.academyId) throw new Error("Teacher cloud account is not ready.");
    const snap=await F.getDoc(F.doc(F.db,"academies",s.academyId,"songs",songId));
    if(!snap.exists()) throw new Error("Song not found in the cloud Library.");
    const meta=snap.data()||{};
    local={
      id:songId,
      title:meta.title||"Untitled Song",
      createdAt:Number(meta.createdAt||Date.now()),
      updatedAt:Number(meta.libraryUpdatedAt||meta.localUpdatedAt||Date.now()),
      syncPoints:Array.isArray(meta.syncPoints)?meta.syncPoints:[],
      activeAudioId:meta.activeAudioId||"",
      audioVersions:[],
      interactive:null,
      pdf:null,
      audio:null
    };
    await saveLocalSong(local);
    return local;
  }

  async function ensureLibraryAsset(songId,kind){
    if(!["interactive","pdf","audio"].includes(kind)) throw new Error("Unsupported Library asset.");
    if(!songId) throw new Error("Choose a song first.");
    const key=songId+":"+kind;
    if(libraryDownloading.has(key)) return libraryDownloading.get(key);

    const task=(async()=>{
      const F=fb();
      const s=session||currentSession();
      if(!F||!s||s.role!=="teacher"||!s.academyId) throw new Error("Teacher cloud account is not ready.");

      let local=await localSong(songId);
      const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
      const snap=await F.getDoc(metaRef);
      if(!snap.exists()){
        if(local&&local[kind]&&local[kind].blob) return local[kind];
        throw new Error("This song has not been synced to the Drive Library yet.");
      }

      const meta=snap.data()||{};
      const assets=masterAssets(meta);
      const remote=assets[kind]||null;
      if(!remote){
        if(local&&local[kind]&&local[kind].blob) return local[kind];
        throw new Error("This song has no "+(kind==="interactive"?"interactive score":kind==="pdf"?"PDF":"backing track")+".");
      }
      if(local&&sameAsset(local[kind],remote)) return local[kind];

      if(isMasterAsset(meta,kind)){
        try{await ensureDriveToken();}
        catch(error){throw new Error("Reconnect Google Drive to open this Library file.");}
      }

      emit("syncing","Downloading "+(meta.title||"song")+" "+(kind==="interactive"?"score":kind==="pdf"?"PDF":"backing track")+"…");
      const asset=isMasterAsset(meta,kind)
        ? await downloadPrivateDriveAsset(remote)
        : await downloadDriveAsset(remote);

      local=local||{
        id:songId,
        title:meta.title||"Untitled Song",
        createdAt:Number(meta.createdAt||Date.now()),
        updatedAt:Number(meta.libraryUpdatedAt||meta.localUpdatedAt||Date.now()),
        syncPoints:Array.isArray(meta.syncPoints)?meta.syncPoints:[],
        interactive:null,pdf:null,audio:null
      };
      local.title=meta.title||local.title||"Untitled Song";
      local.createdAt=Number(meta.createdAt||local.createdAt||Date.now());
      local.updatedAt=Number(meta.libraryUpdatedAt||meta.localUpdatedAt||local.updatedAt||Date.now());
      local.syncPoints=Array.isArray(meta.syncPoints)?meta.syncPoints:(local.syncPoints||[]);
      local[kind]=asset;
      await saveLocalSong(local);
      emit("synced",(meta.title||"Song")+" "+(kind==="audio"?"backing track":kind)+" cached on this device");
      return asset;
    })().finally(()=>libraryDownloading.delete(key));

    libraryDownloading.set(key,task);
    return task;
  }

  async function ensureAudioVersion(songId,versionId){
    const s=session||currentSession();
    if(!s) throw new Error("Cloud account is not ready.");
    if(s.role==="teacher") return ensureLibraryAudioVersion(songId,versionId);

    const F=fb();
    if(!F||!s.academyId) throw new Error("Cloud account is not ready.");
    const snap=await F.getDoc(F.doc(F.db,"academies",s.academyId,"songs",songId));
    if(!snap.exists()) throw new Error("Song not found.");
    const meta=snap.data()||{};
    const versions=Array.isArray(meta.audioVersions)?meta.audioVersions:[];
    const remote=versions.find(v=>v&&v.id===versionId);
    if(!remote||!remote.asset) throw new Error("This backing-track version is unavailable.");

    let local=await localSong(songId);
    if(!local) local=await ensureSong(songId);
    let localVersions=localAudioVersions(local).slice();
    let existing=localVersions.find(v=>v.id===versionId);
    if(existing&&sameAsset(existing.asset,remote.asset)) return existing.asset;

    const asset=await downloadDriveAsset(remote.asset);
    const nextVersion={
      id:remote.id,
      label:remote.label||remote.asset.name||"Backing track",
      syncPoints:Array.isArray(remote.syncPoints)?remote.syncPoints:[],
      asset
    };
    const index=localVersions.findIndex(v=>v.id===versionId);
    if(index>=0) localVersions[index]=nextVersion; else localVersions.push(nextVersion);
    local.audioVersions=localVersions;
    local.activeAudioId=versionId;
    local.audio=asset;
    local.syncPoints=nextVersion.syncPoints;
    await saveLocalSong(local);
    return asset;
  }

  async function ensureLibraryAudioVersion(songId,versionId){
    if(!songId||!versionId) throw new Error("Choose a backing-track version first.");
    const key=songId+":audio-version:"+versionId;
    if(libraryDownloading.has(key)) return libraryDownloading.get(key);

    const task=(async()=>{
      const F=fb();
      const s=session||currentSession();
      if(!F||!s||s.role!=="teacher"||!s.academyId) throw new Error("Teacher cloud account is not ready.");
      const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
      const snap=await F.getDoc(metaRef);
      if(!snap.exists()) throw new Error("Song not found in the cloud Library.");
      const meta=snap.data()||{};
      const remoteVersions=remoteLibraryAudioVersions(meta,masterAssets(meta));
      const remote=remoteVersions.find(v=>v.id===versionId);
      if(!remote||!remote.asset) throw new Error("This backing-track version is not available in Google Drive.");

      let local=await localSong(songId);
      if(!local) local=await ensureLocalLibraryRecord(songId);
      const versions=localAudioVersions(local);
      let version=versions.find(v=>v.id===versionId);
      if(version&&sameAsset(version.asset,remote.asset)) return version.asset;

      try{await ensureDriveToken();}
      catch(error){throw new Error("Reconnect Google Drive to load this backing-track version.");}
      emit("syncing","Downloading "+(remote.label||remote.asset.name||"backing track")+"…");
      const asset=await downloadPrivateDriveAsset(remote.asset);

      let nextVersions=localAudioVersions(local).slice();
      const index=nextVersions.findIndex(v=>v.id===versionId);
      const nextVersion={
        id:remote.id,
        label:remote.label||remote.asset.name||"Backing track",
        syncPoints:Array.isArray(remote.syncPoints)?remote.syncPoints:[],
        asset
      };
      if(index>=0) nextVersions[index]=nextVersion; else nextVersions.push(nextVersion);
      local.audioVersions=nextVersions;
      local.activeAudioId=versionId;
      local.audio=asset;
      local.syncPoints=nextVersion.syncPoints;
      await saveLocalSong(local);
      emit("synced",(meta.title||"Song")+" backing version cached on this device");
      return asset;
    })().finally(()=>libraryDownloading.delete(key));

    libraryDownloading.set(key,task);
    return task;
  }

  async function ensureTeacherLibrarySong(songId){
    const F=fb();
    const s=session||currentSession();
    if(!F||!s||s.role!=="teacher"||!s.academyId) return await localSong(songId);
    const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
    const snap=await F.getDoc(metaRef);
    if(!snap.exists()) return await localSong(songId);
    const meta=snap.data()||{};
    const assets=masterAssets(meta);
    for(const kind of ["interactive","pdf","audio"]){
      if(assets[kind]) await ensureLibraryAsset(songId,kind);
    }
    return await localSong(songId);
  }

  async function renameLibrarySong(songId,title){
    const next=String(title||"").trim();
    if(!next) throw new Error("Enter a song title.");
    const F=fb();
    const s=session||currentSession();
    if(!F||!s||s.role!=="teacher"||!s.academyId) throw new Error("Teacher cloud account is not ready.");

    const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
    const snap=await F.getDoc(metaRef);
    if(!snap.exists()){
      const local=await localSong(songId);
      if(!local) throw new Error("Song not found.");
      local.title=next;
      local.updatedAt=Date.now();
      await saveLocalSong(local);
      scheduleLibraryPublish(songId,0);
      return local;
    }

    const meta=snap.data()||{};
    if(meta.libraryFolderId){
      try{await ensureDriveToken();}
      catch(error){throw new Error("Reconnect Google Drive to rename this Library song.");}
      await renameDriveItem(meta.libraryFolderId,next);
    }

    const now=Date.now();
    await F.setDoc(metaRef,{title:next,libraryUpdatedAt:now,updatedAt:F.serverTimestamp()},{merge:true});
    const local=await localSong(songId);
    if(local){
      local.title=next;
      local.updatedAt=now;
      await saveLocalSong(local);
    }
    window.dispatchEvent(new CustomEvent("dtmtp:library-index-changed",{detail:{songId,type:"rename"}}));
    return mergeLibraryRecord({...meta,id:songId,title:next,libraryUpdatedAt:now},local);
  }

  async function deleteLibrarySong(songId){
    const F=fb();
    const s=session||currentSession();
    if(!F||!s||s.role!=="teacher"||!s.academyId) throw new Error("Teacher cloud account is not ready.");
    if(isAssigned(songId)) throw new Error("Remove this song's assignments before deleting it from the Library.");

    const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
    const snap=await F.getDoc(metaRef);
    if(snap.exists()){
      const meta=snap.data()||{};
      const hasDriveFiles=!!meta.libraryFolderId||Object.values(meta.assets||{}).some(Boolean);
      if(hasDriveFiles){
        try{await ensureDriveToken();}
        catch(error){throw new Error("Reconnect Google Drive before deleting this cloud song.");}
      }
      if(meta.libraryFolderId) await trashDriveItem(meta.libraryFolderId);
      for(const asset of Object.values(meta.assets||{})){
        if(asset&&asset.fileId) await trashDriveItem(asset.fileId);
      }
      await F.deleteDoc(metaRef);
    }

    window.dispatchEvent(new CustomEvent("dtmtp:library-index-changed",{detail:{songId,type:"delete"}}));
    emit("synced","Song removed from the Drive Library");
    return true;
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
      try{await ensureDriveToken();}
      catch(error){
        emit("pending","Connect Google Drive to publish assigned song materials");
        return null;
      }

      let song=await localSong(songId);
      if(song){
        try{await publishLibrarySong(songId);}catch(error){console.warn("Master Library sync before assignment failed",error);}
      }

      await ensureDriveFolders();
      const metaRef=F.doc(F.db,"academies",s.academyId,"songs",songId);
      const oldSnap=await F.getDoc(metaRef);
      const old=oldSnap.exists()?oldSnap.data():{};
      const master=old.libraryAssets||{};
      const masterAudioVersions=Array.isArray(old.libraryAudioVersions)?old.libraryAudioVersions:[];
      const oldAssets=old.assets||{};
      const oldAssignedAudioVersions=Array.isArray(old.audioVersions)?old.audioVersions:[];
      const hasMaster=Object.values(master).some(Boolean)||masterAudioVersions.length>0;

      if(!song&&!hasMaster) return null;

      const source={
        id:songId,
        title:(old.title||(song&&song.title)||"Untitled Song"),
        createdAt:Number(old.createdAt||(song&&song.createdAt)||Date.now()),
        updatedAt:Number(old.libraryUpdatedAt||(song&&song.updatedAt)||Date.now()),
        syncPoints:Array.isArray(old.syncPoints)?old.syncPoints:(Array.isArray(song&&song.syncPoints)?song.syncPoints:[])
      };

      emit("syncing","Publishing "+source.title+" for student access…");
      const assets={};
      const assignedAudioVersions=[];

      try{
        for(const kind of ["interactive","pdf"]){
          if(master[kind]){
            assets[kind]=await copyMasterAssetToAssigned(master[kind],oldAssets[kind]||null);
          }else if(song&&song[kind]&&song[kind].blob){
            assets[kind]=await uploadAsset(song[kind],oldAssets[kind]||null,materialsFolderId,true);
          }else{
            assets[kind]=oldAssets[kind]||null;
          }
        }

        const localVersions=localAudioVersions(song);
        const sourceVersions=masterAudioVersions.length
          ? masterAudioVersions
          : localVersions.map(v=>({id:v.id,label:v.label,syncPoints:v.syncPoints,asset:v.asset}));
        const oldAssignedMap=new Map(oldAssignedAudioVersions.map(v=>[v.id,v]));
        for(const version of sourceVersions){
          let assignedAsset=null;
          const oldAssigned=oldAssignedMap.get(version.id);
          if(masterAudioVersions.length&&version.asset){
            assignedAsset=await copyMasterAssetToAssigned(version.asset,oldAssigned&&oldAssigned.asset||null);
          }else if(version.asset&&version.asset.blob){
            assignedAsset=await uploadAsset(version.asset,oldAssigned&&oldAssigned.asset||null,materialsFolderId,true);
          }else if(oldAssigned&&oldAssigned.asset){
            assignedAsset=oldAssigned.asset;
          }
          if(assignedAsset){
            assignedAudioVersions.push({
              id:version.id,
              label:version.label||assignedAsset.name||"Backing track",
              syncPoints:Array.isArray(version.syncPoints)?version.syncPoints:[],
              asset:assignedAsset
            });
          }
        }
        const activeAudioId=old.activeAudioId||(song&&song.activeAudioId)||(assignedAudioVersions[0]&&assignedAudioVersions[0].id)||"";
        const activeAssigned=assignedAudioVersions.find(v=>v.id===activeAudioId)||assignedAudioVersions[0]||null;
        assets.audio=activeAssigned?activeAssigned.asset:(oldAssets.audio||null);

        await F.setDoc(metaRef,{
          id:source.id,
          title:source.title,
          provider:"google-drive",
          createdAt:source.createdAt,
          localUpdatedAt:source.updatedAt,
          activeAudioId:activeAssigned?activeAssigned.id:activeAudioId,
          audioVersions:assignedAudioVersions,
          syncPoints:activeAssigned&&Array.isArray(activeAssigned.syncPoints)?activeAssigned.syncPoints:source.syncPoints,
          assets,
          updatedAt:F.serverTimestamp()
        },{merge:true});

        emit("synced",source.title+" assigned materials ready");
        return {songId,assets};
      }catch(error){
        console.error("Google Drive assignment publish failed",error);
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
        activeAudioId:meta.activeAudioId||(local&&local.activeAudioId)||"",
        audioVersions:localAudioVersions(local),
        syncPoints:Array.isArray(meta.syncPoints)?meta.syncPoints:[],
        interactive:local&&local.interactive?local.interactive:null,
        pdf:local&&local.pdf?local.pdf:null,
        audio:local&&local.audio?local.audio:null
      };

      emit("syncing","Downloading " + next.title + " from Google Drive…");
      let downloaded=0;
      for(const kind of ["interactive","pdf"]){
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

      const remoteAudioVersions=Array.isArray(meta.audioVersions)?meta.audioVersions:[];
      if(remoteAudioVersions.length){
        const localVersionMap=new Map(localAudioVersions(local).map(v=>[v.id,v]));
        next.audioVersions=[];
        for(const remoteVersion of remoteAudioVersions){
          if(!remoteVersion||!remoteVersion.asset) continue;
          const cached=localVersionMap.get(remoteVersion.id);
          const asset=cached&&sameAsset(cached.asset,remoteVersion.asset)
            ? cached.asset
            : await downloadDriveAsset(remoteVersion.asset);
          if(!(cached&&sameAsset(cached.asset,remoteVersion.asset))) downloaded+=1;
          next.audioVersions.push({
            id:remoteVersion.id,
            label:remoteVersion.label||remoteVersion.asset.name||"Backing track",
            syncPoints:Array.isArray(remoteVersion.syncPoints)?remoteVersion.syncPoints:[],
            asset
          });
        }
        const active=next.audioVersions.find(v=>v.id===next.activeAudioId)||next.audioVersions[0]||null;
        if(active){
          next.activeAudioId=active.id;
          next.audio=active.asset;
          next.syncPoints=active.syncPoints;
        }
      }else if(assets.audio){
        if(!sameAsset(next.audio,assets.audio)){
          next.audio=await downloadDriveAsset(assets.audio);
          downloaded+=1;
        }
        if(next.audio){
          next.audioVersions=[{
            id:next.activeAudioId||("legacy-"+songId),
            label:next.audio.name||"Backing track",
            syncPoints:Array.isArray(meta.syncPoints)?meta.syncPoints:[],
            asset:next.audio
          }];
          next.activeAudioId=next.audioVersions[0].id;
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
    if(librarySyncTimer){clearTimeout(librarySyncTimer);librarySyncTimer=null;}
    for(const timer of libraryPublishTimers.values()) clearTimeout(timer);
    libraryPublishTimers.clear();
    injectDriveUi();
    if(session&&session.role==="teacher"){
      loadGoogleIdentity();
      if(restoreToken()){
        const btn=$("dtmtpDriveConnectBtn");
        if(btn) btn.textContent="Google Drive Connected";
        setDriveStatus("Google Drive Library connected","synced");
        librarySyncTimer=setTimeout(async()=>{
          librarySyncTimer=null;
          try{
            await syncTeacherLibrary();
            await publishAssignedSongs();
          }catch(error){console.error("Startup Drive Library sync failed",error);}
        },600);
      }else if(driveSessionActive()&&localStorage.getItem(DRIVE_CONNECTED_KEY)){
        setDriveStatus("Restoring Google Drive Library session…","syncing");
      }else{
        setDriveStatus("Connect Google Drive to sync the teacher Library","pending");
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
    const type=event.detail&&event.detail.type;
    if(!(session&&session.role==="teacher"&&id)) return;
    if(type==="delete"){
      if(isAssigned(id)){
        emit("error","Remove this song's assignments before deleting its cloud Library copy.");
        return;
      }
      deleteLibrarySong(id).catch(error=>console.error(error));
      return;
    }
    scheduleLibraryPublish(id,450);
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
    getLibraryIndex,
    syncTeacherLibrary,
    publishLibrarySong,
    ensureLibraryAsset,
    ensureAudioVersion,
    ensureLibraryAudioVersion,
    ensureLocalLibraryRecord,
    ensureTeacherLibrarySong,
    renameLibrarySong,
    deleteLibrarySong,
    connectGoogleDrive,
    getSession:()=>session,
    isDriveConnected:()=>!!(driveToken||restoreToken()||(driveSessionActive()&&localStorage.getItem(DRIVE_CONNECTED_KEY))),
    getDriveFolders:()=>({driveRootId,libraryFolderId,materialsFolderId})
  };
})();