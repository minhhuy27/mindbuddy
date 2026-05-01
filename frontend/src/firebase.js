import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCaR15bxSq33CYq1H18eMeIVseYx58ZdnI",
  authDomain: "ai-studio-494013.firebaseapp.com",
  projectId: "ai-studio-494013",
  storageBucket: "ai-studio-494013.firebasestorage.app",
  messagingSenderId: "860812793045",
  appId: "1:860812793045:web:239a2294d711e881ecbe5c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, 'mindbuddy');
console.log('Firebase project:', firebaseConfig.projectId);
console.log('Firestore:', db);
