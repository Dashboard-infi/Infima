const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'sante.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, nom, prenom, email FROM infirmiers', (err, rows) => {
  if (err) {
    console.error('Erreur:', err);
  } else {
    console.log('=== Comptes infirmiers ===');
    console.table(rows);
  }
  db.close();
});
