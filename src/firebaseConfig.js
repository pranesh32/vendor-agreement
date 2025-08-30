// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAkqbNdfTQaDhSxOh-RJ7_91XlE7Ofjf2Q",
  authDomain: "vendor-agreement.firebaseapp.com",
  projectId: "vendor-agreement",
  storageBucket: "vendor-agreement.firebasestorage.app",
  messagingSenderId: "891210650798",
  appId: "1:891210650798:web:b29761a13ea6e9bb5ac93f",
  measurementId: "G-31G9H9051G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;