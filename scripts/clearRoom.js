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

async function clearRoom(roomId) {
  console.log("Clearing room:", roomId);
  const playersRef = collection(doc(db, "rooms", roomId), "players");
  const snapshot = await getDocs(playersRef);
  const deletePromises = [];

  snapshot.forEach((doc) => {
    console.log("Deleting player:", doc.id);
    deletePromises.push(deleteDoc(doc.ref));
  });

  await Promise.all(deletePromises);
  console.log("Room cleared!");
}

// get room ID from command line argument or use default
const roomId = process.argv[2] || "test-room";
clearRoom(roomId).catch(console.error);
