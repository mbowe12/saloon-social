const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  doc,
  getDocs,
  deleteDoc,
} = require("firebase/firestore");

// load environment variables from .env file
require("dotenv").config();

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "saloon-social-xyz.firebaseapp.com",
  projectId: "saloon-social-xyz",
  storageBucket: "saloon-social-xyz.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearCoins(roomId) {
  console.log("Clearing coins from room:", roomId);
  const stateRef = doc(db, "rooms", roomId, "state", "coins");
  try {
    await deleteDoc(stateRef);
    console.log("Coins cleared!");
  } catch (error) {
    console.error("Error clearing coins:", error);
  }
}

// get room ID from command line argument or use default
const roomId = process.argv[2] || "test-room";
clearCoins(roomId).catch(console.error);
