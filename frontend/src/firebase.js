import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCaR15bxSq33CYq1H18eMeIVseYx58ZdnI",
  authDomain: "ai-studio-494013.firebaseapp.com",
  projectId: "ai-studio-494013",
  storageBucket: "ai-studio-494013.firebasestorage.app",
  messagingSenderId: "860812793045",
  appId: "1:860812793045:web:239a2294d711e881ecbe5c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, 'mindbuddy');
export const storage = getStorage(app);

// Enable Firestore offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: Multiple tabs open. Only one tab can use offline persistence at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence failed: Browser does not support IndexedDB persistence.');
  }
});
