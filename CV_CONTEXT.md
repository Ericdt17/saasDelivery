# 📋 Contexte de l'Application - LivSight (SaaS Delivery)

## 🎯 Vue d'ensemble du Projet

**LivSight** est une application SaaS complète de gestion de livraisons développée pour les agences de livraison. Le système permet de gérer les livraisons, les paiements, les expéditions et les rapports en temps réel, avec une intégration WhatsApp pour la réception automatique des commandes.

---

## 🏗️ Architecture Technique

### **Stack Technologique**

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 5.2
- **Base de données**: 
  - PostgreSQL (production)
  - SQLite (développement)
- **Authentification**: JWT (JSON Web Tokens) avec bcrypt
- **Intégration**: WhatsApp Web.js pour la réception automatique des messages
- **ORM**: Requêtes SQL natives avec support multi-DB
- **Process Manager**: PM2 pour la gestion des processus en production

#### Frontend
- **Framework**: React 18.3 avec TypeScript
- **Build Tool**: Vite 6.4
- **UI Library**: 
  - shadcn/ui (composants Radix UI)
  - Tailwind CSS pour le styling
- **State Management**: 
  - React Query (TanStack Query) pour la gestion des données serveur
  - Context API pour l'authentification et les agences
- **Routing**: React Router DOM v6
- **Form Management**: React Hook Form avec validation Zod
- **Charts**: Recharts pour les visualisations de données
- **Date Management**: date-fns

#### Infrastructure & Déploiement
- **Backend & Bot**: VPS Ubuntu avec PM2
- **Frontend**: Nginx (production) / Vercel (optionnel)
- **Base de données**: PostgreSQL sur Render
- **Reverse Proxy**: Nginx pour le routage API/Frontend
- **SSL/HTTPS**: Certbot avec Let's Encrypt

---

## ✨ Fonctionnalités Principales

### 1. **Gestion Multi-Agences**
- Système de rôles (super_admin, agency)
- Isolation des données par agence
- Filtrage automatique selon les permissions
- Gestion centralisée des agences (super admin)

### 2. **Gestion des Livraisons**
- CRUD complet (Créer, Lire, Modifier, Supprimer)
- Suivi des statuts (en attente, en cours, livré, annulé)
- Types de livraisons (livraison, pickup, expédition)
- Historique complet des modifications
- Recherche en temps réel
- Filtres avancés (statut, type, quartier, groupe, dates)
- Pagination et tri

### 3. **Intégration WhatsApp**
- Réception automatique des messages depuis des groupes WhatsApp
- Parsing intelligent des commandes (téléphone, nom, articles, montant)
- Support multi-groupes
- Activation/désactivation de groupes
- Gestion des sessions WhatsApp isolées

### 4. **Tableau de Bord & Statistiques**
- Statistiques en temps réel (livraisons, revenus, paiements)
- Visualisations graphiques (Recharts)
- Filtres par période (jour, semaine, mois)
- Statistiques par groupe WhatsApp
- Rapports quotidiens automatiques

### 5. **Gestion des Groupes**
- Liste et gestion des groupes WhatsApp
- Statistiques détaillées par groupe
- Activation/désactivation de groupes
- Vue détaillée avec livraisons associées

### 6. **Gestion des Paiements**
- Suivi des paiements par livraison
- Statuts de paiement (payé, impayé, partiel)
- Calcul automatique des totaux

### 7. **Rapports & Exports**
- Génération de rapports quotidiens
- Export de données (CSV, Excel)
- Historique des modifications
- Rapports personnalisables par date

### 8. **Gestion des Tarifs**
- Configuration des tarifs de livraison
- Calcul automatique des frais

### 9. **Sécurité**
- Authentification JWT sécurisée
- Hashing des mots de passe avec bcrypt
- Middleware d'authentification sur routes protégées
- Validation des entrées côté serveur
- Protection CORS configurée

---

## 🔧 Compétences Techniques Développées

### Backend Development
- ✅ Architecture RESTful API
- ✅ Gestion de bases de données (PostgreSQL, SQLite)
- ✅ Système d'authentification JWT
- ✅ Intégration d'APIs tierces (WhatsApp Web.js)
- ✅ Parsing et traitement de données textuelles
- ✅ Migration de schémas de base de données
- ✅ Gestion des erreurs et logging
- ✅ Optimisation des requêtes SQL

### Frontend Development
- ✅ Développement React moderne avec TypeScript
- ✅ Architecture de composants réutilisables
- ✅ Gestion d'état complexe (React Query, Context API)
- ✅ UI/UX moderne avec Tailwind CSS et shadcn/ui
- ✅ Formulaires complexes avec validation
- ✅ Visualisation de données (graphiques, tableaux)
- ✅ Gestion du routing et navigation
- ✅ Responsive design

### DevOps & Infrastructure
- ✅ Déploiement sur VPS (Ubuntu)
- ✅ Configuration Nginx (reverse proxy, SSL)
- ✅ Gestion de processus avec PM2
- ✅ Configuration DNS et domaines
- ✅ Mise en place de bases de données cloud (Render)
- ✅ Scripts de migration et déploiement
- ✅ Monitoring et logs

