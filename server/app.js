require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const sharp   = require('sharp');
const cron    = require('node-cron');

const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'https://sante-libeplus.netlify.app'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// Config multer — stockage temporaire en mémoire pour compression
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    // BUG FIX: Filtrer les types MIME acceptés
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé. Utilisez JPEG, PNG ou WebP.'));
        }
    },
});

// ========== COMPRESSION PIPELINE ==========
async function compressAndSave(buffer, patientId, patientNom, description) {
    const patientDir = path.join(__dirname, 'uploads', 'patients', String(patientId));
    if (!fs.existsSync(patientDir)) fs.mkdirSync(patientDir, { recursive: true });

    const dateStr  = new Date().toISOString().split('T')[0];
    const safeName = (patientNom  || 'patient').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDesc = (description || 'soin').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const filename = `${safeName}_${dateStr}_${safeDesc}_${Date.now()}.webp`;
    const filepath = path.join(patientDir, filename);

    await sharp(buffer)
        .rotate()
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(filepath);

    const stats = fs.statSync(filepath);
    const url   = `/uploads/patients/${patientId}/${filename}`;
    return { url, filename, taille_octets: stats.size };
}

// ========== BASE DE DONNÉES ==========
const dbPath = path.join(__dirname, 'sante.db');
const db = new sqlite3.Database(dbPath);

// Wrapper pour simuler l'API async de MySQL
const dbAsync = {
    query: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve([rows]);
            });
        });
    },
    execute: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve([{ insertId: this.lastID }]);
            });
        });
    }
};

// ========== HELPER ACCÈS PATIENT ==========
// Retourne le patient si l'utilisateur y a accès (propriétaire OU partage mutuel activé), sinon null
async function canAccessPatient(userId, patientId) {
    const [rows] = await dbAsync.query(`
        SELECT p.* FROM patients p
        JOIN infirmiers i   ON p.infirmier_id = i.id
        JOIN infirmiers me  ON me.id = ?
        WHERE p.id = ?
          AND p.deleted_at IS NULL
          AND (
            p.infirmier_id = ?
            OR (i.fiche_shared = 1 AND me.fiche_shared = 1)
          )
    `, [userId, patientId, userId]);
    return rows.length > 0 ? rows[0] : null;
}

// Retourne true si l'utilisateur est propriétaire du patient
async function ownsPatient(userId, patientId) {
    const [rows] = await dbAsync.query(
        'SELECT id FROM patients WHERE id = ? AND infirmier_id = ? AND deleted_at IS NULL',
        [patientId, userId]
    );
    return rows.length > 0;
}

