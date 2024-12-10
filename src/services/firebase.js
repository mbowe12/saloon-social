import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// for development, we'll use the hardcoded values
// in production, these values are set in the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAGLZyU0Ke4DPuzetUjj23cwHtqD97dg2Y",
  authDomain: "saloon-social-xyz.firebaseapp.com",
  projectId: "saloon-social-xyz",
  storageBucket: "saloon-social-xyz.firebasestorage.app",
  messagingSenderId: "764507844675",
  appId: "1:764507844675:web:96957c8ac48b37d15964f6",
};

// initialize firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
