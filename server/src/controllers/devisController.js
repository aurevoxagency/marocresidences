const { pool } = require("../../database/db");

const TYPES_REDUCTION = new Set(["%", "MAD"]);
const STATUTS = new Set(["brouillon", "envoye", "accepte", "refuse", "expire", "converti"]);
const ITEM_TYPES = new Set(["chambre", "enfant", "bebe", "supplement"]);

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

function computeMontantReduction(subtotal, typeReduction, valeurReduction) {
  const value = toDecimalOrDefault(valeurReduction, 0);

  if (!typeReduction || value <= 0) {
    return 0;
  }

  if (typeReduction === "%") {
    return Math.round(subtotal * (value / 100) * 100) / 100;
  }

  return Math.min(subtotal, value);
}

function calculateNights(dateArrivee, dateDepart) {
  if (!dateArrivee || !dateDepart) {
    return 0;
  }

  const start = new Date(`${dateArrivee}T00:00:00`);
  const end = new Date(`${dateDepart}T00:00:00`);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  return diff > 0 ? diff : 0;
}

function pickDevisItems(body = {}) {
  const raw = Array.isArray(body.items) ? body.items : [];

  return raw
    .map((item, index) => {
      const typeItem = ITEM_TYPES.has(item?.type_item) ? item.type_item : null;

      if (!typeItem) {
        return null;
      }

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
        type_item: typeItem,
        chambre_id: toIntOrNull(item.chambre_id),
        tranche_age_id: toIntOrNull(item.tranche_age_id),
        supplement_id: toIntOrNull(item.supplement_id),
        description,
        quantite,
        prix_unitaire: prixUnitaire,
        prix_total: prixTotal,
        ordre: toIntOrDefault(item.ordre, index),
      };
    })
    .filter(Boolean);
}

function computeTotalsFromItems(items, body = {}) {
  const subtotal = items.reduce((sum, item) => sum + item.prix_total, 0);
  const typeReduction = TYPES_REDUCTION.has(body.type_reduction) ? body.type_reduction : null;
  const valeurReduction = toDecimalOrDefault(body.valeur_reduction, 0);
  const montantReduction = computeMontantReduction(subtotal, typeReduction, valeurReduction);
  const montantHt =
    body.montant_ht != null
      ? toDecimalOrDefault(body.montant_ht)
      : Math.max(0, subtotal - montantReduction);
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
    subtotal,
    type_reduction: typeReduction,
    valeur_reduction: typeReduction ? valeurReduction : 0,
    montant_ht: montantHt,
    taux_tva: tauxTva,
    montant_tva: montantTva,
    montant_ttc: montantTtc,
  };
}

function pickDevisFields(body = {}, items = []) {
  const totals = computeTotalsFromItems(items, body);

  return {
    prospect_id: toIntOrNull(body.prospect_id),
    client_id: toIntOrNull(body.client_id),
    maison_id: toIntOrDefault(body.maison_id, 0),
    chambre_id: toIntOrNull(body.chambre_id),
    date_arrivee: emptyToNull(body.date_arrivee),
    date_depart: emptyToNull(body.date_depart),
    nb_nuits:
      body.nb_nuits != null
        ? Math.max(0, toIntOrDefault(body.nb_nuits, 0))
        : calculateNights(body.date_arrivee, body.date_depart),
    nb_adultes: Math.max(1, toIntOrDefault(body.nb_adultes, 1)),
    nbrs_enfants: Math.max(0, toIntOrDefault(body.nbrs_enfants, 0)),
    nbrs_bebe: Math.max(0, toIntOrDefault(body.nbrs_bebe, 0)),
    promotion_id: toIntOrNull(body.promotion_id),
    type_reduction: totals.type_reduction,
    valeur_reduction: totals.valeur_reduction,
    montant_ht: totals.montant_ht,
    taux_tva: totals.taux_tva,
    montant_tva: totals.montant_tva,
    montant_ttc: totals.montant_ttc,
    statut: STATUTS.has(body.statut) ? body.statut : "brouillon",
    date_emission: emptyToNull(body.date_emission),
    date_validite: emptyToNull(body.date_validite),
    date_reponse: emptyToNull(body.date_reponse),
    reservation_id: toIntOrNull(body.reservation_id),
    notes: emptyToNull(body.notes?.trim()),
  };
}

