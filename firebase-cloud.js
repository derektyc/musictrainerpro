import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBroqJWHdMCAaIsmudAyN4cMBzs-EkQBSc",
  authDomain: "dt-music-trainer.firebaseapp.com",
  projectId: "dt-music-trainer",
  storageBucket: "dt-music-trainer.firebasestorage.app",
  messagingSenderId: "983129975843",
  appId: "1:983129975843:web:5c96b574b3ccb844f1596",
  measurementId: "G-NDEPL8TV36"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

try {
  await setPersistence(auth, browserLocalPersistence);
} catch (error) {
  console.warn("Firebase auth persistence could not be set", error);
}

async function createSecondaryUser(email, password, displayName) {
  const name = "dtmtp-secondary-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const secondaryApp = initializeApp(firebaseConfig, name);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    if (displayName) await updateProfile(credential.user, { displayName });
    const result = {
      uid: credential.user.uid,
      email: credential.user.email || email,
      displayName: credential.user.displayName || displayName || ""
    };
    await signOut(secondaryAuth);
    return result;
  } finally {
    try { await deleteApp(secondaryApp); } catch (error) {}
  }
}

window.DTMTPFirebase = {
  firebaseConfig,
  app,
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  createSecondaryUser,
  doc,
  collection,
  query,
  where,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp
};

window.dispatchEvent(new CustomEvent("dtmtp:firebase-ready", {
  detail: { projectId: firebaseConfig.projectId }
}));
