require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// Config multer — stockage temporaire en mémoire pour compression
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 }
});

// ========== COMPRESSION PIPELINE ==========
async function compressAndSave(buffer, patientId, patientNom, description) {
    const patientDir = path.join(__dirname, 'uploads', 'patients', String(patientId));
    if (!fs.existsSync(patientDir)) fs.mkdirSync(patientDir, { recursive: true });

    const dateStr = new Date().toISOString().split('T')[0];
    const safeName = (patientNom || 'patient').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDesc = (description || 'soin').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const filename = `${safeName}_${dateStr}_${safeDesc}_${Date.now()}.webp`;
    const filepath = path.join(patientDir, filename);

    // Pipeline: resize max 1280px → WebP 70% → strip EXIF
    await sharp(buffer)
        .rotate()                    // auto-rotate based on EXIF then strip
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(filepath);

    const stats = fs.statSync(filepath);
    const url = `/uploads/patients/${patientId}/${filename}`;
    return { url, filename, taille_octets: stats.size };
}

// Connexion à la base de données MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cabinet_donneville'
});

const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_ici';

// ========== VERSION CONTROL ==========
const MINIMUM_REQUIRED_VERSION = process.env.MINIMUM_REQUIRED_VERSION || '1.0.0';
const CURRENT_SERVER_VERSION = process.env.CURRENT_SERVER_VERSION || '1.0.0';

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
            error: 'update_required',
            message: 'Version obsolete. Mise a jour obligatoire.',
            minimum_version: MINIMUM_REQUIRED_VERSION,
            current_version: CURRENT_SERVER_VERSION
        });
    }
    next();
}

app.use(checkClientVersion);

// Endpoint version publique (pas de auth)
app.get('/api/version', (req, res) => {
    res.json({
        current_version: CURRENT_SERVER_VERSION,
        minimum_required_version: MINIMUM_REQUIRED_VERSION
    });
});

