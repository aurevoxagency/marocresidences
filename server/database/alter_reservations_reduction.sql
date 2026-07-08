-- Remplace montant_reduction par type_reduction + valeur_reduction
-- Exécuter sur la base marocresidences

ALTER TABLE reservations
    DROP COLUMN montant_reduction,
    ADD COLUMN type_reduction ENUM('%','MAD') DEFAULT NULL AFTER promotion_id,
    ADD COLUMN valeur_reduction DECIMAL(10,2) DEFAULT 0.00 AFTER type_reduction;
