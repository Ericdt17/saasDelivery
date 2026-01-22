# 🚀 Ce qui se passe quand vous activez votre bot

## 📋 Vue d'ensemble

Quand vous lancez `npm start` ou `npm run dev`, voici exactement ce qui va se passer étape par étape.

---

## 🔄 Séquence d'Initialisation

### 1. **Chargement de la Configuration** ⚙️

```
✅ Lecture du fichier .env
✅ Chargement de config.js
✅ Détection du type de base de données
```

**Ce qui se passe :**
- Le bot lit votre fichier `.env`
- Il détecte que `DATABASE_URL` est défini
- Il choisit automatiquement **PostgreSQL** (votre base de dev sur Render)

**Résultat :**
```
📊 Type de base de données: POSTGRES
📂 Base: saas_delivery_db_dev
```

---

### 2. **Connexion à la Base de Données** 🔌

```
✅ Connexion à PostgreSQL (Render)
✅ Vérification des tables
✅ Pool de connexions créé
```

**Ce qui se passe :**
- Connexion SSL à votre base PostgreSQL de dev sur Render
- Vérification que les tables existent (agencies, groups, deliveries, delivery_history)
- Création d'un pool de connexions pour les requêtes

**Résultat :**
```
✅ Connexion PostgreSQL réussie
✅ Toutes les tables sont présentes
```

**⚠️ Si les tables n'existent pas :**
- Le bot **ne crée pas automatiquement** les tables
- Vous devez d'abord exécuter : `npm run migrate` ou `node src/scripts/create-postgres-tables.js`

---

### 3. **Initialisation du Client WhatsApp** 📱

```
✅ Création du client WhatsApp Web.js
✅ Chargement de la session (si elle existe)
✅ Démarrage de Puppeteer (navigateur headless)
```

**Ce qui se passe :**
- Le bot crée un client WhatsApp
- Il cherche une session sauvegardée dans `./auth/`
- Si la session existe, il l'utilise (pas besoin de scanner le QR code)
- Si pas de session, il va générer un QR code

**Résultat :**
```
🚀 Starting WhatsApp bot...
```

---

### 4. **Authentification WhatsApp** 🔐

#### **Scénario A : Session existante** ✅

```
✅ Session trouvée dans ./auth/
✅ Authentification automatique
✅ Bot prêt immédiatement
```

**Résultat :**
```
✅ AUTHENTICATED SUCCESSFULLY!
✅ Session saved!
✅ Bot is ready!
📋 Listening for messages...
```

#### **Scénario B : Pas de session** 📱

```
⚠️ Pas de session trouvée
📱 Génération d'un QR code
⏳ Attente de scan
```

**Ce qui se passe :**
- Un QR code apparaît dans le terminal
- Un fichier `qr-code.png` est créé
- Vous devez scanner le QR code avec WhatsApp sur votre téléphone

**Résultat :**
```
📱 HOW TO SCAN THE QR CODE:
============================================================
1. Open WhatsApp on your PHONE (not computer)
2. Tap the 3 dots menu (☰) → Linked Devices
3. Tap 'Link a Device'
4. Point your phone camera at the QR code below
   OR open the qr-code.png file and scan it
============================================================

[QR CODE AFFICHÉ ICI]

💡 QR code also saved as: qr-code.png
```

**Après scan :**
```
✅ AUTHENTICATED SUCCESSFULLY!
✅ Session saved!
✅ Bot is ready!
📋 Listening for messages...
```

---

### 5. **Configuration du Planificateur de Rapports** 📊

```
✅ Configuration du rapport quotidien
✅ Calcul de l'heure du prochain rapport (20:00 par défaut)
✅ Planification automatique
```

**Ce qui se passe :**
- Le bot configure un planificateur pour envoyer des rapports quotidiens
- Par défaut, le rapport est envoyé à 20:00
- Le planificateur se met à jour automatiquement chaque jour

**Résultat :**
```
📊 Daily report scheduled for: 20:00
```

---

## 🎯 Fonctionnalités Actives

Une fois le bot prêt, voici ce qui est **actif** :

### ✅ **1. Écoute des Messages WhatsApp**

Le bot écoute **tous les messages** dans les groupes WhatsApp :

