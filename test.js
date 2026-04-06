const admin = require('firebase-admin');
const firebaseConfig = require('./firebase-applet-config.json');
const app = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: firebaseConfig.projectId
});
const db = admin.firestore(app);
db.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
console.log(db._settings);
