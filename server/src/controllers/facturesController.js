const { pool } = require("../../database/db");

const STATUTS = new Set([
  "brouillon",
  "emise",
  "payee_partiellement",
  "payee",
  "annulee",
  "en_retard",
]);
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

function toIntOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function toDecimalOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : fallback;
}

function pickFactureItems(body = {}) {
  const raw = Array.isArray(body.items) ? body.items : [];
  const defaultTva = toDecimalOrDefault(body.taux_tva, 10);

  return raw
    .map((item, index) => {
      const description = item.description?.trim();
      if (!description) {
        return null;
      }

      const quantite = toDecimalOrDefault(item.quantite, 1);
      const prixUnitaire = toDecimalOrDefault(item.prix_unitaire, 0);
      const tauxTva = toDecimalOrDefault(item.taux_tva, defaultTva);
      const prixTotalHt =
        item.prix_total_ht != null
          ? toDecimalOrDefault(item.prix_total_ht)
          : Math.round(quantite * prixUnitaire * 100) / 100;
      const prixTotalTtc =
        item.prix_total_ttc != null
          ? toDecimalOrDefault(item.prix_total_ttc)
          : Math.round(prixTotalHt * (1 + tauxTva / 100) * 100) / 100;

      return {
        description,
        quantite,
        prix_unitaire: prixUnitaire,
        taux_tva: tauxTva,
        prix_total_ht: prixTotalHt,
        prix_total_ttc: prixTotalTtc,
        ordre: toIntOrDefault(item.ordre, index),
      };
    })
    .filter(Boolean);
}

function computeTotalsFromItems(items, body = {}) {
  const montantHt = items.reduce((sum, item) => sum + item.prix_total_ht, 0);
  const montantTtc = items.reduce((sum, item) => sum + item.prix_total_ttc, 0);
  const montantTva = Math.round((montantTtc - montantHt) * 100) / 100;
  const tauxTva =
    body.taux_tva != null
      ? toDecimalOrDefault(body.taux_tva, 10)
      : montantHt > 0
        ? Math.round((montantTva / montantHt) * 10000) / 100
        : 10;
  const montantPaye = toDecimalOrDefault(body.montant_paye, 0);
  const montantRestant =
    body.montant_restant != null
      ? toDecimalOrDefault(body.montant_restant)
      : Math.max(0, Math.round((montantTtc - montantPaye) * 100) / 100);

  return {
    montant_ht: Math.round(montantHt * 100) / 100,
    taux_tva: tauxTva,
    montant_tva: montantTva,
    montant_ttc: Math.round(montantTtc * 100) / 100,
    montant_paye: montantPaye,
    montant_restant: montantRestant,
  };
}

function pickFactureFields(body = {}, items = []) {
  const totals = computeTotalsFromItems(items, body);
  const modePaiement = MODES_PAIEMENT.has(body.mode_paiement) ? body.mode_paiement : null;

  return {
    reservation_id: toIntOrNull(body.reservation_id),
    commande_id: toIntOrNull(body.commande_id),
    client_id: toIntOrDefault(body.client_id, 0),
    maison_id: toIntOrDefault(body.maison_id, 0),
    date_facture: emptyToNull(body.date_facture),
    date_echeance: emptyToNull(body.date_echeance),
    montant_ht: totals.montant_ht,
    taux_tva: totals.taux_tva,
    montant_tva: totals.montant_tva,
    montant_ttc: totals.montant_ttc,
    montant_paye: totals.montant_paye,
    montant_restant: totals.montant_restant,
    statut: STATUTS.has(body.statut) ? body.statut : "brouillon",
    mode_paiement: modePaiement,
    notes: emptyToNull(body.notes?.trim()),
  };
}

function validateFactureFields(fields, items) {
  if (!fields.client_id) {
    return "Le client est obligatoire.";
  }

  if (!fields.maison_id) {
    return "La maison d'hôtes est obligatoire.";
  }

  if (!fields.date_facture) {
    return "La date de facture est obligatoire.";
  }

  if (items.length === 0) {
    return "Au moins une ligne de facture est requise.";
  }

  if (fields.montant_paye > fields.montant_ttc) {
    return "Le montant payé ne peut pas dépasser le total TTC.";
  }

  return null;
}

const FACTURE_SELECT = `
  SELECT
    f.*,
    CONCAT(COALESCE(cl.prenom, ''), ' ', COALESCE(cl.nom, '')) AS client_nom,
    cl.email AS client_email,
    m.nom AS maison_nom,
    r.reference AS reservation_reference,
    cmd.reference AS commande_reference
  FROM factures f
  INNER JOIN clients cl ON cl.id = f.client_id
  INNER JOIN maisons_hotes m ON m.id = f.maison_id
  LEFT JOIN reservations r ON r.id = f.reservation_id
  LEFT JOIN commandes cmd ON cmd.id = f.commande_id
`;

