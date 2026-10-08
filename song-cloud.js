(function(){
  "use strict";

  const DB_NAME = "dt-music-trainer-pro";
  const DB_VERSION = 1;
  const STORE_NAME = "songs";
  const ASSIGNMENTS_KEY = "dtmtp-phase5-assignments-v1";

  let session = null;
  let startupTimer = null;
  let uploadTimer = null;
  const publishing = new Map();
  const downloading = new Map();

  function fb(){ return window.DTMTPFirebase || null; }

  function emit(state,text){
    window.dispatchEvent(new CustomEvent("dtmtp:materials-status",{detail:{state,text}}));
    window.dispatchEvent(new CustomEvent("dtmtp:cloud-status",{detail:{state,text}}));
  }

  function currentSession(){
    try{
      return window.DTMusicTrainerAuth && window.DTMusicTrainerAuth.getSession
        ? window.DTMusicTrainerAuth.getSession()
        : null;
    }catch(error){ return null; }
  }

  function assignments(){
    try{
      if(window.DTMusicTrainerAssignments && window.DTMusicTrainerAssignments.getData){
        return window.DTMusicTrainerAssignments.getData().assignments || [];
      }
      const data = JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || "null");
      return data && Array.isArray(data.assignments) ? data.assignments : [];
    }catch(error){ return []; }
  }

  function assignedSongIds(){
    return [...new Set(assignments().map(a => a && a.songId).filter(Boolean))];
  }

  function isAssigned(songId){
    return assignments().some(a => a && a.songId === songId);
  }

  function openDb(){
    return new Promise((resolve,reject) => {
      const req = indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if(!database.objectStoreNames.contains(STORE_NAME)){
          database.createObjectStore(STORE_NAME,{keyPath:"id"});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Could not open local song library."));
    });
  }

  async function localSong(songId){
    const db = await openDb();
    try{
      return await new Promise((resolve,reject) => {
        const req = db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).get(songId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }finally{
      try{ db.close(); }catch(error){}
    }
  }

  async function saveLocalSong(song){
    const db = await openDb();
    try{
      await new Promise((resolve,reject) => {
        const tx = db.transaction(STORE_NAME,"readwrite");
        const req = tx.objectStore(STORE_NAME).put(song);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }finally{
      try{ db.close(); }catch(error){}
    }
    if(window.DTMusicTrainerLibrary && window.DTMusicTrainerLibrary.refresh){
      try{ await window.DTMusicTrainerLibrary.refresh(); }catch(error){}
    }
    window.dispatchEvent(new CustomEvent("dtmtp:materials-ready",{detail:{songId:song.id}}));
  }

  function safeName(name){
    return String(name || "file")
      .replace(/[\\/]+/g,"_")
      .replace(/[?#\[\]*]+/g,"_")
      .slice(0,180) || "file";
  }

  function assetRevision(asset){
    if(!asset) return "";
    return [
      String(asset.name || ""),
      Number(asset.size || 0),
      Number(asset.updatedAt || 0),
      String(asset.mime || "")
    ].join("|");
  }

  function assetMeta(asset,path){
    if(!asset) return null;
    return {
      name:String(asset.name || "file"),
      mime:String(asset.mime || ""),
      size:Number(asset.size || 0),
      updatedAt:Number(asset.updatedAt || 0),
      revision:assetRevision(asset),
      path
    };
  }

  function materialError(error){
    const code = String(error && error.code || "");
    if(code.includes("storage/unauthorized")){
      return new Error("Song materials are blocked by Firebase Storage rules. Publish storage.rules first.");
    }
    if(code.includes("storage/object-not-found")){
      return new Error("The teacher has not uploaded this song's materials yet.");
    }
    if(code.includes("storage/unknown") || code.includes("storage/retry-limit-exceeded")){
      return new Error("Firebase Storage is not ready. Check that Storage is enabled for the project.");
    }
    return error instanceof Error ? error : new Error("Cloud song materials are unavailable.");
  }

  async function uploadAsset(F,academyId,songId,kind,asset,existing){
    if(!asset || !asset.blob) return null;
    if(existing && existing.path && existing.revision === assetRevision(asset)) return existing;

    const path = "academies/" + academyId + "/songs/" + songId + "/" + kind + "/" + safeName(asset.name);
    const ref = F.storageRef(F.storage,path);
    const metadata = asset.mime ? {contentType:asset.mime} : undefined;
    await F.uploadBytes(ref,asset.blob,metadata);

    if(existing && existing.path && existing.path !== path){
      try{ await F.deleteObject(F.storageRef(F.storage,existing.path)); }catch(error){}
    }
    return assetMeta(asset,path);
  }

  async function publishSong(songId){
    if(!songId) return null;
    if(publishing.has(songId)) return publishing.get(songId);

    const task = (async () => {
      const F = fb();
      const s = session || currentSession();
      if(!F || !s || s.role !== "teacher" || !s.academyId) return null;

      const song = await localSong(songId);
      if(!song) return null;

      emit("syncing","Uploading " + (song.title || "song") + " materials…");

      try{
        const metaRef = F.doc(F.db,"academies",s.academyId,"songs",songId);
        const oldSnap = await F.getDoc(metaRef);
        const old = oldSnap.exists() ? oldSnap.data() : {};
        const oldAssets = old.assets || {};
        const assets = {};

        for(const kind of ["interactive","pdf","audio"]){
          if(song[kind] && song[kind].blob){
            assets[kind] = await uploadAsset(F,s.academyId,songId,kind,song[kind],oldAssets[kind] || null);
          }else{
            assets[kind] = null;
          }
        }

        await F.setDoc(metaRef,{
          id:song.id,
          title:song.title || "Untitled Song",
          createdAt:Number(song.createdAt || Date.now()),
          localUpdatedAt:Number(song.updatedAt || Date.now()),
          syncPoints:Array.isArray(song.syncPoints) ? song.syncPoints : [],
          assets,
          updatedAt:F.serverTimestamp()
        },{merge:true});

        emit("synced",(song.title || "Song") + " materials synced");
        return {songId,assets};
      }catch(error){
        console.error("Song material upload failed",error);
        const friendly = materialError(error);
        emit("error",friendly.message);
        throw friendly;
      }
    })().finally(() => publishing.delete(songId));

    publishing.set(songId,task);
    return task;
  }

  async function publishAssignedSongs(){
    const s = session || currentSession();
    if(!s || s.role !== "teacher") return;
    const ids = assignedSongIds();
    for(const id of ids){
      try{ await publishSong(id); }
      catch(error){ break; }
    }
  }

  function schedulePublishAssigned(delay){
    if(uploadTimer) clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => {
      uploadTimer = null;
      publishAssignedSongs().catch(error => console.error(error));
    },delay == null ? 350 : delay);
  }

  async function downloadAsset(F,meta){
    if(!meta || !meta.path) return null;
    const bytes = await F.getBytes(F.storageRef(F.storage,meta.path));
    const blob = new Blob([bytes],{type:meta.mime || "application/octet-stream"});
    return {
      name:meta.name || "file",
      mime:meta.mime || "",
      size:Number(meta.size || blob.size || 0),
      updatedAt:Number(meta.updatedAt || Date.now()),
      blob
    };
  }

  function sameAsset(local,remote){
    return !!(local && local.blob && remote &&
      String(local.name || "") === String(remote.name || "") &&
      Number(local.size || 0) === Number(remote.size || 0) &&
      Number(local.updatedAt || 0) === Number(remote.updatedAt || 0));
  }

  async function ensureSong(songId){
    if(!songId) throw new Error("This assignment has no song linked.");
    if(downloading.has(songId)) return downloading.get(songId);

    const task = (async () => {
      const F = fb();
      const s = session || currentSession();
      if(!F || !s || !s.academyId) throw new Error("Cloud account is still loading.");

      let local = await localSong(songId);
      const metaRef = F.doc(F.db,"academies",s.academyId,"songs",songId);
      const snap = await F.getDoc(metaRef);

      if(!snap.exists()){
        if(local && local.interactive && local.interactive.blob) return local;
        throw new Error("The teacher has not uploaded this assignment's song materials yet.");
      }

      const meta = snap.data() || {};
      const assets = meta.assets || {};
      const next = {
        id:songId,
        title:meta.title || (local && local.title) || "Untitled Song",
        createdAt:Number(meta.createdAt || (local && local.createdAt) || Date.now()),
        updatedAt:Number(meta.localUpdatedAt || Date.now()),
        syncPoints:Array.isArray(meta.syncPoints) ? meta.syncPoints : [],
        interactive:local && local.interactive ? local.interactive : null,
        pdf:local && local.pdf ? local.pdf : null,
        audio:local && local.audio ? local.audio : null
      };

      let downloaded = 0;
      emit("syncing","Downloading " + next.title + " materials…");

      for(const kind of ["interactive","pdf","audio"]){
        const remote = assets[kind] || null;
        if(!remote){
          next[kind] = null;
          continue;
        }
        if(!sameAsset(next[kind],remote)){
          next[kind] = await downloadAsset(F,remote);
          downloaded += 1;
        }
      }

      if(!next.interactive || !next.interactive.blob){
        throw new Error("This assignment has no interactive score in the cloud yet.");
      }

      await saveLocalSong(next);
      emit("synced",downloaded ? (next.title + " downloaded") : (next.title + " ready"));
      return next;
    })().catch(error => {
      console.error("Song material download failed",error);
      const friendly = materialError(error);
      emit("error",friendly.message);
      throw friendly;
    }).finally(() => downloading.delete(songId));

    downloading.set(songId,task);
    return task;
  }

  function begin(nextSession){
    session = nextSession || null;
    if(uploadTimer){ clearTimeout(uploadTimer); uploadTimer = null; }
    if(session && session.role === "teacher") schedulePublishAssigned(500);
  }

  function beginFromCurrentAuth(){
    const s = currentSession();
    if(!s || !s.academyId) return false;
    const same = session &&
      session.uid === s.uid &&
      session.role === s.role &&
      session.academyId === s.academyId &&
      session.studentId === s.studentId;
    if(!same) begin(s);
    return true;
  }

  window.addEventListener("dtmtp:auth-changed",event => begin(event.detail || null));
  window.addEventListener("dtmtp:firebase-ready",() => beginFromCurrentAuth());
  window.addEventListener("dtmtp:assignment-created",event => {
    const id = event.detail && event.detail.songId;
    if(session && session.role === "teacher" && id){
      publishSong(id).catch(error => console.error(error));
    }
  });
  window.addEventListener("dtmtp:library-changed",event => {
    const id = event.detail && event.detail.songId;
    if(session && session.role === "teacher" && id && isAssigned(id)){
      publishSong(id).catch(error => console.error(error));
    }
  });
  window.addEventListener("dtmtp:cloud-data-applied",() => {
    if(session && session.role === "teacher") schedulePublishAssigned(450);
  });

  let tries = 0;
  startupTimer = setInterval(() => {
    tries += 1;
    if(beginFromCurrentAuth() || tries >= 30){
      clearInterval(startupTimer);
      startupTimer = null;
    }
  },150);
  beginFromCurrentAuth();

  window.DTMusicTrainerSongCloud = {
    ensureSong,
    publishSong,
    publishAssignedSongs,
    getSession:() => session
  };
})();