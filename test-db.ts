import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('./firebase-applet-config.json');

const firebaseApp = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: firebaseConfig.projectId
});
const db = getFirestore(firebaseApp, 'ai-studio-7a06f2c8-ce2f-4f73-8ca2-747b9005709b');

async function test() {
  try {
    const snap = await db.collection('users').limit(1).get();
    console.log("Success! Docs:", snap.size);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