function validateDevisFields(fields, items) {
  if (!fields.maison_id) {
    return "La maison d'hôtes est obligatoire.";
  }

  if (!fields.client_id && !fields.prospect_id) {
    return "Un client ou un prospect est requis.";
  }

  if (fields.client_id && fields.prospect_id) {
    return "Sélectionnez uniquement un client ou un prospect.";
  }

  if (items.length === 0) {
    return "Au moins une ligne de devis est requise.";
  }

  if (fields.date_arrivee && fields.date_depart && fields.date_depart <= fields.date_arrivee) {
    return "La date de départ doit être postérieure à la date d'arrivée.";
  }

  if (fields.type_reduction === "%" && fields.valeur_reduction > 100) {
    return "Le pourcentage de réduction ne peut pas dépasser 100.";
  }

  return null;
}

const DEVIS_SELECT = `
  SELECT
    d.*,
    CONCAT(COALESCE(c.prenom, ''), ' ', COALESCE(c.nom, '')) AS client_nom,
    c.email AS client_email,
    CONCAT(COALESCE(pr.prenom, ''), ' ', COALESCE(pr.nom, '')) AS prospect_nom,
    pr.email AS prospect_email,
    m.nom AS maison_nom,
    ch.nom AS chambre_nom,
    p.nom AS promotion_nom,
    r.reference AS reservation_reference
  FROM devis d
  LEFT JOIN clients c ON c.id = d.client_id
  LEFT JOIN prospects pr ON pr.id = d.prospect_id
  INNER JOIN maisons_hotes m ON m.id = d.maison_id
  LEFT JOIN chambres ch ON ch.id = d.chambre_id
  LEFT JOIN promotions p ON p.id = d.promotion_id
  LEFT JOIN reservations r ON r.id = d.reservation_id
`;

async function generateReference(connection) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `DEV-${datePart}`;

  const [rows] = await connection.query(
    `
      SELECT reference
      FROM devis
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

async function fetchDevisItems(devisId) {
  const [rows] = await pool.query(
    `
      SELECT *
      FROM devis_items
      WHERE devis_id = ?
      ORDER BY ordre ASC, id ASC
    `,
    [devisId]
  );

  return rows;
}

async function syncDevisItems(connection, devisId, items) {
  await connection.query(`DELETE FROM devis_items WHERE devis_id = ?`, [devisId]);

  for (const item of items) {
    await connection.query(
      `
        INSERT INTO devis_items (
          devis_id, type_item, chambre_id, tranche_age_id, supplement_id,
          description, quantite, prix_unitaire, prix_total, ordre
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        devisId,
        item.type_item,
        item.chambre_id,
        item.tranche_age_id,
        item.supplement_id,
        item.description,
        item.quantite,
        item.prix_unitaire,
        item.prix_total,
        item.ordre,
      ]
    );
  }
}

async function getDevis(req, res) {
  try {
    const [rows] = await pool.query(`${DEVIS_SELECT} ORDER BY d.date_creation DESC`);

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching devis:", error);
    return res.status(500).json({ message: "Unable to fetch devis." });
  }
}

async function getDevisById(req, res) {
  try {
    const [rows] = await pool.query(`${DEVIS_SELECT} WHERE d.id = ? LIMIT 1`, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Devis not found." });
    }

    const items = await fetchDevisItems(rows[0].id);

    return res.status(200).json({ ...rows[0], items });
  } catch (error) {
    console.error("Error fetching devis:", error);
    return res.status(500).json({ message: "Unable to fetch devis." });
  }
}

