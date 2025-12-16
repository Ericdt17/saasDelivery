# 📱 WhatsApp Delivery Bot - Système de Gestion de Livraisons

Système complet de gestion de livraisons avec support multi-agences, authentification JWT, API REST, et intégration WhatsApp.

## 🚀 Démarrage Rapide

### Prérequis

- Node.js 18+
- PostgreSQL (production) ou SQLite (développement)
- Compte WhatsApp

### Installation

```bash
# Installer les dépendances
npm install

# Créer le fichier .env
cp .env.example .env
```

### Configuration

Éditez le fichier `.env` :

```env
# Base de données
DATABASE_URL=postgresql://user:password@host:port/database  # Pour PostgreSQL
# ou laissez vide pour SQLite (développement)

# JWT
JWT_SECRET=your-secret-key-here

# WhatsApp
GROUP_ID=your-whatsapp-group-id  # Optionnel

# Timezone
TZ=Africa/Douala
```

### Lancer l'application

```bash
# Développement
npm run dev

# Production
npm start

# API uniquement
npm run api
```

## 📋 Fonctionnalités

### ✅ Authentification
- Système JWT avec rôles (super_admin, agency)
- Hashing sécurisé des mots de passe (bcrypt)
- Middleware d'authentification pour routes protégées

### ✅ Multi-Agences
- Gestion de plusieurs agences
- Isolation des données par agence
- Filtrage automatique selon le rôle

### ✅ API REST
- Endpoints pour livraisons, statistiques, agences, groupes
- Pagination et filtres
- Recherche en temps réel

### ✅ Intégration WhatsApp
- Réception automatique des messages
- Parsing des livraisons depuis WhatsApp
- Support multi-groupes

### ✅ Base de Données
- Support PostgreSQL (production) et SQLite (développement)
- Migration automatique des schémas
- Compatibilité entre les deux systèmes

## 📖 Documentation

- **[Group Management - Toggle and Delete](GROUP_MANAGEMENT.md)** - Complete guide to group activation/deactivation and deletion features

## 📚 API Endpoints

### Authentification
- `POST /api/v1/auth/login` - Connexion
- `POST /api/v1/auth/logout` - Déconnexion
- `GET /api/v1/auth/me` - Informations utilisateur

### Livraisons
- `GET /api/v1/deliveries` - Liste des livraisons
- `GET /api/v1/deliveries/:id` - Détails d'une livraison
- `POST /api/v1/deliveries` - Créer une livraison
- `PUT /api/v1/deliveries/:id` - Mettre à jour une livraison

### Statistiques
- `GET /api/v1/stats/daily` - Statistiques quotidiennes

### Agences (Super Admin)
- `GET /api/v1/agencies` - Liste des agences
- `POST /api/v1/agencies` - Créer une agence

### Groupes
- `GET /api/v1/groups` - Liste des groupes

## 🔧 Scripts Disponibles

```bash
npm start          # Démarrer le bot
npm run dev        # Mode développement avec nodemon
npm run api        # Démarrer uniquement l'API
npm run api:dev    # API en mode développement
npm test           # Lancer les tests
npm run test:db    # Tester la connexion DB
```

## 🗄️ Base de Données

### Tables Principales

- **agencies** - Agences et utilisateurs
- **groups** - Groupes WhatsApp
- **deliveries** - Livraisons
- **delivery_history** - Historique des actions

### Migration

Les tables sont créées automatiquement au démarrage. Pour PostgreSQL, utilisez :

```bash
node src/scripts/create-postgres-tables.js
```

## 🚀 Déploiement sur Render

### Variables d'Environnement Requises

- `DATABASE_URL` - URL de connexion PostgreSQL
- `JWT_SECRET` - Secret pour signer les tokens JWT
- `NODE_ENV=production`

### Étapes

1. Créer une base PostgreSQL sur Render
2. Ajouter `DATABASE_URL` dans les variables d'environnement
3. Ajouter `JWT_SECRET` dans les variables d'environnement
4. Déployer le service

## 📖 Documentation

La documentation détaillée est disponible dans les fichiers `.md` du projet (non versionnés pour garder le repo propre).

## 🔒 Sécurité

- Mots de passe hashés avec bcrypt
- Tokens JWT avec expiration
- Validation des entrées
- Filtrage des données par rôle

## 📝 Format des Livraisons WhatsApp

Envoyez un message dans le format suivant :

```
612345678
Jean Dupont
2x Pizza, 1x Cola
5000
```

Le bot parse automatiquement et crée la livraison.

## 🤝 Contribution

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

ISC

## 🆘 Support

Pour toute question ou problème, consultez la documentation dans les fichiers `.md` du projet.
