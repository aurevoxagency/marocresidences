-- Trace le code promo saisi au moment de la réservation
-- Exécuter sur la base marocresidences

ALTER TABLE reservations
  ADD COLUMN code_promo VARCHAR(50) DEFAULT NULL AFTER promotion_id;
