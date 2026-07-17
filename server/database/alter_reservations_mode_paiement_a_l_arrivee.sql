-- Renomme le mode de paiement a_la_livraison → a_l_arrivee
-- Exécuter sur la base marocresidences (après alter_reservations_mode_paiement.sql)

-- 1) Ajouter temporairement la nouvelle valeur ENUM
ALTER TABLE reservations
  MODIFY COLUMN mode_paiement ENUM('en_ligne', 'a_la_livraison', 'a_l_arrivee') NULL DEFAULT NULL;

-- 2) Migrer les données existantes
UPDATE reservations
SET mode_paiement = 'a_l_arrivee'
WHERE mode_paiement = 'a_la_livraison';

-- 3) Retirer l'ancienne valeur ENUM
ALTER TABLE reservations
  MODIFY COLUMN mode_paiement ENUM('en_ligne', 'a_l_arrivee') NULL DEFAULT NULL;
