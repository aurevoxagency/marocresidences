-- Taxe de séjour (par nuit / par occupant) sur maisons_hotes
-- Montant calculé sur reservations : taxe_de_sejour * nb_nuits * nb_occupants

ALTER TABLE maisons_hotes
  ADD COLUMN taxe_de_sejour DECIMAL(10,2) DEFAULT 0.00;

ALTER TABLE reservations
  ADD COLUMN taxe_sejour_montant DECIMAL(10,2) DEFAULT 0.00 AFTER prix_total_ttc;
