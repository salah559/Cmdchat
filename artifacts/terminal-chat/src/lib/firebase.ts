import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD06ZbZiGfVQReCCWygYF3OfTL_6DZI1Hk",
  authDomain: "chat-6d518.firebaseapp.com",
  projectId: "chat-6d518",
  storageBucket: "chat-6d518.firebasestorage.app",
  messagingSenderId: "943754246124",
  appId: "1:943754246124:web:371d4aa3224d6271de72c9",
  measurementId: "G-FN32E3LQW7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
