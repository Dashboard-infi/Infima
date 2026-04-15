# Cabinet Infirmier Donneville

Application mobile pour infirmières libérales — Gestion complète de cabinet.

## Fonctionnalités

- **Agenda** — Planning journalier type Google Agenda avec RDV patients
- **Fiche Patient** — Informations complètes, paramètres vitaux (tension, saturation, pouls, glycémie, température, EVA), photos avec notes
- **Diagramme de Soins** — Grille mois complet avec cases Matin/Midi/Soir, signature digitale
- **Tournée GPS** — Optimisation itinéraire via carte, calcul automatique, compteur kilométrique par profil
- **Planning Infirmière** — Planning partagé, modifiable en direct (travail, congé, garde, formation)
- **Messagerie Sécurisée** — Boîte mail interne entre infirmiers du cabinet
- **Profil** — Création et gestion de profil infirmier

## Stack technique

- **Frontend** : React 18, React Router, Leaflet (cartes), react-signature-canvas, date-fns
- **Backend** : Node.js, Express, JWT, bcrypt, multer (photos)
- **Base de données** : MySQL 8.0
- **Conteneurisation** : Docker Compose

## Installation

### Prérequis
- Node.js 18+
- MySQL 8.0 (ou Docker)

### Avec Docker (recommandé)
```bash
cd cabinet-donneville
docker-compose up --build
```
L'application sera accessible sur `http://localhost:3000`

### Sans Docker (développement)

1. **Base de données** — Créer la base MySQL :
```bash
mysql -u root -p < database/schema.sql
```

2. **Backend** :
```bash
cd server
cp .env.example .env   # Ajuster les variables
npm install
npm run dev
```

3. **Frontend** :
```bash
cd client
npm install
npm start
```

### Variables d'environnement (server/.env)
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=votre_mot_de_passe
DB_NAME=cabinet_donneville
JWT_SECRET=votre_cle_secrete_tres_longue
PORT=3001
```

## Structure du projet

```
cabinet-donneville/
├── client/                  # Frontend React
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js           # Routes + Auth + Navigation
│       ├── App.css           # Styles globaux (design mobile)
│       ├── api.js            # Client API centralisé
│       └── pages/
│           ├── Login.js       # Connexion
│           ├── Register.js    # Inscription
│           ├── Agenda.js      # Agenda / Planning journalier
│           ├── Patients.js    # Liste des patients
│           ├── PatientFiche.js # Fiche patient (vitaux + photos)
│           ├── DiagrammeSoins.js # Liste des diagrammes
│           ├── DiagrammeDetail.js # Diagramme détail + signature
│           ├── Tournee.js     # Tournée GPS + carte
│           ├── Planning.js    # Planning semaine
│           ├── Messagerie.js  # Messagerie sécurisée
│           └── Profil.js      # Profil + compteur km
├── server/
│   ├── app.js               # API Express complète
│   ├── package.json
│   └── .env
├── database/
│   └── schema.sql           # Schéma MySQL complet
└── docker-compose.yml
```

## API Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/auth/register | Inscription |
| POST | /api/auth/login | Connexion |
| GET/PUT | /api/profil | Profil infirmier |
| GET/POST/PUT/DELETE | /api/patients | Gestion patients |
| GET/POST | /api/patients/:id/photos | Photos patients |
| GET/POST | /api/patients/:id/vitaux | Paramètres vitaux |
| GET/POST/PUT/DELETE | /api/agenda | Rendez-vous |
| GET/POST | /api/diagrammes | Diagrammes de soins |
| PUT | /api/diagrammes/:id/cases | Cocher cases matin/midi/soir |
| PUT | /api/diagrammes/:id/signer | Signature digitale |
| GET/POST | /api/tournees | Tournées GPS |
| PUT | /api/tournees/:id/etape/:etapeId | Mise à jour étape |
| GET | /api/km | Compteur kilométrique |
| GET/POST/PUT/DELETE | /api/planning | Planning infirmières |
| GET/POST | /api/messages | Messagerie |
| PUT | /api/messages/:id/lire | Marquer comme lu |
