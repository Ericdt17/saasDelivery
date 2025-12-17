# Configuration Complète : Domaines, API, Frontend et Bot

## 📋 Vue d'ensemble

Ce document décrit la configuration complète du système SaaS Delivery, incluant :
- Configuration des sous-domaines DNS
- Configuration HTTPS/SSL pour l'API
- Déploiement du frontend sur Vercel
- Configuration CORS
- Configuration du bot WhatsApp avec isolation de session

## 🌐 Structure des Domaines

### Domaines configurés

| Sous-domaine | Usage | Hébergement | Status |
|-------------|-------|-------------|--------|
| `api.livsight.com` | API Backend (Node.js/Express) | VPS (157.173.118.238) | ✅ Configuré |
| `app.livsight.com` | Application SaaS (Frontend React) | Vercel | ✅ Configuré |
| `www.livsight.com` | Landing Page | À configurer | ⏳ En attente |

## 🔧 Configuration DNS

### 1. Enregistrement pour l'API (`api.livsight.com`)

**Type :** Enregistrement A  
**Configuration :**
- **HÉBERGEUR (HOST) :** `api`
- **TYPE :** `A`
- **PRIORITÉ :** (vide)
- **TTL :** `4 h`
- **ADRESSE IP :** `157.173.118.238`

**Résultat :** `api.livsight.com` → `157.173.118.238`

### 2. Enregistrement pour l'Application (`app.livsight.com`)

**Type :** Enregistrement CNAME  
**Configuration :**
- **HÉBERGEUR (HOST) :** `app`
- **TYPE :** `CNAME`
- **PRIORITÉ :** (vide)
- **TTL :** `4 h`
- **VALEUR/CNAME :** (valeur fournie par Vercel, ex: `cname.vercel-dns.com`)

**Résultat :** `app.livsight.com` → Vercel (frontend)

### 3. Enregistrement pour la Landing Page (`www.livsight.com`)

**Type :** Enregistrement A  
**Configuration :**
- **HÉBERGEUR (HOST) :** `www`
- **TYPE :** `A`
- **PRIORITÉ :** (vide)
- **TTL :** `4 h`
- **ADRESSE IP :** `157.173.118.238` (ou IP du serveur de la landing page)

**Résultat :** `www.livsight.com` → Serveur de la landing page

## 🔒 Configuration HTTPS/SSL pour l'API

### Étape 1 : Installation de nginx et certbot

