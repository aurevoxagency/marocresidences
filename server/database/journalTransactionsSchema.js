const { pool } = require("./db");

async function ensureJournalTransactionsSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reference VARCHAR(40) NOT NULL,
        type_mouvement ENUM(
          'paiement',
          'acompte',
          'remboursement',
          'depot_garantie',
          'retenue_depot',
          'autre'
        ) NOT NULL DEFAULT 'paiement',
        sens ENUM('entree', 'sortie') NOT NULL DEFAULT 'entree',
        montant DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        mode_paiement ENUM('especes', 'carte', 'virement', 'cheque', 'autre') NULL,
        libelle VARCHAR(255) NOT NULL,
        reservation_id INT NULL,
        facture_id INT NULL,
        commande_id INT NULL,
        client_id INT NULL,
        maison_id INT NULL,
        effectue_par VARCHAR(100) NULL,
        notes TEXT NULL,
        date_transaction DATETIME NOT NULL,
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_journal_reference (reference),
        INDEX idx_journal_date (date_transaction),
        INDEX idx_journal_type (type_mouvement),
        INDEX idx_journal_maison (maison_id),
        INDEX idx_journal_client (client_id),
        INDEX idx_journal_reservation (reservation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("[DB] Table journal_transactions prête.");
  } catch (error) {
    console.warn("[DB] Impossible de créer journal_transactions:", error.message);
  }
}

module.exports = {
  ensureJournalTransactionsSchema,
};
