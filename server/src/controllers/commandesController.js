const { pool } = require("../../database/db");

const STATUTS = new Set(["en_attente", "validee", "livree", "annulee"]);
const STATUTS_PAIEMENT = new Set(["non_paye", "paye", "ajoute_facture"]);

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

function pickCommandeItems(body = {}) {
  const raw = Array.isArray(body.items) ? body.items : [];

  return raw
    .map((item) => {
      const description = item.description?.trim();
      if (!description) {
        return null;
      }

      const quantite = toDecimalOrDefault(item.quantite, 1);
      const prixUnitaire = toDecimalOrDefault(item.prix_unitaire, 0);
      const prixTotal =
        item.prix_total != null
          ? toDecimalOrDefault(item.prix_total)
          : Math.round(quantite * prixUnitaire * 100) / 100;

      return {
        supplement_id: toIntOrNull(item.supplement_id),
        description,
        quantite,
        prix_unitaire: prixUnitaire,
        prix_total: prixTotal,
      };
    })
    .filter(Boolean);
}

function computeTotalsFromItems(items, body = {}) {
  const montantHt =
    body.montant_ht != null
      ? toDecimalOrDefault(body.montant_ht)
      : items.reduce((sum, item) => sum + item.prix_total, 0);
  const tauxTva = toDecimalOrDefault(body.taux_tva, 10);
  const montantTva =
    body.montant_tva != null
      ? toDecimalOrDefault(body.montant_tva)
      : Math.round(montantHt * (tauxTva / 100) * 100) / 100;
  const montantTtc =
    body.montant_ttc != null
      ? toDecimalOrDefault(body.montant_ttc)
      : Math.round((montantHt + montantTva) * 100) / 100;

  return {
    montant_ht: montantHt,
    taux_tva: tauxTva,
    montant_tva: montantTva,
    montant_ttc: montantTtc,
  };
}

function pickCommandeFields(body = {}, items = []) {
  const totals = computeTotalsFromItems(items, body);

  return {
    devis_id: toIntOrNull(body.devis_id),
    reservation_id: toIntOrDefault(body.reservation_id, 0),
    client_id: toIntOrDefault(body.client_id, 0),
    maison_id: toIntOrDefault(body.maison_id, 0),
    date_commande: emptyToNull(body.date_commande),
    montant_ht: totals.montant_ht,
    taux_tva: totals.taux_tva,
    montant_tva: totals.montant_tva,
    montant_ttc: totals.montant_ttc,
    statut: STATUTS.has(body.statut) ? body.statut : "en_attente",
    statut_paiement: STATUTS_PAIEMENT.has(body.statut_paiement)
      ? body.statut_paiement
      : "non_paye",
    notes: emptyToNull(body.notes?.trim()),
  };
}

function validateCommandeFields(fields, items) {
  if (!fields.reservation_id) {
    return "La réservation est obligatoire.";
  }

  if (!fields.client_id) {
    return "Le client est obligatoire.";
  }

  if (!fields.maison_id) {
    return "La maison d'hôtes est obligatoire.";
  }

  if (items.length === 0) {
    return "Au moins une ligne de commande est requise.";
  }

  return null;
}

const COMMANDE_SELECT = `
  SELECT
    c.*,
    CONCAT(COALESCE(cl.prenom, ''), ' ', COALESCE(cl.nom, '')) AS client_nom,
    cl.email AS client_email,
    m.nom AS maison_nom,
    r.reference AS reservation_reference,
    r.date_arrivee AS reservation_date_arrivee,
    r.date_depart AS reservation_date_depart,
    dv.reference AS devis_reference
  FROM commandes c
  INNER JOIN clients cl ON cl.id = c.client_id
  INNER JOIN maisons_hotes m ON m.id = c.maison_id
  INNER JOIN reservations r ON r.id = c.reservation_id
  LEFT JOIN devis dv ON dv.id = c.devis_id
`;

