const { pool } = require("../../database/db");

const TYPES_MOUVEMENT = new Set([
  "paiement",
  "acompte",
  "remboursement",
  "depot_garantie",
  "retenue_depot",
  "autre",
]);

const SENS = new Set(["entree", "sortie"]);

const MODES_PAIEMENT = new Set(["especes", "carte", "virement", "cheque", "autre"]);

function emptyToNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return value;
}

function toIntOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function toDecimalOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : fallback;
}

function toDateTimeOrNull(value) {
  const raw = emptyToNull(value);

  if (!raw) {
    return null;
  }

  return String(raw).trim().replace("T", " ").slice(0, 19) || null;
}

function pickTransactionFields(body = {}) {
  const type = emptyToNull(body.type_mouvement);
  const sens = emptyToNull(body.sens);
  const mode = emptyToNull(body.mode_paiement);

  return {
    type_mouvement: TYPES_MOUVEMENT.has(type) ? type : "paiement",
    sens: SENS.has(sens) ? sens : "entree",
    montant: toDecimalOrDefault(body.montant, 0),
    mode_paiement: MODES_PAIEMENT.has(mode) ? mode : null,
    libelle: emptyToNull(body.libelle?.trim()) || "Mouvement",
    reservation_id: toIntOrNull(body.reservation_id),
    facture_id: toIntOrNull(body.facture_id),
    commande_id: toIntOrNull(body.commande_id),
    client_id: toIntOrNull(body.client_id),
    maison_id: toIntOrNull(body.maison_id),
    effectue_par: emptyToNull(body.effectue_par?.trim()),
    notes: emptyToNull(body.notes?.trim()),
    date_transaction:
      toDateTimeOrNull(body.date_transaction) ||
      new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}

function validateTransactionFields(fields) {
  if (!fields.libelle) {
    return "Le libellé est requis.";
  }

  if (fields.montant < 0) {
    return "Le montant ne peut pas être négatif.";
  }

  if (!fields.date_transaction) {
    return "La date de transaction est requise.";
  }

  return null;
}

async function generateReference(connection) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `TRX-${datePart}`;

  const [rows] = await connection.query(
    `
      SELECT reference
      FROM journal_transactions
      WHERE reference LIKE ?
      ORDER BY reference DESC
      LIMIT 1
    `,
    [`${prefix}-%`]
  );

  let next = 1;

  if (rows.length > 0) {
    const match = String(rows[0].reference).match(/-(\d+)$/);
    if (match) {
      next = Number(match[1]) + 1;
    }
  }

  return `${prefix}-${String(next).padStart(4, "0")}`;
}

const TRANSACTION_SELECT = `
  SELECT
    jt.*,
    CONCAT(COALESCE(c.prenom, ''), ' ', COALESCE(c.nom, '')) AS client_nom,
    m.nom AS maison_nom,
    r.reference AS reservation_reference,
    f.numero_facture AS facture_numero,
    cmd.reference AS commande_reference
  FROM journal_transactions jt
  LEFT JOIN clients c ON c.id = jt.client_id
  LEFT JOIN maisons_hotes m ON m.id = jt.maison_id
  LEFT JOIN reservations r ON r.id = jt.reservation_id
  LEFT JOIN factures f ON f.id = jt.facture_id
  LEFT JOIN commandes cmd ON cmd.id = jt.commande_id
`;

async function fetchTransactionById(connection, id) {
  const [rows] = await connection.query(`${TRANSACTION_SELECT} WHERE jt.id = ? LIMIT 1`, [
    id,
  ]);

  if (rows.length === 0) {
    return null;
  }

  return {
    ...rows[0],
    client_nom: rows[0].client_nom?.trim() || null,
  };
}