```bash
# Sur le VPS
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Étape 2 : Configuration nginx comme reverse proxy

**Fichier créé :** `/etc/nginx/sites-available/api`

```nginx
server {
    listen 80;
    server_name api.livsight.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Activation de la configuration :**
```bash
sudo ln -s /etc/nginx/sites-available/api /etc/nginx/sites-enabled/
sudo nginx -t  # Vérifier la configuration
sudo systemctl restart nginx
```

### Étape 3 : Obtention du certificat SSL

```bash
sudo certbot --nginx -d api.livsight.com
```

Certbot configure automatiquement :
- Certificat SSL Let's Encrypt
- Redirection HTTP → HTTPS
- Renouvellement automatique du certificat

**Résultat :** `https://api.livsight.com` accessible avec certificat SSL valide

## 🚀 Configuration Vercel (Frontend)

### Variables d'environnement configurées

Dans Vercel Dashboard → Settings → Environment Variables :

| Variable | Valeur | Environnements |
|----------|--------|----------------|
| `VITE_API_BASE_URL` | `https://api.livsight.com` | Production, Preview, Development |

### Configuration du domaine personnalisé

1. **Vercel Dashboard** → Settings → Domains
2. **Ajout du domaine :** `app.livsight.com`
3. **Configuration DNS :** CNAME pointant vers Vercel
4. **SSL automatique :** Vercel configure automatiquement HTTPS

**Résultat :** `https://app.livsight.com` → Frontend React sur Vercel

### Fichier de configuration Vercel

**Fichier :** `client/vercel.json`

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 🔐 Configuration CORS (API Backend)

### Variables d'environnement sur le VPS

**Fichier :** `/opt/saasDelivery/wwebjs-bot/.env` (ou variables PM2)

```bash
ALLOWED_ORIGINS=https://saas-delivery-lemon.vercel.app,https://app.livsight.com
NODE_ENV=production
```

**Origines autorisées :**
- `https://saas-delivery-lemon.vercel.app` (URL Vercel par défaut)
- `https://app.livsight.com` (domaine personnalisé)

### Configuration CORS dans le code

**Fichier :** `wwebjs-bot/src/api/server.js`

La configuration CORS :
- Autorise les origines listées dans `ALLOWED_ORIGINS`
- Permet les credentials (cookies)
- Supporte les méthodes : GET, POST, PUT, DELETE, OPTIONS

**Redémarrage de l'API :**
```bash
pm2 restart api-server
```

## 🤖 Configuration du Bot WhatsApp

### Isolation de session par environnement

**Problème résolu :** Le bot utilisait la même session pour tous les environnements (local, dev, prod), causant des conflits.

**Solution :** Utilisation de `clientId` dans `LocalAuth` pour isoler les sessions.

### Configuration

**Fichiers modifiés :**
- `wwebjs-bot/src/index.js`
- `wwebjs-bot/src/list-groups.js`
- `wwebjs-bot/src/send-message.js`
- `wwebjs-bot/src/send-report.js`
- `wwebjs-bot/src/test-send.js`

**Changement :**
```javascript
// Avant
authStrategy: new LocalAuth({
  dataPath: process.env.WHATSAPP_SESSION_PATH || "./auth-dev"
})

// Après
authStrategy: new LocalAuth({
  clientId: process.env.CLIENT_ID || "delivery-bot-default"
})
```

### Variables d'environnement pour le bot

**Local (développement) :**
```bash
CLIENT_ID=delivery-bot-local
DATABASE_URL=  # Vide pour utiliser SQLite
```

**Dev (Render) :**
```bash
CLIENT_ID=saas-delivery-bot-dev
DATABASE_URL=postgresql://...  # PostgreSQL dev
```

**Production :**
```bash
CLIENT_ID=saas-delivery-bot-prod
DATABASE_URL=postgresql://...  # PostgreSQL prod
```

**Résultat :** Chaque environnement a sa propre session WhatsApp isolée.

### Amélioration du QR Code pour déploiement distant

**Fichier :** `wwebjs-bot/src/index.js`

Le bot génère maintenant :
1. QR code ASCII dans les logs
2. Fichier image `qr-code.png` (400px)
3. Raw QR data pour générateurs en ligne
4. Base64 data URL pour affichage direct dans le navigateur

**Utile pour :** Scanner le QR code depuis les logs Render/Cloud

## 🗄️ Configuration Base de Données

### Logique de connexion

**Fichier :** `wwebjs-bot/src/db/index.js`

Le système choisit automatiquement :
- **PostgreSQL** si `DATABASE_URL` est défini
- **SQLite** si `DATABASE_URL` n'est pas défini

**Variables d'environnement :**
```bash
# PostgreSQL (dev/prod)
DATABASE_URL=postgresql://user:password@host:port/database

# SQLite (local - par défaut si DATABASE_URL vide)
# Utilise le fichier : wwebjs-bot/data/bot.db
```

### Correction du bug de requête PostgreSQL

**Problème :** Les requêtes avec `LIMIT 1` retournaient un objet unique, mais le code traitait le résultat comme un tableau.

**Fichier corrigé :** `wwebjs-bot/src/utils/group-manager.js`

**Solution :** Gestion correcte du type de retour (objet unique pour PostgreSQL avec LIMIT 1).

## 📊 Logging et Debug

### Logs de connexion base de données

**Fichier :** `wwebjs-bot/src/db/index.js`

Le système affiche maintenant :
- Type de base de données (PostgreSQL/SQLite)
- Host et nom de la base
- Test de connexion avec comptage des groupes
- Exemples de groupes dans la base

### Logs de configuration environnement

**Fichier :** `wwebjs-bot/src/index.js`

Affichage au démarrage :
- `NODE_ENV`
- `CLIENT_ID`
- `DATABASE_URL` (masqué pour sécurité)

### Logs de recherche de groupe

**Fichier :** `wwebjs-bot/src/utils/group-manager.js`

Logs détaillés pour :
- Recherche de groupe dans la base
- Vérification du statut actif/inactif
- Détection de mismatch d'ID
- Messages d'erreur clairs

## 🔄 Workflow de Déploiement

### Frontend (Vercel)

1. **Push vers GitHub** (branche `main`)
2. **Vercel détecte automatiquement** le push
3. **Build automatique** avec `npm run build`
4. **Déploiement automatique** sur `app.livsight.com`

### Backend API (VPS)

1. **Push vers GitHub** (branche `dev` ou `main`)
2. **Pull sur le VPS :**
   ```bash
   cd /opt/saasDelivery/wwebjs-bot
   git pull origin dev
   ```
3. **Redémarrage avec PM2 :**
   ```bash
   pm2 restart api-server
   ```

### Bot WhatsApp (Render)

1. **Push vers GitHub** (branche `dev`)
2. **Render détecte automatiquement** le push
3. **Build et redémarrage automatique**
4. **QR code disponible** dans les logs si nouvelle session

## 🧪 Tests et Vérification

### Vérifier l'API

```bash
# Test depuis le VPS
curl https://api.livsight.com/api/v1/health

# Test depuis votre machine
curl https://api.livsight.com/api/v1/health
```

**Résultat attendu :**
```json
{
  "status": "ok",
  "timestamp": "2024-01-XX...",
  "service": "delivery-bot-api",
  "version": "1.0.0"
}
```

### Vérifier le Frontend

1. Ouvrir `https://app.livsight.com`
2. Vérifier que l'application se charge
3. Vérifier la console du navigateur (F12) - pas d'erreurs CORS ou SSL

### Vérifier CORS

Dans la console du navigateur, vérifier qu'il n'y a pas d'erreurs :
- ❌ `CORS policy: No 'Access-Control-Allow-Origin'`
- ✅ Requêtes API réussies

### Vérifier le Bot

**Logs Render :**
```bash
# Dans Render Dashboard → Logs
# Chercher :
✅ "Client is ready!"
✅ "Message event listener is registered"
✅ "Group found in database"
```

## 📝 Checklist de Configuration Complète

### DNS
- [x] Enregistrement A pour `api.livsight.com`
- [x] Enregistrement CNAME pour `app.livsight.com`
- [x] Enregistrement A pour `www.livsight.com`

### API Backend (VPS)
- [x] nginx installé et configuré
- [x] Certificat SSL obtenu pour `api.livsight.com`
- [x] Reverse proxy configuré (port 3001)
- [x] CORS configuré avec `ALLOWED_ORIGINS`
- [x] API redémarrée avec PM2

### Frontend (Vercel)
- [x] Variable `VITE_API_BASE_URL` configurée
- [x] Domaine `app.livsight.com` configuré
- [x] SSL automatique activé par Vercel
- [x] Build et déploiement fonctionnels

### Bot WhatsApp
- [x] Isolation de session avec `CLIENT_ID`
- [x] Configuration PostgreSQL pour dev/prod
- [x] QR code amélioré pour déploiement distant
- [x] Logs de debug améliorés

## 🔍 Dépannage

### Problème : ERR_SSL_PROTOCOL_ERROR

**Cause :** Frontend HTTPS essaie de se connecter à API HTTP

**Solution :** Configurer HTTPS pour l'API (voir section "Configuration HTTPS/SSL")

### Problème : CORS Error

**Cause :** Origine non autorisée dans `ALLOWED_ORIGINS`

**Solution :** Ajouter l'origine dans `ALLOWED_ORIGINS` et redémarrer l'API

### Problème : Bot ne trouve pas les groupes

**Cause :** Bug de gestion des résultats PostgreSQL avec LIMIT 1

**Solution :** Vérifier que le code utilise la version corrigée de `group-manager.js`

### Problème : Mixed Content Error

**Cause :** Page HTTPS essaie de charger des ressources HTTP

**Solution :** Toutes les URLs doivent être en HTTPS

## 📚 Références

- **Documentation nginx :** https://nginx.org/en/docs/
- **Documentation Let's Encrypt :** https://letsencrypt.org/docs/
- **Documentation Vercel :** https://vercel.com/docs
- **Documentation whatsapp-web.js :** https://wwebjs.dev/

## 🔄 Maintenance

### Renouvellement du certificat SSL

Let's Encrypt renouvelle automatiquement les certificats. Vérifier avec :
```bash
sudo certbot certificates
```

### Mise à jour des dépendances

**Frontend :**
```bash
cd client
npm update
npm run build
```

**Backend :**
```bash
cd wwebjs-bot
npm update
pm2 restart api-server
```

### Sauvegarde de la base de données

**PostgreSQL :**
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

**SQLite :**
```bash
cp wwebjs-bot/data/bot.db backup_$(date +%Y%m%d).db
```

---

**Dernière mise à jour :** Janvier 2025  
**Version :** 1.0.0