async function validateDevisLink(connection, fields, commandeId = null) {
  if (!fields.devis_id) {
    return null;
  }

  const [devisRows] = await connection.query(
    `
      SELECT id, client_id, maison_id, reservation_id
      FROM devis
      WHERE id = ?
      LIMIT 1
    `,
    [fields.devis_id]
  );

  if (devisRows.length === 0) {
    return "Devis introuvable.";
  }

  const devis = devisRows[0];

  if (!devis.client_id) {
    return "Ce devis est lié à un prospect. Convertissez-le en client avant de créer une commande.";
  }

  if (Number(devis.client_id) !== fields.client_id) {
    return "Le client de la commande doit correspondre au devis.";
  }

  if (Number(devis.maison_id) !== fields.maison_id) {
    return "La maison de la commande doit correspondre au devis.";
  }

  if (devis.reservation_id && Number(devis.reservation_id) !== fields.reservation_id) {
    return "La réservation de la commande doit correspondre au devis.";
  }

  const [existingCommandes] = await connection.query(
    `
      SELECT id
      FROM commandes
      WHERE devis_id = ?
        ${commandeId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    commandeId ? [fields.devis_id, commandeId] : [fields.devis_id]
  );

  if (existingCommandes.length > 0) {
    return "Une commande existe déjà pour ce devis.";
  }

  return null;
}

async function generateReference(connection) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `CMD-${datePart}`;

  const [rows] = await connection.query(
    `
      SELECT reference
      FROM commandes
      WHERE reference LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [`${prefix}%`]
  );

  let sequence = 1;

  if (rows.length > 0) {
    const match = String(rows[0].reference).match(/-(\d+)$/);
    if (match) {
      sequence = Number(match[1]) + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

async function fetchCommandeItems(commandeId) {
  const [rows] = await pool.query(
    `
      SELECT ci.*, s.nom AS supplement_nom
      FROM commande_items ci
      LEFT JOIN supplements s ON s.id = ci.supplement_id
      WHERE ci.commande_id = ?
      ORDER BY ci.id ASC
    `,
    [commandeId]
  );

  return rows;
}

async function syncCommandeItems(connection, commandeId, items) {
  await connection.query(`DELETE FROM commande_items WHERE commande_id = ?`, [commandeId]);

  for (const item of items) {
    await connection.query(
      `
        INSERT INTO commande_items (
          commande_id, supplement_id, description, quantite, prix_unitaire, prix_total
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        commandeId,
        item.supplement_id,
        item.description,
        item.quantite,
        item.prix_unitaire,
        item.prix_total,
      ]
    );
  }
}

async function getCommandes(req, res) {
  try {
    const [rows] = await pool.query(`${COMMANDE_SELECT} ORDER BY c.date_creation DESC`);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching commandes:", error);
    return res.status(500).json({ message: "Unable to fetch commandes." });
  }
}

async function getCommandeById(req, res) {
  try {
    const [rows] = await pool.query(`${COMMANDE_SELECT} WHERE c.id = ? LIMIT 1`, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Commande not found." });
    }

    const items = await fetchCommandeItems(rows[0].id);

    return res.status(200).json({ ...rows[0], items });
  } catch (error) {
    console.error("Error fetching commande:", error);
    return res.status(500).json({ message: "Unable to fetch commande." });
  }
}

async function createCommande(req, res) {
  const connection = await pool.getConnection();

  try {
    const items = pickCommandeItems(req.body);
    const fields = pickCommandeFields(req.body, items);
    const validationError = validateCommandeFields(fields, items);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const devisError = await validateDevisLink(connection, fields);
    if (devisError) {
      return res.status(400).json({ message: devisError });
    }

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
        message: "Le client et la maison doivent correspondre à la réservation sélectionnée.",
      });
    }

    await connection.beginTransaction();

    const reference = await generateReference(connection);
    const dateCommande = fields.date_commande || new Date().toISOString().slice(0, 19).replace("T", " ");

    const [result] = await connection.query(
      `
        INSERT INTO commandes (
          reference, reservation_id, devis_id, client_id, maison_id, date_commande,
          montant_ht, taux_tva, montant_tva, montant_ttc,
          statut, statut_paiement, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        reference,
        fields.reservation_id,
        fields.devis_id,
        fields.client_id,
        fields.maison_id,
        dateCommande,
        fields.montant_ht,
        fields.taux_tva,
        fields.montant_tva,
        fields.montant_ttc,
        fields.statut,
        fields.statut_paiement,
        fields.notes,
      ]
    );

    await syncCommandeItems(connection, result.insertId, items);
    await connection.commit();

    const [rows] = await pool.query(`${COMMANDE_SELECT} WHERE c.id = ? LIMIT 1`, [result.insertId]);
    const savedItems = await fetchCommandeItems(result.insertId);

    return res.status(201).json({ ...rows[0], items: savedItems });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating commande:", error);
    return res.status(500).json({ message: "Unable to create commande." });
  } finally {
    connection.release();
  }
}

async function updateCommande(req, res) {
  const connection = await pool.getConnection();

  try {
    const [existing] = await connection.query(`SELECT id FROM commandes WHERE id = ? LIMIT 1`, [
      req.params.id,
    ]);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Commande not found." });
    }

    const items = pickCommandeItems(req.body);
    const fields = pickCommandeFields(req.body, items);
    const validationError = validateCommandeFields(fields, items);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const devisError = await validateDevisLink(connection, fields, req.params.id);
    if (devisError) {
      return res.status(400).json({ message: devisError });
    }

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
        message: "Le client et la maison doivent correspondre à la réservation sélectionnée.",
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE commandes
        SET
          reservation_id = ?,
          devis_id = ?,
          client_id = ?,
          maison_id = ?,
          date_commande = ?,
          montant_ht = ?,
          taux_tva = ?,
          montant_tva = ?,
          montant_ttc = ?,
          statut = ?,
          statut_paiement = ?,
          notes = ?
        WHERE id = ?
      `,
      [
        fields.reservation_id,
        fields.devis_id,
        fields.client_id,
        fields.maison_id,
        fields.date_commande,
        fields.montant_ht,
        fields.taux_tva,
        fields.montant_tva,
        fields.montant_ttc,
        fields.statut,
        fields.statut_paiement,
        fields.notes,
        req.params.id,
      ]
    );

    await syncCommandeItems(connection, req.params.id, items);
    await connection.commit();

    const [rows] = await pool.query(`${COMMANDE_SELECT} WHERE c.id = ? LIMIT 1`, [req.params.id]);
    const savedItems = await fetchCommandeItems(req.params.id);

    return res.status(200).json({ ...rows[0], items: savedItems });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating commande:", error);
    return res.status(500).json({ message: "Unable to update commande." });
  } finally {
    connection.release();
  }
}

async function deleteCommande(req, res) {
  const connection = await pool.getConnection();

  try {
    const [existing] = await connection.query(`SELECT id FROM commandes WHERE id = ? LIMIT 1`, [
      req.params.id,
    ]);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Commande not found." });
    }

    await connection.beginTransaction();
    await connection.query(`DELETE FROM commande_items WHERE commande_id = ?`, [req.params.id]);
    await connection.query(`DELETE FROM commandes WHERE id = ?`, [req.params.id]);
    await connection.commit();

    return res.status(200).json({ message: "Commande deleted." });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting commande:", error);
    return res.status(500).json({ message: "Unable to delete commande." });
  } finally {
    connection.release();
  }
}

module.exports = {
  getCommandes,
  getCommandeById,
  createCommande,
  updateCommande,
  deleteCommande,
};
