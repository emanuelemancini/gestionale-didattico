import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCRYWFXu2gkjxV3CoriWjQmDBMEqE0b12c",
  authDomain: "gestionale-didattico.firebaseapp.com",
  projectId: "gestionale-didattico",
  storageBucket: "gestionale-didattico.firebasestorage.app",
  messagingSenderId: "315542227028",
  appId: "1:315542227028:web:069c2287ad83e854a1c5c1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function reset() {
  try {
    const creds = await signInWithEmailAndPassword(auth, 'docente@test.com', 'Test1234!');
    const uid = creds.user.uid;
    console.log('Resetting DB per UID:', uid);
    
    const classiSnap = await getDocs(collection(db, 'users', uid, 'classi'));
    for (const c of classiSnap.docs) {
      // eliminiamo sotto-collezioni: studenti, presenze, esercitazioni
      const sSnap = await getDocs(collection(db, 'users', uid, 'classi', c.id, 'studenti'));
      for (const s of sSnap.docs) await deleteDoc(doc(db, 'users', uid, 'classi', c.id, 'studenti', s.id));
      
      const pSnap = await getDocs(collection(db, 'users', uid, 'classi', c.id, 'presenze'));
      for (const p of pSnap.docs) await deleteDoc(doc(db, 'users', uid, 'classi', c.id, 'presenze', p.id));
      
      const eSnap = await getDocs(collection(db, 'users', uid, 'classi', c.id, 'esercitazioni'));
      for (const e of eSnap.docs) {
        const consSnap = await getDocs(collection(db, 'users', uid, 'classi', c.id, 'esercitazioni', e.id, 'consegne'));
        for (const cons of consSnap.docs) await deleteDoc(doc(db, 'users', uid, 'classi', c.id, 'esercitazioni', e.id, 'consegne', cons.id));
        await deleteDoc(doc(db, 'users', uid, 'classi', c.id, 'esercitazioni', e.id));
      }
      
      await deleteDoc(doc(db, 'users', uid, 'classi', c.id));
    }

    const mailSnap = await getDocs(collection(db, 'users', uid, 'mailing'));
    for (const m of mailSnap.docs) await deleteDoc(doc(db, 'users', uid, 'mailing', m.id));

    console.log('Reset completato.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

reset();