async function createDevis(req, res) {
  const connection = await pool.getConnection();

  try {
    const items = pickDevisItems(req.body);
    const fields = pickDevisFields(req.body, items);
    const validationError = validateDevisFields(fields, items);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await connection.beginTransaction();

    const reference = await generateReference(connection);
    const today = new Date().toISOString().slice(0, 10);
    const dateEmission = fields.date_emission || today;
    const dateValidite =
      fields.date_validite ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [result] = await connection.query(
      `
        INSERT INTO devis (
          reference, prospect_id, client_id, maison_id, chambre_id,
          date_arrivee, date_depart, nb_nuits, nb_adultes, nbrs_enfants, nbrs_bebe,
          promotion_id, type_reduction, valeur_reduction,
          montant_ht, taux_tva, montant_tva, montant_ttc,
          statut, date_emission, date_validite, date_reponse, reservation_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        reference,
        fields.prospect_id,
        fields.client_id,
        fields.maison_id,
        fields.chambre_id,
        fields.date_arrivee,
        fields.date_depart,
        fields.nb_nuits,
        fields.nb_adultes,
        fields.nbrs_enfants,
        fields.nbrs_bebe,
        fields.promotion_id,
        fields.type_reduction,
        fields.valeur_reduction,
        fields.montant_ht,
        fields.taux_tva,
        fields.montant_tva,
        fields.montant_ttc,
        fields.statut,
        dateEmission,
        dateValidite,
        fields.date_reponse,
        fields.reservation_id,
        fields.notes,
      ]
    );

    await syncDevisItems(connection, result.insertId, items);
    await connection.commit();

    const [rows] = await pool.query(`${DEVIS_SELECT} WHERE d.id = ? LIMIT 1`, [result.insertId]);
    const savedItems = await fetchDevisItems(result.insertId);

    return res.status(201).json({ ...rows[0], items: savedItems });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating devis:", error);
    return res.status(500).json({ message: "Unable to create devis." });
  } finally {
    connection.release();
  }
}

async function updateDevis(req, res) {
  const connection = await pool.getConnection();

  try {
    const [existing] = await connection.query(`SELECT id FROM devis WHERE id = ? LIMIT 1`, [
      req.params.id,
    ]);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Devis not found." });
    }

    const items = pickDevisItems(req.body);
    const fields = pickDevisFields(req.body, items);
    const validationError = validateDevisFields(fields, items);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE devis
        SET
          prospect_id = ?,
          client_id = ?,
          maison_id = ?,
          chambre_id = ?,
          date_arrivee = ?,
          date_depart = ?,
          nb_nuits = ?,
          nb_adultes = ?,
          nbrs_enfants = ?,
          nbrs_bebe = ?,
          promotion_id = ?,
          type_reduction = ?,
          valeur_reduction = ?,
          montant_ht = ?,
          taux_tva = ?,
          montant_tva = ?,
          montant_ttc = ?,
          statut = ?,
          date_emission = ?,
          date_validite = ?,
          date_reponse = ?,
          reservation_id = ?,
          notes = ?
        WHERE id = ?
      `,
      [
        fields.prospect_id,
        fields.client_id,
        fields.maison_id,
        fields.chambre_id,
        fields.date_arrivee,
        fields.date_depart,
        fields.nb_nuits,
        fields.nb_adultes,
        fields.nbrs_enfants,
        fields.nbrs_bebe,
        fields.promotion_id,
        fields.type_reduction,
        fields.valeur_reduction,
        fields.montant_ht,
        fields.taux_tva,
        fields.montant_tva,
        fields.montant_ttc,
        fields.statut,
        fields.date_emission,
        fields.date_validite,
        fields.date_reponse,
        fields.reservation_id,
        fields.notes,
        req.params.id,
      ]
    );

    await syncDevisItems(connection, req.params.id, items);
    await connection.commit();

    const [rows] = await pool.query(`${DEVIS_SELECT} WHERE d.id = ? LIMIT 1`, [req.params.id]);
    const savedItems = await fetchDevisItems(req.params.id);

    return res.status(200).json({ ...rows[0], items: savedItems });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating devis:", error);
    return res.status(500).json({ message: "Unable to update devis." });
  } finally {
    connection.release();
  }
}

async function deleteDevis(req, res) {
  const connection = await pool.getConnection();

  try {
    const [existing] = await connection.query(`SELECT id FROM devis WHERE id = ? LIMIT 1`, [
      req.params.id,
    ]);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Devis not found." });
    }

    await connection.beginTransaction();
    await connection.query(`DELETE FROM devis_items WHERE devis_id = ?`, [req.params.id]);
    await connection.query(`DELETE FROM devis WHERE id = ?`, [req.params.id]);
    await connection.commit();

    return res.status(200).json({ message: "Devis deleted." });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting devis:", error);
    return res.status(500).json({ message: "Unable to delete devis." });
  } finally {
    connection.release();
  }
}

module.exports = {
  getDevis,
  getDevisById,
  createDevis,
  updateDevis,
  deleteDevis,
};