// ========== MIDDLEWARE AUTH ==========
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// ========== AUTH ==========
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nom, prenom, email, mot_de_passe, telephone, adresse, ville, code_postal } = req.body;
        const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
        const [result] = await db.query(
            'INSERT INTO infirmiers (nom, prenom, email, mot_de_passe, telephone, adresse, ville, code_postal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [nom, prenom, email, hashedPassword, telephone, adresse, ville, code_postal]
        );
        res.status(201).json({ message: 'Infirmier créé avec succès', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, mot_de_passe } = req.body;
        const [users] = await db.query('SELECT * FROM infirmiers WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        const user = users[0];
        const isValid = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
        if (!isValid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PROFIL ==========
app.get('/api/profil', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, nom, prenom, email, telephone, adresse, ville, code_postal, couleur, photo_url FROM infirmiers WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/profil', authenticateToken, async (req, res) => {
    try {
        const { nom, prenom, telephone, adresse, ville, code_postal, couleur } = req.body;
        await db.query(
            'UPDATE infirmiers SET nom=?, prenom=?, telephone=?, adresse=?, ville=?, code_postal=?, couleur=? WHERE id=?',
            [nom, prenom, telephone, adresse, ville, code_postal, couleur, req.user.id]
        );
        res.json({ message: 'Profil mis à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PATIENTS ==========
app.get('/api/patients', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM patients WHERE infirmier_id = ? AND deleted_at IS NULL ORDER BY nom', [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM patients WHERE id = ? AND infirmier_id = ? AND deleted_at IS NULL', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Patient non trouvé' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
    try {
        const { nom, prenom, date_naissance, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes } = req.body;
        const [result] = await db.query(
            'INSERT INTO patients (nom, prenom, date_naissance, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, infirmier_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [nom, prenom, date_naissance, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, req.user.id]
        );
        res.status(201).json({ id: result.insertId, message: 'Patient créé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { nom, prenom, date_naissance, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, actif } = req.body;
        await db.query(
            'UPDATE patients SET nom=?, prenom=?, date_naissance=?, adresse=?, ville=?, code_postal=?, telephone=?, email=?, medecin_traitant=?, numero_secu=?, notes=?, actif=? WHERE id=? AND infirmier_id=?',
            [nom, prenom, date_naissance, adresse, ville, code_postal, telephone, email, medecin_traitant, numero_secu, notes, actif, req.params.id, req.user.id]
        );
        res.json({ message: 'Patient mis à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== SUPPRESSION COMPLETE PATIENT (CASCADE) ==========
app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const patientId = req.params.id;
        const { reason } = req.body || {};

        // Vérifier que le patient appartient à cet infirmier
        const [check] = await conn.query('SELECT id, nom FROM patients WHERE id = ? AND infirmier_id = ?', [patientId, req.user.id]);
        if (check.length === 0) { await conn.rollback(); conn.release(); return res.status(404).json({ error: 'Patient non trouvé' }); }

        // 1. Supprimer les fichiers photos du disque
        const patientDir = path.join(__dirname, 'uploads', 'patients', String(patientId));
        if (fs.existsSync(patientDir)) {
            fs.rmSync(patientDir, { recursive: true, force: true });
        }

        // 2. Supprimer les notifications liées
        await conn.query('DELETE FROM notifications WHERE patient_id = ?', [patientId]);

        // 3. Supprimer les photos DB (cascade via FK couvre aussi, mais explicite)
        await conn.query('DELETE FROM photos_patients WHERE patient_id = ?', [patientId]);

        // 4. Supprimer vitaux
        await conn.query('DELETE FROM constantes_vitales WHERE patient_id = ?', [patientId]);

        // 5. Supprimer diagrammes (cases cascadent)
        await conn.query('DELETE FROM diagrammes_soins WHERE patient_id = ?', [patientId]);

        // 6. Supprimer étapes de tournée
        await conn.query('DELETE FROM tournee_etapes WHERE patient_id = ?', [patientId]);

        // 7. Supprimer RDV agenda
        await conn.query('DELETE FROM agenda WHERE patient_id = ?', [patientId]);

        // 8. Marquer le patient comme supprimé (soft delete) puis supprimer
        if (reason) {
            await conn.query('UPDATE patients SET deleted_at = NOW(), deleted_reason = ? WHERE id = ?', [reason, patientId]);
        }
        await conn.query('DELETE FROM patients WHERE id = ?', [patientId]);

        await conn.commit();
        conn.release();
        res.json({ message: 'Patient et toutes les données associées supprimés définitivement' });
    } catch (error) {
        await conn.rollback();
        conn.release();
        res.status(500).json({ error: error.message });
    }
});

// ========== PHOTOS PATIENTS ==========
app.get('/api/patients/:id/photos', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT id, patient_id, url, filename, description, taille_octets, date_prise, date_expiration, infirmier_id,
             DATEDIFF(date_expiration, NOW()) as jours_restants
             FROM photos_patients WHERE patient_id = ? ORDER BY date_prise DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients/:id/photos', authenticateToken, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });
        // Récupérer le nom du patient pour le nom de fichier
        const [patient] = await db.query('SELECT nom FROM patients WHERE id = ?', [req.params.id]);
        const patientNom = patient.length > 0 ? patient[0].nom : 'patient';
        const description = req.body.description || '';

        // Pipeline: compression → WebP → sauvegarde
        const { url, filename, taille_octets } = await compressAndSave(req.file.buffer, req.params.id, patientNom, description);

        const [result] = await db.query(
            'INSERT INTO photos_patients (patient_id, url, filename, description, taille_octets, infirmier_id) VALUES (?,?,?,?,?,?)',
            [req.params.id, url, filename, description, taille_octets, req.user.id]
        );
        res.status(201).json({ id: result.insertId, url, filename, taille_octets });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Télécharger une photo
app.get('/api/photos/:photoId/download', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT pp.*, p.nom as patient_nom FROM photos_patients pp JOIN patients p ON pp.patient_id = p.id WHERE pp.id = ?', [req.params.photoId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Photo non trouvée' });
        const photo = rows[0];
        const filepath = path.join(__dirname, photo.url);
        if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Fichier introuvable sur le disque' });
        const downloadName = photo.filename || `photo_${photo.patient_nom}_${photo.id}.webp`;
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Content-Type', 'image/webp');
        res.sendFile(filepath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Supprimer une photo manuellement
app.delete('/api/photos/:photoId', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM photos_patients WHERE id = ?', [req.params.photoId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Photo non trouvée' });
        const photo = rows[0];
        // Supprimer du disque
        const filepath = path.join(__dirname, photo.url);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        // Supprimer notifications liées
        await db.query('DELETE FROM notifications WHERE photo_id = ?', [photo.id]);
        // Supprimer de la DB
        await db.query('DELETE FROM photos_patients WHERE id = ?', [photo.id]);
        res.json({ message: 'Photo supprimée' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== CONSTANTES VITALES ==========
app.get('/api/patients/:id/vitaux', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM constantes_vitales WHERE patient_id = ? ORDER BY date_mesure DESC', [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients/:id/vitaux', authenticateToken, async (req, res) => {
    try {
        const { tension, saturation, pouls, glycemie, temperature, eva, notes } = req.body;
        const [result] = await db.query(
            'INSERT INTO constantes_vitales (patient_id, infirmier_id, tension, saturation, pouls, glycemie, temperature, eva, notes) VALUES (?,?,?,?,?,?,?,?,?)',
            [req.params.id, req.user.id, tension, saturation, pouls, glycemie, temperature, eva, notes]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== AGENDA ==========
app.get('/api/agenda', authenticateToken, async (req, res) => {
    try {
        const { date, mois, annee } = req.query;
        let query = `SELECT a.*, p.nom as patient_nom, p.prenom as patient_prenom, p.adresse as patient_adresse, p.ville as patient_ville
                      FROM agenda a JOIN patients p ON a.patient_id = p.id WHERE a.infirmier_id = ?`;
        const params = [req.user.id];
        if (date) {
            query += ' AND DATE(a.date_rdv) = ?';
            params.push(date);
        } else if (mois && annee) {
            query += ' AND MONTH(a.date_rdv) = ? AND YEAR(a.date_rdv) = ?';
            params.push(mois, annee);
        }
        query += ' ORDER BY a.date_rdv ASC';
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/agenda', authenticateToken, async (req, res) => {
    try {
        const { patient_id, date_rdv, duree_minutes, type_soin, notes } = req.body;
        const [result] = await db.query(
            'INSERT INTO agenda (infirmier_id, patient_id, date_rdv, duree_minutes, type_soin, notes) VALUES (?,?,?,?,?,?)',
            [req.user.id, patient_id, date_rdv, duree_minutes || 30, type_soin, notes]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/agenda/:id', authenticateToken, async (req, res) => {
    try {
        const { patient_id, date_rdv, duree_minutes, type_soin, statut, notes } = req.body;
        await db.query(
            'UPDATE agenda SET patient_id=?, date_rdv=?, duree_minutes=?, type_soin=?, statut=?, notes=? WHERE id=? AND infirmier_id=?',
            [patient_id, date_rdv, duree_minutes, type_soin, statut, notes, req.params.id, req.user.id]
        );
        res.json({ message: 'RDV mis à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/agenda/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM agenda WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'RDV supprimé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== DIAGRAMME DE SOINS ==========
app.get('/api/diagrammes', authenticateToken, async (req, res) => {
    try {
        const { patient_id, mois, annee } = req.query;
        let query = `SELECT d.*, p.nom as patient_nom, p.prenom as patient_prenom
                      FROM diagrammes_soins d JOIN patients p ON d.patient_id = p.id WHERE d.infirmier_id = ?`;
        const params = [req.user.id];
        if (patient_id) { query += ' AND d.patient_id = ?'; params.push(patient_id); }
        if (mois) { query += ' AND d.mois = ?'; params.push(mois); }
        if (annee) { query += ' AND d.annee = ?'; params.push(annee); }
        query += ' ORDER BY d.created_at DESC';
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/diagrammes', authenticateToken, async (req, res) => {
    try {
        const { patient_id, medecin, mois, annee, type_soin, notes } = req.body;
        const [result] = await db.query(
            'INSERT INTO diagrammes_soins (patient_id, infirmier_id, medecin, mois, annee, type_soin, notes) VALUES (?,?,?,?,?,?,?)',
            [patient_id, req.user.id, medecin, mois, annee, type_soin, notes]
        );
        // Créer les cases pour chaque jour du mois
        const daysInMonth = new Date(annee, mois, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${annee}-${String(mois).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            await db.query('INSERT INTO diagramme_cases (diagramme_id, jour) VALUES (?, ?)', [result.insertId, dateStr]);
        }
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/diagrammes/:id', authenticateToken, async (req, res) => {
    try {
        const [diag] = await db.query(
            `SELECT d.*, p.nom as patient_nom, p.prenom as patient_prenom, p.medecin_traitant
             FROM diagrammes_soins d JOIN patients p ON d.patient_id = p.id WHERE d.id = ?`, [req.params.id]
        );
        if (diag.length === 0) return res.status(404).json({ error: 'Diagramme non trouvé' });
        const [cases] = await db.query('SELECT * FROM diagramme_cases WHERE diagramme_id = ? ORDER BY jour', [req.params.id]);
        res.json({ ...diag[0], cases });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/diagrammes/:id/cases', authenticateToken, async (req, res) => {
    try {
        const { cases } = req.body;
        for (const c of cases) {
            await db.query('UPDATE diagramme_cases SET matin=?, midi=?, soir=?, notes_jour=? WHERE id=?',
                [c.matin, c.midi, c.soir, c.notes_jour, c.id]);
        }
        res.json({ message: 'Cases mises à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/diagrammes/:id/signer', authenticateToken, async (req, res) => {
    try {
        const { signature_data } = req.body;
        await db.query('UPDATE diagrammes_soins SET signature_data=?, signe_le=NOW() WHERE id=?', [signature_data, req.params.id]);
        res.json({ message: 'Diagramme signé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== TOURNEES ==========
app.get('/api/tournees', authenticateToken, async (req, res) => {
    try {
        const { date } = req.query;
        let query = 'SELECT * FROM tournees WHERE infirmier_id = ?';
        const params = [req.user.id];
        if (date) { query += ' AND date_tournee = ?'; params.push(date); }
        query += ' ORDER BY date_tournee DESC';
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tournees', authenticateToken, async (req, res) => {
    try {
        const { date_tournee, ville_depart, adresse_depart, patient_ids } = req.body;
        const [result] = await db.query(
            'INSERT INTO tournees (infirmier_id, date_tournee, ville_depart, adresse_depart) VALUES (?,?,?,?)',
            [req.user.id, date_tournee, ville_depart, adresse_depart]
        );
        if (patient_ids && patient_ids.length > 0) {
            for (let i = 0; i < patient_ids.length; i++) {
                await db.query('INSERT INTO tournee_etapes (tournee_id, patient_id, ordre) VALUES (?,?,?)',
                    [result.insertId, patient_ids[i], i + 1]);
            }
        }
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tournees/:id', authenticateToken, async (req, res) => {
    try {
        const [tournee] = await db.query('SELECT * FROM tournees WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        if (tournee.length === 0) return res.status(404).json({ error: 'Tournée non trouvée' });
        const [etapes] = await db.query(
            `SELECT te.*, p.nom as patient_nom, p.prenom as patient_prenom, p.adresse, p.ville, p.code_postal
             FROM tournee_etapes te JOIN patients p ON te.patient_id = p.id WHERE te.tournee_id = ? ORDER BY te.ordre`,
            [req.params.id]
        );
        res.json({ ...tournee[0], etapes });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tournees/:id/etape/:etapeId', authenticateToken, async (req, res) => {
    try {
        const { statut, distance_km } = req.body;
        await db.query('UPDATE tournee_etapes SET statut=?, distance_km=?, heure_arrivee=NOW() WHERE id=?',
            [statut, distance_km, req.params.etapeId]);
        // Recalculer km total
        const [etapes] = await db.query('SELECT SUM(distance_km) as total FROM tournee_etapes WHERE tournee_id=?', [req.params.id]);
        const kmTotal = etapes[0].total || 0;
        await db.query('UPDATE tournees SET km_total=? WHERE id=?', [kmTotal, req.params.id]);
        // Mettre à jour le compteur km journalier
        const [tournee] = await db.query('SELECT date_tournee FROM tournees WHERE id=?', [req.params.id]);
        if (tournee.length > 0) {
            await db.query(
                'INSERT INTO compteur_km (infirmier_id, date_jour, km_journalier) VALUES (?,?,?) ON DUPLICATE KEY UPDATE km_journalier=?',
                [req.user.id, tournee[0].date_tournee, kmTotal, kmTotal]
            );
        }
        res.json({ message: 'Étape mise à jour', km_total: kmTotal });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== COMPTEUR KM ==========
app.get('/api/km', authenticateToken, async (req, res) => {
    try {
        const { mois, annee } = req.query;
        let query = 'SELECT * FROM compteur_km WHERE infirmier_id = ?';
        const params = [req.user.id];
        if (mois && annee) {
            query += ' AND MONTH(date_jour) = ? AND YEAR(date_jour) = ?';
            params.push(mois, annee);
        }
        query += ' ORDER BY date_jour DESC';
        const [rows] = await db.query(query, params);
        const [total] = await db.query('SELECT SUM(km_journalier) as total FROM compteur_km WHERE infirmier_id = ?', [req.user.id]);
        res.json({ jours: rows, total_km: total[0].total || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PLANNING ==========
app.get('/api/planning', authenticateToken, async (req, res) => {
    try {
        const { debut, fin, infirmier_id } = req.query;
        let query = `SELECT p.*, i.nom as infirmier_nom, i.prenom as infirmier_prenom, i.couleur
                      FROM planning p JOIN infirmiers i ON p.infirmier_id = i.id WHERE 1=1`;
        const params = [];
        if (infirmier_id) { query += ' AND p.infirmier_id = ?'; params.push(infirmier_id); }
        if (debut && fin) { query += ' AND p.date_debut <= ? AND p.date_fin >= ?'; params.push(fin, debut); }
        query += ' ORDER BY p.date_debut';
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/planning', authenticateToken, async (req, res) => {
    try {
        const { date_debut, date_fin, type_event, titre, description, couleur } = req.body;
        const [result] = await db.query(
            'INSERT INTO planning (infirmier_id, date_debut, date_fin, type_event, titre, description, couleur) VALUES (?,?,?,?,?,?,?)',
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
        await db.query(
            'UPDATE planning SET date_debut=?, date_fin=?, type_event=?, titre=?, description=?, couleur=? WHERE id=? AND infirmier_id=?',
            [date_debut, date_fin, type_event, titre, description, couleur, req.params.id, req.user.id]
        );
        res.json({ message: 'Planning mis à jour' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/planning/:id', authenticateToken, async (req, res) => {
    try {
        await db.query('DELETE FROM planning WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Événement supprimé' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== MESSAGERIE ==========
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const [received] = await db.query(
            `SELECT m.*, i.nom as exp_nom, i.prenom as exp_prenom FROM messages m
             JOIN infirmiers i ON m.expediteur_id = i.id WHERE m.destinataire_id = ? ORDER BY m.date_envoi DESC`,
            [req.user.id]
        );
        const [sent] = await db.query(
            `SELECT m.*, i.nom as dest_nom, i.prenom as dest_prenom FROM messages m
             JOIN infirmiers i ON m.destinataire_id = i.id WHERE m.expediteur_id = ? ORDER BY m.date_envoi DESC`,
            [req.user.id]
        );
        const [unread] = await db.query('SELECT COUNT(*) as count FROM messages WHERE destinataire_id = ? AND lu = FALSE', [req.user.id]);
        res.json({ received, sent, unread_count: unread[0].count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { destinataire_id, objet, contenu } = req.body;
        const [result] = await db.query(
            'INSERT INTO messages (expediteur_id, destinataire_id, objet, contenu) VALUES (?,?,?,?)',
            [req.user.id, destinataire_id, objet, contenu]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/messages/:id/lire', authenticateToken, async (req, res) => {
    try {
        await db.query('UPDATE messages SET lu = TRUE WHERE id = ? AND destinataire_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Message lu' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== LISTE DES INFIRMIERS (pour messagerie) ==========
app.get('/api/infirmiers', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, nom, prenom, email FROM infirmiers WHERE id != ? ORDER BY nom', [req.user.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== NOTIFICATIONS ==========
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT n.*, p.nom as patient_nom, p.prenom as patient_prenom
             FROM notifications n
             LEFT JOIN patients p ON n.patient_id = p.id
             WHERE n.infirmier_id = ?
             ORDER BY n.date_creation DESC LIMIT 50`,
            [req.user.id]
        );
        const [unread] = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE infirmier_id = ? AND lu = FALSE',
            [req.user.id]
        );
        res.json({ notifications: rows, unread_count: unread[0].count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/:id/lire', authenticateToken, async (req, res) => {
    try {
        await db.query('UPDATE notifications SET lu = TRUE WHERE id = ? AND infirmier_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Notification lue' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/lire-tout', authenticateToken, async (req, res) => {
    try {
        await db.query('UPDATE notifications SET lu = TRUE WHERE infirmier_id = ?', [req.user.id]);
        res.json({ message: 'Toutes les notifications marquées comme lues' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== STOCKAGE GLOBAL ==========
app.get('/api/storage', authenticateToken, async (req, res) => {
    try {
        const [result] = await db.query('SELECT COALESCE(SUM(taille_octets), 0) as total_octets, COUNT(*) as nb_photos FROM photos_patients');
        const totalBytes = result[0].total_octets;
        const maxBytes = 1024 * 1024 * 1024; // 1 GB
        res.json({
            total_octets: totalBytes,
            total_mb: (totalBytes / (1024 * 1024)).toFixed(1),
            max_mb: 1024,
            pourcentage: ((totalBytes / maxBytes) * 100).toFixed(1),
            nb_photos: result[0].nb_photos
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== WORKER CRON : Notifications J-3/J-2/J-1 + Suppression auto J ==========
async function photoCleanupWorker() {
    console.log(`[CRON ${new Date().toISOString()}] Lancement du worker photo...`);
    try {
        // 1. NOTIFICATIONS J-3, J-2, J-1 avant expiration
        // Trouver les photos qui expirent dans 1, 2 ou 3 jours
        const [expiring] = await db.query(
            `SELECT pp.id as photo_id, pp.patient_id, pp.filename, pp.date_prise, pp.date_expiration,
                    pp.infirmier_id, p.nom as patient_nom, p.prenom as patient_prenom,
                    DATEDIFF(pp.date_expiration, NOW()) as jours_restants
             FROM photos_patients pp
             JOIN patients p ON pp.patient_id = p.id
             WHERE DATEDIFF(pp.date_expiration, NOW()) BETWEEN 0 AND 3`
        );

        for (const photo of expiring) {
            if (photo.jours_restants > 0 && photo.jours_restants <= 3) {
                // Vérifier si une notif a déjà été envoyée aujourd'hui pour cette photo
                const [existing] = await db.query(
                    `SELECT id FROM notifications
                     WHERE photo_id = ? AND DATE(date_creation) = CURDATE()`,
                    [photo.photo_id]
                );
                if (existing.length === 0 && photo.infirmier_id) {
                    const jourTxt = photo.jours_restants === 1 ? '1 jour' : `${photo.jours_restants} jours`;
                    await db.query(
                        `INSERT INTO notifications (infirmier_id, type, titre, message, photo_id, patient_id)
                         VALUES (?, 'photo_expiration', ?, ?, ?, ?)`,
                        [
                            photo.infirmier_id,
                            `Photo patient — suppression dans ${jourTxt}`,
                            `Une photo de ${photo.patient_prenom} ${photo.patient_nom} (${new Date(photo.date_prise).toLocaleDateString('fr-FR')}) sera supprimée dans ${jourTxt}. Téléchargez-la si nécessaire.`,
                            photo.photo_id,
                            photo.patient_id
                        ]
                    );
                    console.log(`  [NOTIF] Photo #${photo.photo_id} → J-${photo.jours_restants} pour ${photo.patient_nom}`);
                }
            }
        }

        // 2. SUPPRESSION AUTO : photos dont date_expiration <= NOW()
        const [expired] = await db.query(
            'SELECT id, url, patient_id FROM photos_patients WHERE date_expiration <= NOW()'
        );

        for (const photo of expired) {
            // Supprimer le fichier disque
            const filepath = path.join(__dirname, photo.url);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
                console.log(`  [DELETE] Fichier supprimé : ${filepath}`);
            }
            // Supprimer les notifications liées
            await db.query('DELETE FROM notifications WHERE photo_id = ?', [photo.id]);
            // Supprimer l'entrée DB
            await db.query('DELETE FROM photos_patients WHERE id = ?', [photo.id]);
            console.log(`  [DELETE] Photo #${photo.id} supprimée (expirée)`);
        }

        // 3. Nettoyer les dossiers patients vides
        const uploadsDir = path.join(__dirname, 'uploads', 'patients');
        if (fs.existsSync(uploadsDir)) {
            const dirs = fs.readdirSync(uploadsDir);
            for (const dir of dirs) {
                const dirPath = path.join(uploadsDir, dir);
                if (fs.statSync(dirPath).isDirectory()) {
                    const files = fs.readdirSync(dirPath);
                    if (files.length === 0) {
                        fs.rmdirSync(dirPath);
                        console.log(`  [CLEAN] Dossier vide supprimé : ${dirPath}`);
                    }
                }
            }
        }

        console.log(`[CRON] Worker terminé. ${expired.length} photo(s) supprimée(s), ${expiring.filter(p => p.jours_restants > 0 && p.jours_restants <= 3).length} notification(s) traitée(s).`);
    } catch (error) {
        console.error('[CRON] Erreur worker photo:', error.message);
    }
}

// Exécuter le worker toutes les heures (vérification régulière)
cron.schedule('0 * * * *', photoCleanupWorker);

// Démarrer le serveur
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serveur Cabinet Donneville démarré sur le port ${PORT}`);
    // Lancer le worker au démarrage
    setTimeout(photoCleanupWorker, 5000);
});