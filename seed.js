import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';

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

async function seed() {
  try {
    const creds = await signInWithEmailAndPassword(auth, 'docente@test.com', 'Test1234!');
    const uid = creds.user.uid;
    console.log('Autenticato con UID:', uid);
    
    const classi = [
      { nome: 'Grafica Pubblicitaria I', anno: '2023/2024' },
      { nome: 'Grafica Editoriale II', anno: '2024/2025' },
      { nome: 'Fotografia Base', anno: '2024/2025' },
      { nome: 'Fotografia Avanzata', anno: '2025/2026' },
      { nome: 'Web Design Frontend', anno: '2024/2025' },
      { nome: 'Web Development Fullstack', anno: '2024/2025' }
    ];

    const cognomi = ['Rossi', 'Bianchi', 'Verdi', 'Neri', 'Gialli', 'Marrone', 'Blu', 'Viola', 'Esposito', 'Russo', 'Romano', 'Ferrari', 'Gallo'];
    const nomi = ['Mario', 'Luigi', 'Anna', 'Laura', 'Giuseppe', 'Francesca', 'Antonio', 'Elena', 'Marco', 'Andrea', 'Chiara', 'Sofia', 'Matteo'];

    const datePresenze = ['2024-05-01', '2024-05-08', '2024-05-15', '2024-05-22'];

    for (const c of classi) {
      console.log('=> Creazione classe:', c.nome);
      const clRef = await addDoc(collection(db, 'users', uid, 'classi'), {
        nome_corso: c.nome,
        anno_accademico: c.anno,
        archiviata: false,
        createdAt: serverTimestamp()
      });

      // Creiamo 5-10 studenti per classe
      const numStudenti = 8 + Math.floor(Math.random() * 7); // da 8 a 14
      const studentiClasse = [];
      for(let i=0; i<numStudenti; i++) {
        const nome = nomi[Math.floor(Math.random() * nomi.length)];
        const cognome = cognomi[Math.floor(Math.random() * cognomi.length)];
        const sRef = await addDoc(collection(db, 'users', uid, 'classi', clRef.id, 'studenti'), {
          nome, 
          cognome, 
          email: `${nome.toLowerCase()}.${cognome.toLowerCase()}${Math.floor(Math.random()*100)}@example.com`, 
          createdAt: serverTimestamp()
        });
        studentiClasse.push({ id: sRef.id });
      }
      console.log(`  - Creati ${numStudenti} studenti.`);

      // Creiamo 2 esercitazioni per classe
      for(let i=1; i<=2; i++) {
        const eRef = await addDoc(collection(db, 'users', uid, 'classi', clRef.id, 'esercitazioni'), {
          titolo: `Progetto ${i} - ${c.nome}`,
          descrizione: 'Consegna progetto pratico di fine modulo.',
          data_scadenza: `2024-06-0${i}`,
          createdAt: serverTimestamp()
        });

        // Voti per gli studenti
        for (const s of studentiClasse) {
          // 80% di probabilità di aver consegnato
          if (Math.random() > 0.2) {
            const voto = 18 + Math.floor(Math.random() * 13); // 18 a 30
            const lode = voto === 30 && Math.random() > 0.8;
            await setDoc(doc(db, 'users', uid, 'classi', clRef.id, 'esercitazioni', eRef.id, 'consegne', s.id), {
              studenteId: s.id,
              voto,
              lode,
              feedback: voto > 26 ? 'Ottimo lavoro, complimenti!' : (voto < 22 ? 'Da migliorare, attenzione ai dettagli.' : 'Discreto, ma puoi fare di più.'),
              file_url: null,
              file_name: null
            });
          }
        }
      }
      console.log('  - Create 2 esercitazioni con valutazioni casuali.');

      // Presenze (per le 4 date)
      for (const data of datePresenze) {
        for (const s of studentiClasse) {
          const stato = Math.random() > 0.25 ? 'Presente' : 'Assente'; // 75% presenza
          await setDoc(doc(db, 'users', uid, 'classi', clRef.id, 'presenze', `${s.id}_${data}`), {
            studenteId: s.id,
            data,
            stato
          });
        }
      }
      console.log('  - Create 4 giornate di presenze.');
    }

    console.log('✅ Seed completato con successo!');
    process.exit(0);
  } catch (err) {
    console.error('Errore durante il seed:', err);
    process.exit(1);
  }
}

seed();
