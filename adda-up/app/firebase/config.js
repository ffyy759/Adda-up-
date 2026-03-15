import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBNSG_zB8B8Kk95dULbwJrLfttBnmlSmx4",
  authDomain: "turf-war-up.firebaseapp.com",
  projectId: "turf-war-up",
  storageBucket: "turf-war-up.firebasestorage.app",
  messagingSenderId: "217607192791",
  appId: "1:217607192791:web:bd1c28ac4ccd484bfc7092"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
