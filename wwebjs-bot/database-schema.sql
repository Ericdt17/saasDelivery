-- =====================================================
-- Schema SQL pour PostgreSQL
-- Base de données: SaaS Delivery Management
-- =====================================================

-- Table: deliveries
-- Stocke toutes les livraisons
CREATE TABLE IF NOT EXISTS deliveries (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255),
    items TEXT,
    amount_due DECIMAL(10, 2) DEFAULT 0,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    quartier VARCHAR(255),
    notes TEXT,
    carrier VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: delivery_history
-- Historique des modifications pour chaque livraison
CREATE TABLE IF NOT EXISTS delivery_history (
    id SERIAL PRIMARY KEY,
    delivery_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    actor VARCHAR(100) DEFAULT 'bot',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
);

-- =====================================================
-- Indexes pour améliorer les performances
-- =====================================================

-- Index sur le numéro de téléphone (recherche fréquente)
CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries(phone);

-- Index sur le statut (filtrage par statut)
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- Index sur la date de création (tri chronologique)
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);

-- Index sur delivery_id dans l'historique (joins fréquents)
CREATE INDEX IF NOT EXISTS idx_history_delivery_id ON delivery_history(delivery_id);

-- =====================================================
-- Notes
-- =====================================================
-- Ce schéma est automatiquement créé par l'application au démarrage
-- si les tables n'existent pas déjà.
-- 
-- Statuts possibles pour 'status':
-- - 'pending' (en attente)
-- - 'in_transit' (en transit)
-- - 'delivered' (livré)
-- - 'cancelled' (annulé)
--
-- Types d'actions dans delivery_history:
-- - 'created' (création)
-- - 'updated' (modification)
-- - 'status_changed' (changement de statut)
-- - 'payment_received' (paiement reçu)
-- =====================================================

