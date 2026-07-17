-- Ajoute le mode de paiement choisi sur les réservations
-- Valeurs : en_ligne | a_l_arrivee
-- Exécuter sur la base marocresidences

ALTER TABLE reservations
  ADD COLUMN mode_paiement ENUM('en_ligne', 'a_l_arrivee') NULL DEFAULT NULL
  AFTER statut_paiement;

-- Optionnel : index utile pour les stats / filtres dashboard
CREATE INDEX idx_reservations_mode_paiement ON reservations (mode_paiement);
