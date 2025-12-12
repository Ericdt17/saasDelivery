# 📊 Schéma de Base de Données PostgreSQL

Ce document contient le schéma SQL complet pour la base de données PostgreSQL.

## Tables

### Table: `deliveries`

Stoque toutes les informations des livraisons.

| Colonne | Type | Description | Contraintes |
|---------|------|-------------|-------------|
| `id` | SERIAL | Identifiant unique | PRIMARY KEY, AUTO_INCREMENT |
| `phone` | VARCHAR(20) | Numéro de téléphone du client | NOT NULL |
| `customer_name` | VARCHAR(255) | Nom du client | NULL |
| `items` | TEXT | Description des articles | NULL |
| `amount_due` | DECIMAL(10,2) | Montant dû | DEFAULT 0 |
| `amount_paid` | DECIMAL(10,2) | Montant payé | DEFAULT 0 |
| `status` | VARCHAR(20) | Statut de la livraison | DEFAULT 'pending' |
| `quartier` | VARCHAR(255) | Quartier/Zone de livraison | NULL |
| `notes` | TEXT | Notes supplémentaires | NULL |
| `carrier` | VARCHAR(255) | Nom du livreur | NULL |
| `created_at` | TIMESTAMP | Date de création | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | Date de mise à jour | DEFAULT CURRENT_TIMESTAMP |

**Statuts possibles:**
- `pending` - En attente
- `in_transit` - En transit
- `delivered` - Livré
- `cancelled` - Annulé

### Table: `delivery_history`

Historique des modifications pour chaque livraison.

| Colonne | Type | Description | Contraintes |
|---------|------|-------------|-------------|
| `id` | SERIAL | Identifiant unique | PRIMARY KEY, AUTO_INCREMENT |
| `delivery_id` | INTEGER | ID de la livraison | NOT NULL, FOREIGN KEY |
| `action` | VARCHAR(50) | Type d'action | NOT NULL |
| `details` | TEXT | Détails de l'action | NULL |
| `actor` | VARCHAR(100) | Auteur de l'action | DEFAULT 'bot' |
| `created_at` | TIMESTAMP | Date de l'action | DEFAULT CURRENT_TIMESTAMP |

**Types d'actions:**
- `created` - Création de la livraison
- `updated` - Modification de la livraison
- `status_changed` - Changement de statut
- `payment_received` - Paiement reçu

## Index

Les index suivants sont créés pour optimiser les performances:

1. `idx_deliveries_phone` - Sur `deliveries(phone)` pour les recherches par téléphone
2. `idx_deliveries_status` - Sur `deliveries(status)` pour le filtrage par statut
3. `idx_deliveries_created_at` - Sur `deliveries(created_at)` pour le tri chronologique
4. `idx_history_delivery_id` - Sur `delivery_history(delivery_id)` pour les jointures

## Fichier SQL

Le fichier SQL complet est disponible dans: `database-schema.sql`

## Installation

### Option 1: Automatique (recommandé)

L'application crée automatiquement les tables au premier démarrage si elles n'existent pas.

### Option 2: Manuel

Si vous préférez créer les tables manuellement:

```bash
psql -h your-host -U your-user -d your-database -f database-schema.sql
```

Ou via l'interface Render:

1. Aller à votre base de données PostgreSQL sur Render
2. Cliquer sur "Connect" → "PSQL"
3. Copier et coller le contenu de `database-schema.sql`

## Notes

- Les tables utilisent `CREATE TABLE IF NOT EXISTS`, donc il est sûr d'exécuter le script plusieurs fois
- Les index utilisent `CREATE INDEX IF NOT EXISTS` pour éviter les erreurs si ils existent déjà
- La table `delivery_history` a une contrainte `ON DELETE CASCADE` - si une livraison est supprimée, son historique est aussi supprimé




