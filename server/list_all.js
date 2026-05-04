const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'sante.db');
const db = new sqlite3.Database(dbPath);

console.log('=== Comptes infirmiers ===');
db.all('SELECT id, nom, prenom, email FROM infirmiers', (err, rows) => {
  if (err) console.error('Erreur:', err);
  else console.table(rows);
  
  console.log('\n=== Patients ===');
  db.all('SELECT id, nom, prenom, infirmier_id FROM patients', (err, rows) => {
    if (err) console.error('Erreur:', err);
    else console.table(rows);
    
    console.log('\n=== Diagrammes ===');
    db.all('SELECT id, patient_nom, patient_prenom, infirmier_id FROM diagrammes', (err, rows) => {
      if (err) console.error('Erreur:', err);
      else console.table(rows);
      
      db.close();
    });
  });
});
