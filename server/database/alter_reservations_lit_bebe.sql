-- Ajoute lit_bebe sur reservations
-- Exécuter sur la base marocresidences

ALTER TABLE reservations
  ADD COLUMN lit_bebe TINYINT(1) NOT NULL DEFAULT 0 AFTER nbrs_bebe;