// Initialisation des tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS infirmiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        mot_de_passe TEXT NOT NULL,
        telephone TEXT,
        adresse TEXT,
        ville TEXT,
        code_postal TEXT,
        couleur TEXT,
        photo_url TEXT,
        fiche_shared INTEGER DEFAULT 0
    )`);

    // Migration: ajouter la colonne fiche_shared si elle n'existe pas
    db.run(`ALTER TABLE infirmiers ADD COLUMN fiche_shared INTEGER DEFAULT 0`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        date_naissance TEXT,
        adresse TEXT,
        ville TEXT,
        code_postal TEXT,
        telephone TEXT,
        email TEXT,
        medecin_traitant TEXT,
        numero_secu TEXT,
        notes TEXT,
        allergies TEXT,
        medicaments TEXT,
        infirmier_id INTEGER NOT NULL,
        deleted_at TEXT,
        delete_reason TEXT,
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
    )`);
    // Migration: ajouter les colonnes si elles n'existent pas encore
    db.run(`ALTER TABLE patients ADD COLUMN allergies TEXT`, () => {});
    db.run(`ALTER TABLE patients ADD COLUMN medicaments TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        infirmier_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        filename TEXT NOT NULL,
        description TEXT,
        taille_octets INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vitaux (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        infirmier_id INTEGER NOT NULL,
        tension TEXT,
        saturation INTEGER,
        pouls INTEGER,
        glycemie REAL,
        temperature REAL,
        eva INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS agenda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        infirmier_id INTEGER NOT NULL,
        patient_id INTEGER,
        date_rdv TEXT NOT NULL,
        type_soin TEXT,
        duree_minutes INTEGER DEFAULT 30,
        notes TEXT,
        statut TEXT DEFAULT 'planifie',
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id),
        FOREIGN KEY (patient_id) REFERENCES patients(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expediteur_id INTEGER NOT NULL,
        destinataire_id INTEGER NOT NULL,
        objet TEXT,
        contenu TEXT NOT NULL,
        lu INTEGER DEFAULT 0,
        lu_le TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (expediteur_id) REFERENCES infirmiers(id),
        FOREIGN KEY (destinataire_id) REFERENCES infirmiers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        infirmier_id INTEGER NOT NULL,
        titre TEXT NOT NULL,
        message TEXT NOT NULL,
        icone TEXT,
        lien TEXT,
        lu INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS diagrammes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        patient_nom TEXT NOT NULL,
        patient_prenom TEXT NOT NULL,
        medecin TEXT,
        type_soin TEXT NOT NULL,
        mois INTEGER NOT NULL,
        annee INTEGER NOT NULL,
        notes TEXT,
        signe_le TEXT,
        signature_data TEXT,
        infirmier_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS diagramme_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        diagramme_id INTEGER NOT NULL,
        jour TEXT NOT NULL,
        matin INTEGER DEFAULT 0,
        midi INTEGER DEFAULT 0,
        soir INTEGER DEFAULT 0,
        legendes TEXT,
        FOREIGN KEY (diagramme_id) REFERENCES diagrammes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS legendes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        couleur TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tournees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date_tournee TEXT NOT NULL,
        ville_depart TEXT,
        adresse_depart TEXT,
        km_total REAL DEFAULT 0,
        infirmier_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tournee_etapes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournee_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        patient_nom TEXT NOT NULL,
        patient_prenom TEXT NOT NULL,
        adresse TEXT,
        ville TEXT,
        ordre INTEGER NOT NULL,
        statut TEXT DEFAULT 'a_venir',
        distance_km REAL DEFAULT 0,
        FOREIGN KEY (tournee_id) REFERENCES tournees(id),
        FOREIGN KEY (patient_id) REFERENCES patients(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS planning (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        infirmier_id INTEGER NOT NULL,
        date_debut TEXT NOT NULL,
        date_fin TEXT NOT NULL,
        type_event TEXT DEFAULT 'travail',
        titre TEXT,
        description TEXT,
        couleur TEXT DEFAULT '#0C2D4E',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS km (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        infirmier_id INTEGER NOT NULL,
        total_km REAL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
    )`);
});

// BUG FIX: JWT_SECRET doit être défini en production — lever une erreur si absent
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: JWT_SECRET non défini en production. Arrêt.');
        process.exit(1);
    } else {
        console.warn('AVERTISSEMENT: JWT_SECRET non défini. Utilisation d\'une valeur par défaut NON SÉCURISÉE pour le développement.');
    }
}
const JWT_SECRET_EFFECTIVE = JWT_SECRET || 'dev_secret_insecure_do_not_use_in_prod';

// BUG FIX: JWT expiresIn augmenté à 7j avec refresh implicite
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ========== VERSION CONTROL ==========
const MINIMUM_REQUIRED_VERSION = process.env.MINIMUM_REQUIRED_VERSION || '1.0.0';
const CURRENT_SERVER_VERSION   = process.env.CURRENT_SERVER_VERSION   || '1.0.0';

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

function checkClientVersion(req, res, next) {
    const clientVersion = req.headers['x-app-version'];
    if (!clientVersion) return next();
    if (compareVersions(clientVersion, MINIMUM_REQUIRED_VERSION) < 0) {
        return res.status(426).json({
            error:           'update_required',
            message:         'Version obsolète. Mise à jour obligatoire.',
            minimum_version: MINIMUM_REQUIRED_VERSION,
            current_version: CURRENT_SERVER_VERSION,
        });
    }
    next();
}

app.use(checkClientVersion);

// Endpoint version publique
app.get('/api/version', (req, res) => {
    res.json({
        current_version:         CURRENT_SERVER_VERSION,
        minimum_required_version: MINIMUM_REQUIRED_VERSION,
    });
});

