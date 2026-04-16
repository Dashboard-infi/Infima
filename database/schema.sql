-- Base de données pour Cabinet Infirmier Donneville
-- Pour Aiven: la base 'defaultdb' est utilisée directement
-- Pour local: décommentez les 2 lignes suivantes
-- CREATE DATABASE IF NOT EXISTS cabinet_donneville;
-- USE cabinet_donneville;

-- ============================================
-- Table des profils infirmières
-- ============================================
CREATE TABLE IF NOT EXISTS infirmiers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    telephone VARCHAR(20),
    adresse VARCHAR(255),
    ville VARCHAR(100),
    code_postal VARCHAR(10),
    couleur VARCHAR(7) DEFAULT '#0A3D62',
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- Table des patients
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    date_naissance DATE,
    adresse VARCHAR(255),
    ville VARCHAR(100),
    code_postal VARCHAR(10),
    telephone VARCHAR(20),
    email VARCHAR(100),
    medecin_traitant VARCHAR(200),
    numero_secu VARCHAR(20),
    notes TEXT,
    actif BOOLEAN DEFAULT TRUE,
    infirmier_id INT,
    deleted_at DATETIME DEFAULT NULL,
    deleted_reason ENUM('fin_prise_en_charge','rupture_contrat','deces','erreur_creation','autre') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
);

-- ============================================
-- Table des photos patients
-- ============================================
CREATE TABLE IF NOT EXISTS photos_patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    url VARCHAR(500) NOT NULL,
    filename VARCHAR(300),
    description TEXT,
    taille_octets INT DEFAULT 0,
    date_prise DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_expiration DATETIME GENERATED ALWAYS AS (date_prise + INTERVAL 60 DAY) STORED,
    infirmier_id INT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id),
    INDEX idx_expiration (date_expiration)
);

-- ============================================
-- Table des constantes vitales
-- ============================================
CREATE TABLE IF NOT EXISTS constantes_vitales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    infirmier_id INT,
    date_mesure DATETIME DEFAULT CURRENT_TIMESTAMP,
    tension VARCHAR(20),
    saturation DECIMAL(5,2),
    pouls INT,
    glycemie DECIMAL(5,2),
    temperature DECIMAL(4,2),
    eva INT,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
);

-- ============================================
-- Table agenda / rendez-vous
-- ============================================
CREATE TABLE IF NOT EXISTS agenda (
    id INT AUTO_INCREMENT PRIMARY KEY,
    infirmier_id INT NOT NULL,
    patient_id INT NOT NULL,
    date_rdv DATETIME NOT NULL,
    duree_minutes INT DEFAULT 30,
    type_soin VARCHAR(200),
    statut ENUM('planifie','en_cours','effectue','annule') DEFAULT 'planifie',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- ============================================
-- Table diagrammes de soins
-- ============================================
CREATE TABLE IF NOT EXISTS diagrammes_soins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    infirmier_id INT NOT NULL,
    medecin VARCHAR(200),
    mois INT NOT NULL,
    annee INT NOT NULL,
    type_soin VARCHAR(200) NOT NULL,
    notes TEXT,
    signature_data LONGTEXT,
    signe_le DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
);

-- ============================================
-- Table cases du diagramme (matin/midi/soir par jour)
-- ============================================
CREATE TABLE IF NOT EXISTS diagramme_cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    diagramme_id INT NOT NULL,
    jour DATE NOT NULL,
    matin BOOLEAN DEFAULT FALSE,
    midi BOOLEAN DEFAULT FALSE,
    soir BOOLEAN DEFAULT FALSE,
    notes_jour TEXT,
    legendes JSON DEFAULT NULL,
    FOREIGN KEY (diagramme_id) REFERENCES diagrammes_soins(id) ON DELETE CASCADE
);

-- ============================================
-- Table des légendes de diagramme (sauvegardées par patient)
-- ============================================
CREATE TABLE IF NOT EXISTS diagramme_legendes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    label VARCHAR(200) NOT NULL,
    couleur VARCHAR(7) DEFAULT '#0A3D62',
    infirmier_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
);

-- ============================================
-- Table des tournées
-- ============================================
CREATE TABLE IF NOT EXISTS tournees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    infirmier_id INT NOT NULL,
    date_tournee DATE NOT NULL,
    ville_depart VARCHAR(200),
    adresse_depart VARCHAR(255),
    km_total DECIMAL(8,2) DEFAULT 0,
    statut ENUM('planifiee','en_cours','terminee') DEFAULT 'planifiee',
    ordre_optimise JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
);

-- ============================================
-- Table des étapes de tournée
-- ============================================
CREATE TABLE IF NOT EXISTS tournee_etapes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournee_id INT NOT NULL,
    patient_id INT NOT NULL,
    ordre INT NOT NULL,
    distance_km DECIMAL(8,2) DEFAULT 0,
    statut ENUM('a_venir','en_cours','fait') DEFAULT 'a_venir',
    heure_arrivee DATETIME,
    FOREIGN KEY (tournee_id) REFERENCES tournees(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- ============================================
-- Table compteur kilométrique par profil
-- ============================================
CREATE TABLE IF NOT EXISTS compteur_km (
    id INT AUTO_INCREMENT PRIMARY KEY,
    infirmier_id INT NOT NULL,
    date_jour DATE NOT NULL,
    km_journalier DECIMAL(8,2) DEFAULT 0,
    UNIQUE KEY unique_km (infirmier_id, date_jour),
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
);

-- ============================================
-- Table planning infirmières
-- ============================================
CREATE TABLE IF NOT EXISTS planning (
    id INT AUTO_INCREMENT PRIMARY KEY,
    infirmier_id INT NOT NULL,
    date_debut DATETIME NOT NULL,
    date_fin DATETIME NOT NULL,
    type_event ENUM('travail','conge','garde','formation','autre') DEFAULT 'travail',
    titre VARCHAR(200),
    description TEXT,
    couleur VARCHAR(7) DEFAULT '#0A3D62',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id)
);

-- ============================================
-- Table messagerie sécurisée
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expediteur_id INT NOT NULL,
    destinataire_id INT NOT NULL,
    objet VARCHAR(300),
    contenu TEXT NOT NULL,
    lu BOOLEAN DEFAULT FALSE,
    date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expediteur_id) REFERENCES infirmiers(id),
    FOREIGN KEY (destinataire_id) REFERENCES infirmiers(id)
);

-- ============================================
-- Table notifications (expiration photos)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    infirmier_id INT NOT NULL,
    type ENUM('photo_expiration','system') DEFAULT 'photo_expiration',
    titre VARCHAR(300) NOT NULL,
    message TEXT NOT NULL,
    photo_id INT,
    patient_id INT,
    lu BOOLEAN DEFAULT FALSE,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (infirmier_id) REFERENCES infirmiers(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_id) REFERENCES photos_patients(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    INDEX idx_notif_user (infirmier_id, lu)
);