### Intégration & APIs
- ✅ Intégration WhatsApp (whatsapp-web.js)
- ✅ Parsing de messages structurés
- ✅ Gestion de sessions multiples
- ✅ Communication bot ↔ API

---

## 📊 Métriques & Complexité

- **Backend**: ~100+ fichiers JavaScript
- **Frontend**: ~50+ composants React/TypeScript
- **Base de données**: 4+ tables principales (agencies, groups, deliveries, delivery_history)
- **API Endpoints**: 15+ endpoints REST
- **Pages Frontend**: 14 pages principales
- **Temps de développement**: Application complète full-stack

---

## 🚀 Déploiement Production

- **Architecture**: Monorepo avec backend et frontend séparés
- **Backend**: VPS Ubuntu avec PM2 (processus WhatsApp Bot + API Server)
- **Frontend**: Nginx servant les fichiers statiques
- **Base de données**: PostgreSQL sur Render (cloud)
- **Domaines**: Configuration DNS avec sous-domaines (api.livsight.com, app.livsight.com)
- **SSL**: Certificats Let's Encrypt pour HTTPS

---

## 📝 Description pour CV (Version Courte)

**LivSight - Application SaaS de Gestion de Livraisons**

Développement d'une application SaaS complète de gestion de livraisons avec intégration WhatsApp. 
- **Backend**: API REST Node.js/Express avec authentification JWT, support multi-agences, et bot WhatsApp pour réception automatique des commandes
- **Frontend**: Interface React/TypeScript moderne avec tableau de bord en temps réel, gestion des livraisons, statistiques et rapports
- **Base de données**: PostgreSQL avec migrations automatiques
- **Déploiement**: Architecture VPS avec Nginx, PM2, et base de données cloud
- **Fonctionnalités**: CRUD livraisons, multi-agences, intégration WhatsApp, statistiques temps réel, exports de données

**Technologies**: Node.js, Express.js, React, TypeScript, PostgreSQL, WhatsApp Web.js, Tailwind CSS, shadcn/ui, React Query, PM2, Nginx

---

## 📝 Description pour CV (Version Détaillée)

**LivSight - Plateforme SaaS de Gestion de Livraisons Multi-Agences**

Conception et développement d'une application SaaS complète permettant aux agences de livraison de gérer leurs opérations quotidiennes avec intégration WhatsApp.

**Développement Backend (Node.js/Express)**:
- Architecture RESTful API avec 15+ endpoints pour la gestion des livraisons, statistiques, agences et groupes
- Système d'authentification JWT avec rôles (super_admin, agency) et isolation des données par agence
- Intégration WhatsApp via whatsapp-web.js pour la réception automatique et le parsing des commandes depuis des groupes
- Support multi-bases de données (PostgreSQL en production, SQLite en développement) avec migrations automatiques
- Parsing intelligent de messages texte structurés pour création automatique de livraisons

**Développement Frontend (React/TypeScript)**:
- Interface utilisateur moderne avec 14 pages principales (tableau de bord, livraisons, groupes, paiements, rapports, etc.)
- Architecture de composants réutilisables avec shadcn/ui et Tailwind CSS
- Gestion d'état avancée avec React Query pour les données serveur et Context API pour l'authentification
- Tableaux de données avec pagination, filtres avancés (statut, type, dates, groupes) et recherche en temps réel
- Visualisations de données avec Recharts (graphiques, statistiques quotidiennes/hebdomadaires/mensuelles)
- Formulaires complexes avec validation Zod et React Hook Form

**Infrastructure & DevOps**:
- Déploiement sur VPS Ubuntu avec configuration Nginx (reverse proxy, SSL/HTTPS)
- Gestion de processus avec PM2 pour le bot WhatsApp et l'API server
- Configuration DNS avec sous-domaines (api.livsight.com, app.livsight.com)
- Base de données PostgreSQL hébergée sur Render avec scripts de migration

**Fonctionnalités Clés**:
- Gestion complète des livraisons (CRUD) avec historique des modifications
- Support multi-agences avec isolation des données et permissions granulaires
- Intégration WhatsApp pour réception automatique des commandes depuis groupes
- Statistiques en temps réel avec filtres par période et visualisations graphiques
- Gestion des groupes WhatsApp (activation/désactivation, statistiques par groupe)
- Export de données (CSV, Excel) et génération de rapports

**Technologies**: Node.js, Express.js, React 18, TypeScript, PostgreSQL, SQLite, WhatsApp Web.js, JWT, bcrypt, React Query, Tailwind CSS, shadcn/ui, Recharts, PM2, Nginx, Vite

---

## 🎓 Points Forts à Mettre en Avant

1. **Full-Stack Development**: Maîtrise complète du développement backend et frontend
2. **Intégration d'APIs Tierces**: Expérience avec WhatsApp Web.js et parsing de données
3. **Architecture Multi-Tenant**: Système multi-agences avec isolation des données
4. **DevOps**: Expérience en déploiement production (VPS, Nginx, PM2, bases de données cloud)
5. **UI/UX Moderne**: Interface utilisateur professionnelle avec composants modernes
6. **Gestion de Projet**: Application complète de A à Z (conception, développement, déploiement)