// ========== MIDDLEWARE AUTH ==========
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET_EFFECTIVE, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// ========== AUTH ==========
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nom, prenom, email, mot_de_passe, telephone, adresse, ville, code_postal } = req.body;

        // BUG FIX: Validation du mot de passe côté serveur
        if (!mot_de_passe || mot_de_passe.length < 8) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
        }
        if (!email || !nom || !prenom) {
            return res.status(400).json({ error: 'Nom, prénom et email sont obligatoires.' });
        }

        // BUG FIX: Vérifier si l'email est déjà utilisé avant insertion
        const [existing] = await dbAsync.query('SELECT id FROM infirmiers WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });
        }

        const hashedPassword = await bcrypt.hash(mot_de_passe, 12); // BUG FIX: bcrypt rounds augmenté à 12
        const [result] = await dbAsync.execute(
            'INSERT INTO infirmiers (nom, prenom, email, mot_de_passe, telephone, adresse, ville, code_postal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [nom, prenom, email, hashedPassword, telephone, adresse, ville, code_postal]
        );
        res.status(201).json({ message: 'Compte infirmier créé avec succès', id: result.insertId });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Erreur lors de la création du compte.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, mot_de_passe } = req.body;

        // BUG FIX: Validation d'entrée
        if (!email || !mot_de_passe) {
            return res.status(400).json({ error: 'Email et mot de passe requis.' });
        }

        const [users] = await dbAsync.query('SELECT * FROM infirmiers WHERE email = ?', [email]);
        // BUG FIX: Délai constant pour éviter timing attacks (même si utilisateur inexistant)
        const user = users[0];
        const isValid = user
            ? await bcrypt.compare(mot_de_passe, user.mot_de_passe)
            : await bcrypt.compare(mot_de_passe, '$2b$12$invalidhashpaddingtoconstanttime'); // dummy compare

        if (!user || !isValid) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET_EFFECTIVE,
            { expiresIn: JWT_EXPIRES }
        );
        res.json({ token, user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Erreur de connexion.' });
    }
});