async function validateCommandeLink(connection, fields, factureId = null) {
  if (!fields.commande_id) {
    return null;
  }

  const [commandeRows] = await connection.query(
    `
      SELECT id, reservation_id, client_id, maison_id
      FROM commandes
      WHERE id = ?
      LIMIT 1
    `,
    [fields.commande_id]
  );

  if (commandeRows.length === 0) {
    return "Commande introuvable.";
  }

  const commande = commandeRows[0];

  if (Number(commande.client_id) !== fields.client_id) {
    return "Le client de la facture doit correspondre à la commande.";
  }

  if (Number(commande.maison_id) !== fields.maison_id) {
    return "La maison de la facture doit correspondre à la commande.";
  }

  if (
    fields.reservation_id &&
    commande.reservation_id &&
    Number(commande.reservation_id) !== fields.reservation_id
  ) {
    return "La réservation de la facture doit correspondre à la commande.";
  }

  const [existingFactures] = await connection.query(
    `
      SELECT id
      FROM factures
      WHERE commande_id = ?
        ${factureId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    factureId ? [fields.commande_id, factureId] : [fields.commande_id]
  );

  if (existingFactures.length > 0) {
    return "Une facture existe déjà pour cette commande.";
  }

  return null;
}

async function generateNumeroFacture(connection) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `FAC-${datePart}`;

  const [rows] = await connection.query(
    `
      SELECT numero_facture
      FROM factures
      WHERE numero_facture LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [`${prefix}%`]
  );

  let sequence = 1;

  if (rows.length > 0) {
    const match = String(rows[0].numero_facture).match(/-(\d+)$/);
    if (match) {
      sequence = Number(match[1]) + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

async function fetchFactureItems(factureId) {
  const [rows] = await pool.query(
    `
      SELECT *
      FROM facture_items
      WHERE facture_id = ?
      ORDER BY ordre ASC, id ASC
    `,
    [factureId]
  );

  return rows;
}

async function syncFactureItems(connection, factureId, items) {
  await connection.query(`DELETE FROM facture_items WHERE facture_id = ?`, [factureId]);

  for (const item of items) {
    await connection.query(
      `
        INSERT INTO facture_items (
          facture_id, description, quantite, prix_unitaire,
          taux_tva, prix_total_ht, prix_total_ttc, ordre
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        factureId,
        item.description,
        item.quantite,
        item.prix_unitaire,
        item.taux_tva,
        item.prix_total_ht,
        item.prix_total_ttc,
        item.ordre,
      ]
    );
  }
}

async function getFactures(req, res) {
  try {
    const [rows] = await pool.query(`${FACTURE_SELECT} ORDER BY f.date_creation DESC`);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching factures:", error);
    return res.status(500).json({ message: "Unable to fetch factures." });
  }
}

async function getFactureById(req, res) {
  try {
    const [rows] = await pool.query(`${FACTURE_SELECT} WHERE f.id = ? LIMIT 1`, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Facture not found." });
    }

    const items = await fetchFactureItems(rows[0].id);

    return res.status(200).json({ ...rows[0], items });
  } catch (error) {
    console.error("Error fetching facture:", error);
    return res.status(500).json({ message: "Unable to fetch facture." });
  }
}

async function createFacture(req, res) {
  const connection = await pool.getConnection();

  try {
    const items = pickFactureItems(req.body);
    const fields = pickFactureFields(req.body, items);
    const validationError = validateFactureFields(fields, items);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const commandeError = await validateCommandeLink(connection, fields);
    if (commandeError) {
      return res.status(400).json({ message: commandeError });
    }

    if (fields.reservation_id) {
      const [reservationRows] = await connection.query(
        `
          SELECT client_id, maison_id
          FROM reservations
          WHERE id = ?
          LIMIT 1
        `,
        [fields.reservation_id]
      );

      if (reservationRows.length === 0) {
        return res.status(400).json({ message: "Réservation introuvable." });
      }

      if (
        Number(reservationRows[0].client_id) !== fields.client_id ||
        Number(reservationRows[0].maison_id) !== fields.maison_id
      ) {
        return res.status(400).json({
          message: "Le client et la maison doivent correspondre à la réservation.",
        });
      }
    }

    await connection.beginTransaction();

    const numeroFacture = await generateNumeroFacture(connection);
    const today = new Date().toISOString().slice(0, 10);
    const dateFacture = fields.date_facture || today;
    const dateEcheance =
      fields.date_echeance ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [result] = await connection.query(
      `
        INSERT INTO factures (
          numero_facture, reservation_id, commande_id, client_id, maison_id,
          date_facture, date_echeance,
          montant_ht, taux_tva, montant_tva, montant_ttc,
          montant_paye, montant_restant,
          statut, mode_paiement, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        numeroFacture,
        fields.reservation_id,
        fields.commande_id,
        fields.client_id,
        fields.maison_id,
        dateFacture,
        dateEcheance,
        fields.montant_ht,
        fields.taux_tva,
        fields.montant_tva,
        fields.montant_ttc,
        fields.montant_paye,
        fields.montant_restant,
        fields.statut,
        fields.mode_paiement,
        fields.notes,
      ]
    );

    await syncFactureItems(connection, result.insertId, items);
    await connection.commit();

    const [rows] = await pool.query(`${FACTURE_SELECT} WHERE f.id = ? LIMIT 1`, [result.insertId]);
    const savedItems = await fetchFactureItems(result.insertId);

    return res.status(201).json({ ...rows[0], items: savedItems });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating facture:", error);
    return res.status(500).json({ message: "Unable to create facture." });
  } finally {
    connection.release();
  }
}

async function updateFacture(req, res) {
  const connection = await pool.getConnection();

  try {
    const [existing] = await connection.query(`SELECT id FROM factures WHERE id = ? LIMIT 1`, [
      req.params.id,
    ]);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Facture not found." });
    }

    const items = pickFactureItems(req.body);
    const fields = pickFactureFields(req.body, items);
    const validationError = validateFactureFields(fields, items);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const commandeError = await validateCommandeLink(connection, fields, req.params.id);
    if (commandeError) {
      return res.status(400).json({ message: commandeError });
    }

    if (fields.reservation_id) {
      const [reservationRows] = await connection.query(
        `
          SELECT client_id, maison_id
          FROM reservations
          WHERE id = ?
          LIMIT 1
        `,
        [fields.reservation_id]
      );

      if (reservationRows.length === 0) {
        return res.status(400).json({ message: "Réservation introuvable." });
      }

      if (
        Number(reservationRows[0].client_id) !== fields.client_id ||
        Number(reservationRows[0].maison_id) !== fields.maison_id
      ) {
        return res.status(400).json({
          message: "Le client et la maison doivent correspondre à la réservation.",
        });
      }
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE factures
        SET
          reservation_id = ?,
          commande_id = ?,
          client_id = ?,
          maison_id = ?,
          date_facture = ?,
          date_echeance = ?,
          montant_ht = ?,
          taux_tva = ?,
          montant_tva = ?,
          montant_ttc = ?,
          montant_paye = ?,
          montant_restant = ?,
          statut = ?,
          mode_paiement = ?,
          notes = ?
        WHERE id = ?
      `,
      [
        fields.reservation_id,
        fields.commande_id,
        fields.client_id,
        fields.maison_id,
        fields.date_facture,
        fields.date_echeance,
        fields.montant_ht,
        fields.taux_tva,
        fields.montant_tva,
        fields.montant_ttc,
        fields.montant_paye,
        fields.montant_restant,
        fields.statut,
        fields.mode_paiement,
        fields.notes,
        req.params.id,
      ]
    );

    await syncFactureItems(connection, req.params.id, items);
    await connection.commit();

    const [rows] = await pool.query(`${FACTURE_SELECT} WHERE f.id = ? LIMIT 1`, [req.params.id]);
    const savedItems = await fetchFactureItems(req.params.id);

    return res.status(200).json({ ...rows[0], items: savedItems });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating facture:", error);
    return res.status(500).json({ message: "Unable to update facture." });
  } finally {
    connection.release();
  }
}

async function deleteFacture(req, res) {
  const connection = await pool.getConnection();

  try {
    const [existing] = await connection.query(`SELECT id FROM factures WHERE id = ? LIMIT 1`, [
      req.params.id,
    ]);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Facture not found." });
    }

    await connection.beginTransaction();
    await connection.query(`DELETE FROM facture_items WHERE facture_id = ?`, [req.params.id]);
    await connection.query(`DELETE FROM factures WHERE id = ?`, [req.params.id]);
    await connection.commit();

    return res.status(200).json({ message: "Facture deleted." });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting facture:", error);
    return res.status(500).json({ message: "Unable to delete facture." });
  } finally {
    connection.release();
  }
}

module.exports = {
  getFactures,
  getFactureById,
  createFacture,
  updateFacture,
  deleteFacture,
};