- ✅ Messages des groupes (si `GROUP_ID` n'est pas défini)
- ✅ Ou uniquement le groupe spécifié (si `GROUP_ID` est défini dans `.env`)
- ❌ Ignore les messages privés (1-à-1)

**Logs que vous verrez :**
```
🔍 DEBUG - Raw message received:
   isGroup: true
   groupId: 12036312345678901234@g.us
   targetGroupId: null
   message length: 45
   message preview: 612345678
2 robes + 1 sac
15k
Bonapriso
```

---

### ✅ **2. Détection Automatique des Livraisons**

Le bot détecte automatiquement les messages de livraison dans **2 formats** :

#### **Format 1 (Standard) :**
```
612345678
2 robes + 1 sac
15k
Bonapriso
```

#### **Format 2 (Alternatif) :**
```
Bessengue
Acide glycolique
Crème solaire
Un masque
14000
651 07 35 74
```

**Ce qui se passe :**
- Le bot parse le message
- Extrait : numéro, produits, montant, quartier
- Crée automatiquement une livraison dans PostgreSQL

**Résultat :**
```
✅ LIVRAISON #X ENREGISTRÉE AVEC SUCCÈS!
📦 Livraison #X
📱 Numéro: 612345678
💰 Montant: 15000 FCFA
📍 Quartier: Bonapriso
```

---

### ✅ **3. Mise à Jour par Réponse (Nouvelle Fonctionnalité)** 💬

Le bot peut mettre à jour les livraisons en répondant aux messages :

**Exemples de réponses :**
- `Livré` → Marque comme livré et paie le montant restant
- `Collecté 5000` → Ajoute 5000 FCFA au montant payé
- `Échec` → Marque comme échec
- `Pickup` → Marque comme en attente de ramassage

**Ce qui se passe :**
- Le bot détecte que c'est une réponse
- Trouve la livraison liée au message cité
- Utilise `updateDeliveryByMessageId()` pour mettre à jour
- Enregistre l'historique

**Résultat :**
```
✅✅✅ MISE À JOUR RÉUSSIE ✅✅✅
📦 Livraison #X
📱 Numéro: 612345678
📊 Type: payment
💰 Montant: 5000 FCFA
✅ Statut mis à jour dans la base de données
```

---

### ✅ **4. Gestion Automatique des Groupes** 👥

Le bot gère automatiquement les groupes WhatsApp :

**Ce qui se passe :**
- Détecte automatiquement les nouveaux groupes
- Crée le groupe dans PostgreSQL s'il n'existe pas
- Assigne le groupe à une agence (via `DEFAULT_AGENCY_ID` ou crée une nouvelle)
- Stocke l'ID WhatsApp du groupe

**Résultat :**
```
✅ Group créé/enregistré dans la base de données
📋 Group ID: X
🏢 Agency ID: Y
```

---

### ✅ **5. Enregistrement dans PostgreSQL** 💾

Toutes les opérations sont enregistrées dans votre base PostgreSQL de dev :

- ✅ **Livraisons** → Table `deliveries`
- ✅ **Groupes** → Table `groups`
- ✅ **Historique** → Table `delivery_history`
- ✅ **Agences** → Table `agencies`

**Toutes les fonctionnalités testées fonctionnent :**
- CRUD complet
- Recherche
- Statistiques
- Foreign keys
- Index pour performance

---

### ✅ **6. Rapports Quotidiens Automatiques** 📊

Le bot génère et envoie automatiquement des rapports quotidiens :

**Ce qui se passe :**
- À 20:00 (par défaut), le bot génère un rapport
- Le rapport contient :
  - Nombre de livraisons du jour
  - Montants totaux
  - Statuts
  - Statistiques par groupe
- Le rapport peut être envoyé au groupe WhatsApp ou à un numéro spécifique

**Configuration dans `.env` :**
```
REPORT_TIME=20:00
REPORT_ENABLED=true
REPORT_SEND_TO_GROUP=true
```

---

## 🔍 Filtrage des Messages

### Si `GROUP_ID` est défini dans `.env` :

```
✅ Traite uniquement les messages du groupe spécifié
❌ Ignore tous les autres groupes
```

**Logs :**
```
⏭️  Skipped: Different group (GROUP_ID is configured)
💡 Tip: Remove GROUP_ID from .env to process all groups
```

### Si `GROUP_ID` n'est pas défini :

```
✅ Traite les messages de TOUS les groupes
✅ Crée automatiquement les groupes dans la base
```

**Logs :**
```
✅ Processing: Group message detected!
```

---

## ⚠️ Points Importants

### 1. **Base de Données**

- ✅ Le bot utilise **PostgreSQL de dev** (car `DATABASE_URL` est défini)
- ✅ Toutes les données sont sauvegardées dans PostgreSQL
- ⚠️ Les tables doivent exister (exécutez `npm run migrate` si nécessaire)

### 2. **Session WhatsApp**

- ✅ La session est sauvegardée dans `./auth/`
- ✅ Vous n'aurez besoin de scanner le QR code qu'une seule fois
- ✅ La session persiste entre les redémarrages

### 3. **Messages Privés**

- ❌ Le bot **ignore** les messages privés (1-à-1)
- ✅ Il traite uniquement les messages de groupes

### 4. **Messages du Bot**

- ❌ Le bot **ignore** ses propres messages (évite les boucles)

---

## 📊 Résumé : Ce qui est Actif

| Fonctionnalité | Status | Base de Données |
|----------------|--------|-----------------|
| Écoute des messages | ✅ Actif | PostgreSQL |
| Détection livraisons | ✅ Actif | PostgreSQL |
| Mise à jour par réponse | ✅ Actif | PostgreSQL |
| Gestion groupes | ✅ Actif | PostgreSQL |
| Historique | ✅ Actif | PostgreSQL |
| Rapports quotidiens | ✅ Actif | PostgreSQL |
| Recherche | ✅ Actif | PostgreSQL |
| Statistiques | ✅ Actif | PostgreSQL |

---

## 🎯 Prochaines Étapes

Une fois le bot démarré :

1. ✅ **Envoyez un message de livraison** dans un groupe WhatsApp
2. ✅ **Vérifiez les logs** pour voir la détection
3. ✅ **Vérifiez PostgreSQL** pour voir la livraison créée
4. ✅ **Répondez à un message** pour tester la mise à jour
5. ✅ **Vérifiez l'historique** dans la base de données

---

## 🐛 En Cas de Problème

### Bot ne se connecte pas à PostgreSQL :

```bash
# Vérifier la connexion
node src/scripts/check-db-connection.js
```

### Tables manquantes :

```bash
# Créer les tables
npm run migrate
# OU
node src/scripts/create-postgres-tables.js
```

### QR Code ne fonctionne pas :

- Vérifiez que le fichier `qr-code.png` est créé
- Ouvrez-le avec un visualiseur d'images
- Scannez-le avec WhatsApp

---

**Date de création** : 2025-12-12
**Dernière mise à jour** : 2025-12-12