async function getTransactions(req, res) {
  try {
    const maisonId = Number(req.query.maison_id);
    const type = req.query.type_mouvement;
    const sens = req.query.sens;
    const params = [];
    let query = `${TRANSACTION_SELECT} WHERE 1 = 1`;

    if (maisonId) {
      query += " AND jt.maison_id = ?";
      params.push(maisonId);
    }

    if (TYPES_MOUVEMENT.has(type)) {
      query += " AND jt.type_mouvement = ?";
      params.push(type);
    }

    if (SENS.has(sens)) {
      query += " AND jt.sens = ?";
      params.push(sens);
    }

    query += " ORDER BY jt.date_transaction DESC, jt.id DESC";

    const [rows] = await pool.query(query, params);

    return res.status(200).json(
      rows.map((row) => ({
        ...row,
        client_nom: row.client_nom?.trim() || null,
      }))
    );
  } catch (error) {
    console.error("Error fetching journal transactions:", error);
    return res.status(500).json({ message: "Impossible de charger le journal des transactions." });
  }
}

async function getTransactionById(req, res) {
  try {
    const transaction = await fetchTransactionById(pool, req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction introuvable." });
    }

    return res.status(200).json(transaction);
  } catch (error) {
    console.error("Error fetching journal transaction:", error);
    return res.status(500).json({ message: "Impossible de charger la transaction." });
  }
}

async function createTransaction(req, res) {
  const connection = await pool.getConnection();

  try {
    const fields = pickTransactionFields(req.body);
    const validationError = validateTransactionFields(fields);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const reference = await generateReference(connection);

    const [result] = await connection.query(
      `
        INSERT INTO journal_transactions (
          reference, type_mouvement, sens, montant, mode_paiement, libelle,
          reservation_id, facture_id, commande_id, client_id, maison_id,
          effectue_par, notes, date_transaction
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        reference,
        fields.type_mouvement,
        fields.sens,
        fields.montant,
        fields.mode_paiement,
        fields.libelle,
        fields.reservation_id,
        fields.facture_id,
        fields.commande_id,
        fields.client_id,
        fields.maison_id,
        fields.effectue_par,
        fields.notes,
        fields.date_transaction,
      ]
    );

    const transaction = await fetchTransactionById(connection, result.insertId);

    return res.status(201).json({
      message: "Transaction enregistrée.",
      transaction,
    });
  } catch (error) {
    console.error("Error creating journal transaction:", error);
    return res.status(500).json({ message: "Impossible d'enregistrer la transaction." });
  } finally {
    connection.release();
  }
}

async function updateTransaction(req, res) {
  const connection = await pool.getConnection();

  try {
    const id = Number(req.params.id);
    const existing = await fetchTransactionById(connection, id);

    if (!existing) {
      return res.status(404).json({ message: "Transaction introuvable." });
    }

    const fields = pickTransactionFields(req.body);
    const validationError = validateTransactionFields(fields);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await connection.query(
      `
        UPDATE journal_transactions SET
          type_mouvement = ?,
          sens = ?,
          montant = ?,
          mode_paiement = ?,
          libelle = ?,
          reservation_id = ?,
          facture_id = ?,
          commande_id = ?,
          client_id = ?,
          maison_id = ?,
          effectue_par = ?,
          notes = ?,
          date_transaction = ?
        WHERE id = ?
      `,
      [
        fields.type_mouvement,
        fields.sens,
        fields.montant,
        fields.mode_paiement,
        fields.libelle,
        fields.reservation_id,
        fields.facture_id,
        fields.commande_id,
        fields.client_id,
        fields.maison_id,
        fields.effectue_par,
        fields.notes,
        fields.date_transaction,
        id,
      ]
    );

    const transaction = await fetchTransactionById(connection, id);

    return res.status(200).json({
      message: "Transaction mise à jour.",
      transaction,
    });
  } catch (error) {
    console.error("Error updating journal transaction:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour la transaction." });
  } finally {
    connection.release();
  }
}

async function deleteTransaction(req, res) {
  try {
    const [result] = await pool.query("DELETE FROM journal_transactions WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Transaction introuvable." });
    }

    return res.status(200).json({ message: "Transaction supprimée." });
  } catch (error) {
    console.error("Error deleting journal transaction:", error);
    return res.status(500).json({ message: "Impossible de supprimer la transaction." });
  }
}

module.exports = {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
