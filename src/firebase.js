import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAAFAI5fWhp419BBo3mvwzJGVi6KSIFDL4",
  authDomain: "kinetixfsl-73d88.firebaseapp.com",
  databaseURL: "https://kinetixfsl-73d88-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kinetixfsl-73d88",
  storageBucket: "kinetixfsl-73d88.firebasestorage.app",
  messagingSenderId: "173560349034",
  appId: "1:173560349034:web:2dac584820bf06dcfbe513",
  measurementId: "G-L61MH8BHEH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);