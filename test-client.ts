import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('./firebase-applet-config.json');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(1)));
    console.log("Success! Docs:", snap.size);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