// ========== PROFIL ==========
app.get('/api/profil', authenticateToken, async (req, res) => {
    try {
        const [users] = await dbAsync.query(
            'SELECT id, nom, prenom, email, telephone, adresse, ville, code_postal, couleur, photo_url, fiche_shared FROM infirmiers WHERE id = ?',
            [req.user.id]
        );
        if (users.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/profil', authenticateToken, async (req, res) => {
    try {
        const { nom, prenom, telephone, adresse, ville, code_postal, couleur, fiche_shared } = req.body;
        await dbAsync.execute(
            'UPDATE infirmiers SET nom=?, prenom=?, telephone=?, adresse=?, ville=?, code_postal=?, couleur=?, fiche_shared=? WHERE id=?',
            [nom, prenom, telephone, adresse, ville, code_postal, couleur, fiche_shared ? 1 : 0, req.user.id]
        );
        res.json({ message: 'Profil mis à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PATIENTS ==========
app.get('/api/patients', authenticateToken, async (req, res) => {
    try {
        // Check if user has fiche_shared enabled
        const [user] = await dbAsync.query('SELECT fiche_shared FROM infirmiers WHERE id = ?', [req.user.id]);
        const shared = user.length > 0 && user[0].fiche_shared === 1;

        let rows;
        if (shared) {
            // Si l'utilisateur connecté a le partage activé :
            // Afficher ses propres patients + les patients de tous les infirmiers qui ont aussi le partage activé
            rows = await dbAsync.query(`
                SELECT p.* FROM patients p
                JOIN infirmiers i ON p.infirmier_id = i.id
                WHERE (p.infirmier_id = ? OR i.fiche_shared = 1) AND p.deleted_at IS NULL
                ORDER BY p.nom
            `, [req.user.id]);
        } else {
            // Show only own patients
            rows = await dbAsync.query(
                'SELECT * FROM patients WHERE infirmier_id = ? AND deleted_at IS NULL ORDER BY nom',
                [req.user.id]
            );
        }
        res.json(rows[0] || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const [user] = await dbAsync.query('SELECT fiche_shared FROM infirmiers WHERE id = ?', [req.user.id]);
        const shared = user.length > 0 && user[0].fiche_shared === 1;

        let rows;
        if (shared) {
            [rows] = await dbAsync.query(`
                SELECT p.* FROM patients p
                JOIN infirmiers i ON p.infirmier_id = i.id
                WHERE p.id = ? AND (p.infirmier_id = ? OR i.fiche_shared = 1) AND p.deleted_at IS NULL
            `, [req.params.id, req.user.id]);
        } else {
            [rows] = await dbAsync.query(
                'SELECT * FROM patients WHERE id = ? AND infirmier_id = ? AND deleted_at IS NULL',
                [req.params.id, req.user.id]
            );
        }
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Patient non trouvé' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
    try {
        const { nom, prenom, date_naissance, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, allergies, medicaments } = req.body;
        if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom obligatoires' });
        const [result] = await dbAsync.execute(
            'INSERT INTO patients (nom, prenom, date_naissance, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, allergies, medicaments, infirmier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nom, prenom, date_naissance || null, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, allergies || null, medicaments || null, req.user.id]
        );
        res.status(201).json({ id: result.insertId, message: 'Patient créé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { nom, prenom, date_naissance, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, allergies, medicaments } = req.body;
        // FIX: autoriser la modification si l'utilisateur est propriétaire OU a un accès partagé
        const patient = await canAccessPatient(req.user.id, req.params.id);
        if (!patient) return res.status(404).json({ error: 'Patient non trouvé ou accès non autorisé' });
        await dbAsync.execute(
            'UPDATE patients SET nom=?, prenom=?, date_naissance=?, adresse=?, ville=?, code_postal=?, telephone=?, email=?, medecin_traitant=?, numero_secu=?, notes=?, allergies=?, medicaments=? WHERE id=?',
            [nom, prenom, date_naissance || null, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, allergies || null, medicaments || null, req.params.id]
        );
        res.json({ message: 'Patient mis à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { reason } = req.body;
        // Vérifier que le patient existe et appartient à cet infirmier (seul le propriétaire peut supprimer)
        const [rows] = await dbAsync.query('SELECT id FROM patients WHERE id = ? AND infirmier_id = ? AND deleted_at IS NULL', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Patient non trouvé ou vous n\'êtes pas le propriétaire de ce patient' });
        await dbAsync.execute(
            "UPDATE patients SET deleted_at = datetime('now'), delete_reason = ? WHERE id = ?",
            [reason || 'autre', req.params.id]
        );
        res.json({ message: 'Patient archivé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PHOTOS ==========
app.post('/api/patients/:id/photos', authenticateToken, upload.single('photo'), async (req, res) => {
    try {
        // FIX: autoriser l'upload si l'utilisateur a accès au patient (propriétaire ou partage)
        const patient = await canAccessPatient(req.user.id, req.params.id);
        if (!patient) return res.status(404).json({ error: 'Patient non trouvé ou accès non autorisé' });
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

        const { url, filename, taille_octets } = await compressAndSave(
            req.file.buffer, req.params.id, patient.nom, req.body.description
        );

        const [result] = await dbAsync.execute(
            'INSERT INTO photos (patient_id, infirmier_id, url, filename, description, taille_octets) VALUES (?, ?, ?, ?, ?, ?)',
            [req.params.id, req.user.id, url, filename, req.body.description || '', taille_octets]
        );
        res.status(201).json({ id: result.insertId, url, message: 'Photo uploadée' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/patients/:id/photos', authenticateToken, async (req, res) => {
    try {
        // FIX: vérifier l'accès au patient, puis retourner TOUTES les photos (toutes infirmières)
        const patient = await canAccessPatient(req.user.id, req.params.id);
        if (!patient) return res.status(404).json({ error: 'Patient non trouvé ou accès non autorisé' });

        const [rows] = await dbAsync.query(
            `SELECT ph.*, i.nom as infirmier_nom, i.prenom as infirmier_prenom
             FROM photos ph
             JOIN infirmiers i ON ph.infirmier_id = i.id
             WHERE ph.patient_id = ?
             ORDER BY ph.created_at DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query('SELECT * FROM photos WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Photo non trouvée' });
        const photo = rows[0];
        const filepath = path.join(__dirname, photo.url);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        await dbAsync.execute('DELETE FROM photos WHERE id = ?', [req.params.id]);
        res.json({ message: 'Photo supprimée' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/photos/:id/download', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query('SELECT * FROM photos WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Photo non trouvée' });
        const photo = rows[0];
        const filepath = path.join(__dirname, photo.url);
        if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Fichier introuvable' });
        res.download(filepath, photo.filename);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== VITAUX ==========
app.get('/api/patients/:id/vitaux', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query(
            'SELECT * FROM vitaux WHERE patient_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients/:id/vitaux', authenticateToken, async (req, res) => {
    try {
        const { tension, saturation, pouls, glycemie, temperature, eva, notes } = req.body;
        const [result] = await dbAsync.execute(
            'INSERT INTO vitaux (patient_id, infirmier_id, tension, saturation, pouls, glycemie, temperature, eva, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [req.params.id, req.user.id, tension, saturation, pouls, glycemie, temperature, eva, notes]
        );
        res.status(201).json({ id: result.insertId, message: 'Vitaux enregistrés' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== AGENDA ==========
app.get('/api/agenda', authenticateToken, async (req, res) => {
    try {
        const { date } = req.query;
        let query = 'SELECT a.*, p.nom as patient_nom, p.prenom as patient_prenom FROM agenda a LEFT JOIN patients p ON a.patient_id = p.id WHERE a.infirmier_id = ?';
        const params = [req.user.id];
        if (date) {
            query += ' AND DATE(a.date_rdv) = ?';
            params.push(date);
        }
        query += ' ORDER BY a.date_rdv';
        const [rows] = await dbAsync.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/agenda', authenticateToken, async (req, res) => {
    try {
        const { patient_id, date_rdv, type_soin, duree_minutes, notes } = req.body;
        if (!patient_id || !date_rdv) return res.status(400).json({ error: 'Patient et date obligatoires' });
        const [result] = await dbAsync.execute(
            'INSERT INTO agenda (infirmier_id, patient_id, date_rdv, type_soin, duree_minutes, notes, statut) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, patient_id, date_rdv, type_soin, duree_minutes || 30, notes, 'planifie']
        );
        res.status(201).json({ id: result.insertId, message: 'Rendez-vous créé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/agenda/:id', authenticateToken, async (req, res) => {
    try {
        const { patient_id, date_rdv, type_soin, duree_minutes, notes, statut } = req.body;
        const [rows] = await dbAsync.query('SELECT id FROM agenda WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
        await dbAsync.execute(
            'UPDATE agenda SET patient_id=?, date_rdv=?, type_soin=?, duree_minutes=?, notes=?, statut=? WHERE id=?',
            [patient_id, date_rdv, type_soin, duree_minutes, notes, statut, req.params.id]
        );
        res.json({ message: 'Rendez-vous mis à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/agenda/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query('SELECT id FROM agenda WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
        await dbAsync.execute('DELETE FROM agenda WHERE id = ?', [req.params.id]);
        res.json({ message: 'Rendez-vous supprimé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== MESSAGES ==========
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const [received] = await dbAsync.query(
            'SELECT m.*, i.nom as exp_nom, i.prenom as exp_prenom FROM messages m JOIN infirmiers i ON m.expediteur_id = i.id WHERE m.destinataire_id = ? ORDER BY m.created_at DESC',
            [req.user.id]
        );
        const [sent] = await dbAsync.query(
            'SELECT m.*, i.nom as dest_nom, i.prenom as dest_prenom FROM messages m JOIN infirmiers i ON m.destinataire_id = i.id WHERE m.expediteur_id = ? ORDER BY m.created_at DESC',
            [req.user.id]
        );
        const unread_count = received.filter(m => !m.lu).length;
        res.json({ received, sent, unread_count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { destinataire_id, objet, contenu } = req.body;
        if (!destinataire_id || !contenu) return res.status(400).json({ error: 'Destinataire et contenu obligatoires' });
        const [result] = await dbAsync.execute(
            'INSERT INTO messages (expediteur_id, destinataire_id, objet, contenu) VALUES (?, ?, ?, ?)',
            [req.user.id, destinataire_id, objet || '', contenu]
        );
        res.status(201).json({ id: result.insertId, message: 'Message envoyé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/messages/:id/lire', authenticateToken, async (req, res) => {
    try {
        await dbAsync.execute(
            'UPDATE messages SET lu = 1, lu_le = datetime("now") WHERE id = ? AND destinataire_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Message marqué comme lu' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/messages/unread-count', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query(
            'SELECT COUNT(*) as count FROM messages WHERE destinataire_id = ? AND lu = 0',
            [req.user.id]
        );
        res.json({ count: rows[0].count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== INFIRMIERS ==========
app.get('/api/infirmiers', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query(
            'SELECT id, nom, prenom, email FROM infirmiers WHERE id != ? ORDER BY nom',
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== NOTIFICATIONS ==========
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const [notifications] = await dbAsync.query(
            'SELECT * FROM notifications WHERE infirmier_id = ? ORDER BY created_at DESC LIMIT 30',
            [req.user.id]
        );
        const unread_count = notifications.filter(n => !n.lu).length;
        res.json({ notifications, unread_count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/:id/lire', authenticateToken, async (req, res) => {
    try {
        await dbAsync.execute('UPDATE notifications SET lu = 1 WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Notification marquée comme lue' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/lire-tout', authenticateToken, async (req, res) => {
    try {
        await dbAsync.execute('UPDATE notifications SET lu = 1 WHERE infirmier_id = ?', [req.user.id]);
        res.json({ message: 'Toutes les notifications marquées comme lues' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== DIAGRAMMES ==========
app.get('/api/diagrammes', authenticateToken, async (req, res) => {
    try {
        // FIX: inclure les diagrammes des patients partagés
        const [user] = await dbAsync.query('SELECT fiche_shared FROM infirmiers WHERE id = ?', [req.user.id]);
        const shared = user.length > 0 && user[0].fiche_shared === 1;

        let rows;
        if (shared) {
            [rows] = await dbAsync.query(`
                SELECT d.*, p.nom as patient_nom, p.prenom as patient_prenom
                FROM diagrammes d
                JOIN patients p   ON d.patient_id = p.id
                JOIN infirmiers i ON p.infirmier_id = i.id
                WHERE (d.infirmier_id = ? OR i.fiche_shared = 1)
                ORDER BY d.created_at DESC
            `, [req.user.id]);
        } else {
            [rows] = await dbAsync.query(
                'SELECT d.*, p.nom as patient_nom, p.prenom as patient_prenom FROM diagrammes d JOIN patients p ON d.patient_id = p.id WHERE d.infirmier_id = ? ORDER BY d.created_at DESC',
                [req.user.id]
            );
        }
        for (const d of rows) {
            const [cases] = await dbAsync.query('SELECT * FROM diagramme_cases WHERE diagramme_id = ? ORDER BY jour', [d.id]);
            d.cases = cases;
        }
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/diagrammes/:id', authenticateToken, async (req, res) => {
    try {
        // FIX: accès partagé aux diagrammes
        const [user] = await dbAsync.query('SELECT fiche_shared FROM infirmiers WHERE id = ?', [req.user.id]);
        const shared = user.length > 0 && user[0].fiche_shared === 1;

        let rows;
        if (shared) {
            [rows] = await dbAsync.query(`
                SELECT d.*, p.nom as patient_nom, p.prenom as patient_prenom
                FROM diagrammes d
                JOIN patients p   ON d.patient_id = p.id
                JOIN infirmiers i ON p.infirmier_id = i.id
                WHERE d.id = ? AND (d.infirmier_id = ? OR i.fiche_shared = 1)
            `, [req.params.id, req.user.id]);
        } else {
            [rows] = await dbAsync.query(
                'SELECT d.*, p.nom as patient_nom, p.prenom as patient_prenom FROM diagrammes d JOIN patients p ON d.patient_id = p.id WHERE d.id = ? AND d.infirmier_id = ?',
                [req.params.id, req.user.id]
            );
        }
        if (rows.length === 0) return res.status(404).json({ error: 'Diagramme non trouvé' });
        const [cases] = await dbAsync.query('SELECT * FROM diagramme_cases WHERE diagramme_id = ? ORDER BY jour', [req.params.id]);
        rows[0].cases = cases;
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/diagrammes', authenticateToken, async (req, res) => {
    try {
        const { patient_id, medecin, type_soin, mois, annee, notes } = req.body;
        // FIX: vérifier accès partagé pour créer un diagramme
        const patient = await canAccessPatient(req.user.id, patient_id);
        if (!patient) return res.status(404).json({ error: 'Patient non trouvé ou accès non autorisé' });
        
        const [result] = await dbAsync.execute(
            'INSERT INTO diagrammes (patient_id, patient_nom, patient_prenom, medecin, type_soin, mois, annee, notes, infirmier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [patient_id, patient.nom, patient.prenom, medecin, type_soin, mois, annee, notes, req.user.id]
        );
        
        // Create cases for the month
        const daysInMonth = new Date(annee, mois, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const jour = `${annee}-${String(mois).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            await dbAsync.execute(
                'INSERT INTO diagramme_cases (diagramme_id, jour) VALUES (?, ?)',
                [result.insertId, jour]
            );
        }
        
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/diagrammes/:id/cases', authenticateToken, async (req, res) => {
    try {
        const { cases } = req.body;
        // FIX: vérifier que l'utilisateur a accès au diagramme (propriétaire ou partage)
        const [diagramme] = await dbAsync.query('SELECT d.patient_id FROM diagrammes d WHERE d.id = ?', [req.params.id]);
        if (!diagramme.length) return res.status(404).json({ error: 'Diagramme non trouvé' });
        const patient = await canAccessPatient(req.user.id, diagramme[0].patient_id);
        if (!patient) return res.status(403).json({ error: 'Accès non autorisé' });

        for (const c of cases) {
            await dbAsync.execute(
                'UPDATE diagramme_cases SET matin = ?, midi = ?, soir = ?, legendes = ? WHERE id = ?',
                [c.matin ? 1 : 0, c.midi ? 1 : 0, c.soir ? 1 : 0, c.legendes || '{}', c.id]
            );
        }
        res.json({ message: 'Cases mises à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/diagrammes/:id/signer', authenticateToken, async (req, res) => {
    try {
        const { signature_data } = req.body;
        // FIX: vérifier accès partagé pour signer
        const [diagramme] = await dbAsync.query('SELECT patient_id FROM diagrammes WHERE id = ?', [req.params.id]);
        if (!diagramme.length) return res.status(404).json({ error: 'Diagramme non trouvé' });
        const patient = await canAccessPatient(req.user.id, diagramme[0].patient_id);
        if (!patient) return res.status(403).json({ error: 'Accès non autorisé' });

        await dbAsync.execute(
            'UPDATE diagrammes SET signe_le = datetime("now"), signature_data = ? WHERE id = ?',
            [signature_data, req.params.id]
        );
        res.json({ message: 'Diagramme signé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== LÉGENDES ==========
app.get('/api/patients/:id/legendes', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query('SELECT * FROM legendes WHERE patient_id = ? ORDER BY label', [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients/:id/legendes', authenticateToken, async (req, res) => {
    try {
        const { label, couleur } = req.body;
        const [result] = await dbAsync.execute(
            'INSERT INTO legendes (patient_id, label, couleur) VALUES (?, ?, ?)',
            [req.params.id, label, couleur]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/legendes/:id', authenticateToken, async (req, res) => {
    try {
        await dbAsync.execute('DELETE FROM legendes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Légende supprimée' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== TOURNÉES ==========
app.get('/api/tournees', authenticateToken, async (req, res) => {
    try {
        const { date } = req.query;
        let sql = 'SELECT * FROM tournees WHERE infirmier_id = ?';
        const params = [req.user.id];
        if (date) {
            sql += ' AND date_tournee = ?';
            params.push(date);
        }
        sql += ' ORDER BY date_tournee DESC';
        const [rows] = await dbAsync.query(sql, params);
        for (const t of rows) {
            const [etapes] = await dbAsync.query('SELECT * FROM tournee_etapes WHERE tournee_id = ? ORDER BY ordre', [t.id]);
            t.etapes = etapes;
        }
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tournees/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query('SELECT * FROM tournees WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Tournée non trouvée' });
        const [etapes] = await dbAsync.query('SELECT * FROM tournee_etapes WHERE tournee_id = ? ORDER BY ordre', [req.params.id]);
        rows[0].etapes = etapes;
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tournees', authenticateToken, async (req, res) => {
    try {
        const { date_tournee, ville_depart, adresse_depart, patient_ids } = req.body;
        const [result] = await dbAsync.execute(
            'INSERT INTO tournees (date_tournee, ville_depart, adresse_depart, infirmier_id) VALUES (?, ?, ?, ?)',
            [date_tournee, ville_depart, adresse_depart, req.user.id]
        );
        
        // Add etapes
        for (let i = 0; i < patient_ids.length; i++) {
            const pid = patient_ids[i];
            const [patient] = await dbAsync.query('SELECT nom, prenom, adresse, ville FROM patients WHERE id = ?', [pid]);
            if (patient) {
                await dbAsync.execute(
                    'INSERT INTO tournee_etapes (tournee_id, patient_id, patient_nom, patient_prenom, adresse, ville, ordre) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [result.insertId, pid, patient[0].nom, patient[0].prenom, patient[0].adresse, patient[0].ville, i + 1]
                );
            }
        }
        
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tournees/:tourneeId/etape/:etapeId', authenticateToken, async (req, res) => {
    try {
        const { statut, distance_km } = req.body;
        await dbAsync.execute(
            'UPDATE tournee_etapes SET statut = ?, distance_km = ? WHERE id = ?',
            [statut, distance_km, req.params.etapeId]
        );
        
        // Update tournee total km
        const [etapes] = await dbAsync.query('SELECT SUM(distance_km) as total FROM tournee_etapes WHERE tournee_id = ?', [req.params.tourneeId]);
        await dbAsync.execute('UPDATE tournees SET km_total = ? WHERE id = ?', [etapes[0].total || 0, req.params.tourneeId]);
        
        // Update global km counter
        const [km] = await dbAsync.query('SELECT total_km FROM km WHERE infirmier_id = ?', [req.user.id]);
        if (km.length > 0) {
            await dbAsync.execute('UPDATE km SET total_km = total_km + ?, updated_at = datetime("now") WHERE infirmier_id = ?', [distance_km || 0, req.user.id]);
        } else {
            await dbAsync.execute('INSERT INTO km (infirmier_id, total_km) VALUES (?, ?)', [req.user.id, distance_km || 0]);
        }
        
        res.json({ message: 'Étape mise à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== KM ==========
app.get('/api/km', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query('SELECT * FROM km WHERE infirmier_id = ?', [req.user.id]);
        res.json(rows[0] || { total_km: 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PLANNING ==========
app.get('/api/planning', authenticateToken, async (req, res) => {
    try {
        const { debut, fin } = req.query;
        let sql = 'SELECT p.*, i.nom as infirmier_nom, i.prenom as infirmier_prenom FROM planning p LEFT JOIN infirmiers i ON p.infirmier_id = i.id WHERE p.infirmier_id = ?';
        const params = [req.user.id];
        if (debut && fin) {
            sql += ' AND date_debut >= ? AND date_fin <= ?';
            params.push(debut, fin);
        }
        sql += ' ORDER BY date_debut';
        const [rows] = await dbAsync.query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/planning', authenticateToken, async (req, res) => {
    try {
        const { date_debut, date_fin, type_event, titre, description, couleur } = req.body;
        const [result] = await dbAsync.execute(
            'INSERT INTO planning (infirmier_id, date_debut, date_fin, type_event, titre, description, couleur) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, date_debut, date_fin, type_event, titre, description, couleur]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/planning/:id', authenticateToken, async (req, res) => {
    try {
        const { date_debut, date_fin, type_event, titre, description, couleur } = req.body;
        await dbAsync.execute(
            'UPDATE planning SET date_debut = ?, date_fin = ?, type_event = ?, titre = ?, description = ?, couleur = ? WHERE id = ? AND infirmier_id = ?',
            [date_debut, date_fin, type_event, titre, description, couleur, req.params.id, req.user.id]
        );
        res.json({ message: 'Événement mis à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/planning/:id', authenticateToken, async (req, res) => {
    try {
        await dbAsync.execute('DELETE FROM planning WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Événement supprimé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== STORAGE ==========
app.get('/api/storage', authenticateToken, async (req, res) => {
    try {
        const [rows] = await dbAsync.query(
            'SELECT COALESCE(SUM(taille_octets), 0) as total FROM photos WHERE infirmier_id = ?',
            [req.user.id]
        );
        res.json({ total_bytes: rows[0].total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== SANTÉ SERVEUR ==========
app.get('/health', (req, res) => res.json({ status: 'ok', version: CURRENT_SERVER_VERSION }));

// ========== GESTION D'ERREURS GLOBALE ==========
// BUG FIX: Middleware d'erreur Multer et Express
app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Fichier trop volumineux (max 15 Mo).' });
    }
    if (err.message && err.message.includes('Type de fichier')) {
        return res.status(415).json({ error: err.message });
    }
    console.error('Erreur non gérée:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// ========== DÉMARRAGE ==========
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🏥 Santé + — Serveur démarré sur le port ${PORT}`);
    console.log(`   Version: ${CURRENT_SERVER_VERSION} | Version min client: ${MINIMUM_REQUIRED_VERSION}`);
});
