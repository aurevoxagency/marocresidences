const { pool } = require("../../database/db");

const SOURCES = new Set([
  "site_web",
  "booking",
  "airbnb",
  "agence",
  "telephone",
  "walk_in",
  "autre",
]);

const STATUTS_RESERVATION = new Set([
  "en_attente",
  "confirmee",
  "annulee",
  "terminee",
  "no_show",
]);

const STATUTS_PAIEMENT = new Set([
  "non_paye",
  "acompte_paye",
  "paye_totalement",
  "rembourse",
]);

function emptyToNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return value;
}

function toIntOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function toDecimalOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : fallback;
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

function pickReservationFields(body = {}) {
  const prixChambre = toDecimalOrDefault(body.prix_chambre_total, 0);
  const prixBebe = toDecimalOrDefault(body.prix_bebe_total, 0);
  const prixEnfants = toDecimalOrDefault(body.prix_enfants_total, 0);
  const montantReduction = toDecimalOrDefault(body.montant_reduction, 0);
  const tauxTva = toDecimalOrDefault(body.taux_tva_applique, 0);
  const prixTotalHt =
    body.prix_total_ht != null
      ? toDecimalOrDefault(body.prix_total_ht)
      : Math.max(0, prixChambre + prixBebe + prixEnfants - montantReduction);
  const montantTva =
    body.montant_tva != null
      ? toDecimalOrDefault(body.montant_tva)
      : Math.round(prixTotalHt * (tauxTva / 100) * 100) / 100;
  const prixTotalTtc =
    body.prix_total_ttc != null
      ? toDecimalOrDefault(body.prix_total_ttc)
      : Math.round((prixTotalHt + montantTva) * 100) / 100;

  return {
    client_id: toIntOrDefault(body.client_id, 0),
    chambre_id: toIntOrDefault(body.chambre_id, 0),
    maison_id: toIntOrDefault(body.maison_id, 0),
    date_arrivee: emptyToNull(body.date_arrivee),
    date_depart: emptyToNull(body.date_depart),
    nb_nuits: calculateNights(body.date_arrivee, body.date_depart),
    nb_adultes: Math.max(1, toIntOrDefault(body.nb_adultes, 1)),
    nbrs_enfants: Math.max(0, toIntOrDefault(body.nbrs_enfants, 0)),
    nbrs_bebe: Math.max(0, toIntOrDefault(body.nbrs_bebe, 0)),
    age_enfant: Math.max(0, toIntOrDefault(body.age_enfant, 0)),
    source: SOURCES.has(body.source) ? body.source : "autre",
    promotion_id: emptyToNull(body.promotion_id) ? toIntOrDefault(body.promotion_id, 0) : null,
    supplement_id: emptyToNull(body.supplement_id) ? toIntOrDefault(body.supplement_id, 0) : null,
    prix_chambre_total: prixChambre,
    prix_bebe_total: prixBebe,
    prix_enfants_total: prixEnfants,
    montant_reduction: montantReduction,
    prix_total_ht: prixTotalHt,
    taux_tva_applique: tauxTva,
    montant_tva: montantTva,
    prix_total_ttc: prixTotalTtc,
    statut_reservation: STATUTS_RESERVATION.has(body.statut_reservation)
      ? body.statut_reservation
      : "en_attente",
    statut_paiement: STATUTS_PAIEMENT.has(body.statut_paiement)
      ? body.statut_paiement
      : "non_paye",
    montant_paye: toDecimalOrDefault(body.montant_paye, 0),
    notes: emptyToNull(body.notes?.trim()),
  };
}

const RESERVATION_SELECT = `
  SELECT
    r.*,
    CONCAT(COALESCE(c.prenom, ''), ' ', COALESCE(c.nom, '')) AS client_nom,
    c.email AS client_email,
    m.nom AS maison_nom,
    ch.nom AS chambre_nom,
    p.nom AS promotion_nom,
    s.nom AS supplement_nom
  FROM reservations r
  INNER JOIN clients c ON c.id = r.client_id
  INNER JOIN maisons_hotes m ON m.id = r.maison_id
  INNER JOIN chambres ch ON ch.id = r.chambre_id
  LEFT JOIN promotions p ON p.id = r.promotion_id
  LEFT JOIN supplements s ON s.id = r.supplement_id
`;

async function generateReference(connection) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `RES-${datePart}`;

  const [rows] = await connection.query(
    `
      SELECT reference
      FROM reservations
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

async function syncClientReservationStats(connection, clientId) {
  if (!clientId) {
    return;
  }

  const [stats] = await connection.query(
    `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(prix_total_ttc), 0) AS montant,
        MIN(date_arrivee) AS premiere,
        MAX(date_arrivee) AS derniere
      FROM reservations
      WHERE client_id = ?
        AND statut_reservation NOT IN ('annulee')
    `,
    [clientId]
  );

  await connection.query(
    `
      UPDATE clients
      SET
        nb_reservations_total = ?,
        montant_total_depense = ?,
        date_premiere_reservation = ?,
        date_derniere_reservation = ?
      WHERE id = ?
    `,
    [
      Number(stats[0]?.total) || 0,
      Number(stats[0]?.montant) || 0,
      stats[0]?.premiere || null,
      stats[0]?.derniere || null,
      clientId,
    ]
  );
}

async function validateReservationRelations(connection, fields, reservationId = null) {
  if (!fields.client_id) {
    return "Le client est requis.";
  }

  if (!fields.maison_id) {
    return "La maison d'hôtes est requise.";
  }

  if (!fields.chambre_id) {
    return "La chambre est requise.";
  }

  if (!fields.date_arrivee || !fields.date_depart) {
    return "Les dates d'arrivée et de départ sont requises.";
  }

  if (fields.date_depart <= fields.date_arrivee) {
    return "La date de départ doit être postérieure à la date d'arrivée.";
  }

  if (fields.nb_nuits <= 0) {
    return "Le séjour doit comporter au moins une nuit.";
  }

  const [clientRows] = await connection.query(
    "SELECT id FROM clients WHERE id = ? LIMIT 1",
    [fields.client_id]
  );

  if (clientRows.length === 0) {
    return "Client introuvable.";
  }

  const [maisonRows] = await connection.query(
    "SELECT id FROM maisons_hotes WHERE id = ? LIMIT 1",
    [fields.maison_id]
  );

  if (maisonRows.length === 0) {
    return "Maison d'hôtes introuvable.";
  }

  const [chambreRows] = await connection.query(
    "SELECT id, maison_id FROM chambres WHERE id = ? LIMIT 1",
    [fields.chambre_id]
  );

  if (chambreRows.length === 0) {
    return "Chambre introuvable.";
  }

  if (Number(chambreRows[0].maison_id) !== Number(fields.maison_id)) {
    return "La chambre sélectionnée n'appartient pas à cette maison.";
  }

  if (fields.promotion_id) {
    const [promotionRows] = await connection.query(
      "SELECT id FROM promotions WHERE id = ? LIMIT 1",
      [fields.promotion_id]
    );

    if (promotionRows.length === 0) {
      return "Promotion introuvable.";
    }
  }

  if (fields.supplement_id) {
    const [supplementRows] = await connection.query(
      "SELECT id FROM supplements WHERE id = ? AND statut = 'actif' LIMIT 1",
      [fields.supplement_id]
    );

    if (supplementRows.length === 0) {
      return "Supplément introuvable.";
    }
  }

  const overlapParams = [fields.chambre_id, fields.date_depart, fields.date_arrivee];

  let overlapQuery = `
    SELECT id
    FROM reservations
    WHERE chambre_id = ?
      AND statut_reservation NOT IN ('annulee')
      AND date_arrivee < ?
      AND date_depart > ?
  `;

  if (reservationId) {
    overlapQuery += " AND id <> ?";
    overlapParams.push(reservationId);
  }

  overlapQuery += " LIMIT 1";

  const [overlapRows] = await connection.query(overlapQuery, overlapParams);

  if (overlapRows.length > 0) {
    return "Cette chambre est déjà réservée sur tout ou partie de cette période.";
  }

  return null;
}

async function fetchReservationById(connection, id) {
  const [rows] = await connection.query(`${RESERVATION_SELECT} WHERE r.id = ? LIMIT 1`, [
    id,
  ]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    ...row,
    client_nom: row.client_nom?.trim() || null,
    promotion_nom: row.promotion_nom || null,
  };
}

async function getReservations(req, res) {
  try {
    const maisonId = Number(req.query.maison_id);
    const statut = req.query.statut_reservation;
    const params = [];
    let query = `${RESERVATION_SELECT} WHERE 1 = 1`;

    if (maisonId) {
      query += " AND r.maison_id = ?";
      params.push(maisonId);
    }

    if (statut && STATUTS_RESERVATION.has(statut)) {
      query += " AND r.statut_reservation = ?";
      params.push(statut);
    }

    query += " ORDER BY r.date_arrivee DESC, r.id DESC";

    const [rows] = await pool.query(query, params);

    return res.status(200).json(
      rows.map((row) => ({
        ...row,
        client_nom: row.client_nom?.trim() || null,
        promotion_nom: row.promotion_nom || null,
      }))
    );
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return res.status(500).json({ message: "Impossible de charger les réservations." });
  }
}

async function getReservationById(req, res) {
  try {
    const reservation = await fetchReservationById(pool, req.params.id);

    if (!reservation) {
      return res.status(404).json({ message: "Réservation introuvable." });
    }

    return res.status(200).json(reservation);
  } catch (error) {
    console.error("Error fetching reservation:", error);
    return res.status(500).json({ message: "Impossible de charger la réservation." });
  }
}

async function createReservation(req, res) {
  const connection = await pool.getConnection();

  try {
    const fields = pickReservationFields(req.body);
    const validationError = await validateReservationRelations(connection, fields);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await connection.beginTransaction();

    const reference = await generateReference(connection);

    const [result] = await connection.query(
      `
        INSERT INTO reservations (
          reference, client_id, chambre_id, maison_id,
          date_arrivee, date_depart, nb_nuits, nb_adultes, nbrs_enfants, nbrs_bebe, age_enfant,
          source, promotion_id, supplement_id,
          prix_chambre_total, prix_bebe_total, prix_enfants_total, montant_reduction,
          prix_total_ht, taux_tva_applique, montant_tva, prix_total_ttc,
          statut_reservation, statut_paiement, montant_paye, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        reference,
        fields.client_id,
        fields.chambre_id,
        fields.maison_id,
        fields.date_arrivee,
        fields.date_depart,
        fields.nb_nuits,
        fields.nb_adultes,
        fields.nbrs_enfants,
        fields.nbrs_bebe,
        fields.age_enfant,
        fields.source,
        fields.promotion_id,
        fields.supplement_id,
        fields.prix_chambre_total,
        fields.prix_bebe_total,
        fields.prix_enfants_total,
        fields.montant_reduction,
        fields.prix_total_ht,
        fields.taux_tva_applique,
        fields.montant_tva,
        fields.prix_total_ttc,
        fields.statut_reservation,
        fields.statut_paiement,
        fields.montant_paye,
        fields.notes,
      ]
    );

    await syncClientReservationStats(connection, fields.client_id);
    await connection.commit();

    const reservation = await fetchReservationById(pool, result.insertId);

    return res.status(201).json({
      message: "Réservation créée avec succès.",
      reservation,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating reservation:", error);
    return res.status(500).json({ message: "Impossible de créer la réservation." });
  } finally {
    connection.release();
  }
}

async function updateReservation(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const fields = pickReservationFields(req.body);
    const validationError = await validateReservationRelations(connection, fields, Number(id));

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const [existingRows] = await connection.query(
      "SELECT id, client_id FROM reservations WHERE id = ? LIMIT 1",
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Réservation introuvable." });
    }

    const previousClientId = existingRows[0].client_id;

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        UPDATE reservations SET
          client_id = ?, chambre_id = ?, maison_id = ?,
          date_arrivee = ?, date_depart = ?, nb_nuits = ?, nb_adultes = ?, nbrs_enfants = ?, nbrs_bebe = ?, age_enfant = ?,
          source = ?, promotion_id = ?, supplement_id = ?,
          prix_chambre_total = ?, prix_bebe_total = ?, prix_enfants_total = ?, montant_reduction = ?,
          prix_total_ht = ?, taux_tva_applique = ?, montant_tva = ?, prix_total_ttc = ?,
          statut_reservation = ?, statut_paiement = ?, montant_paye = ?, notes = ?
        WHERE id = ?
      `,
      [
        fields.client_id,
        fields.chambre_id,
        fields.maison_id,
        fields.date_arrivee,
        fields.date_depart,
        fields.nb_nuits,
        fields.nb_adultes,
        fields.nbrs_enfants,
        fields.nbrs_bebe,
        fields.age_enfant,
        fields.source,
        fields.promotion_id,
        fields.supplement_id,
        fields.prix_chambre_total,
        fields.prix_bebe_total,
        fields.prix_enfants_total,
        fields.montant_reduction,
        fields.prix_total_ht,
        fields.taux_tva_applique,
        fields.montant_tva,
        fields.prix_total_ttc,
        fields.statut_reservation,
        fields.statut_paiement,
        fields.montant_paye,
        fields.notes,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Réservation introuvable." });
    }

    await syncClientReservationStats(connection, fields.client_id);

    if (Number(previousClientId) !== Number(fields.client_id)) {
      await syncClientReservationStats(connection, previousClientId);
    }

    await connection.commit();

    const reservation = await fetchReservationById(pool, id);

    return res.status(200).json({
      message: "Réservation mise à jour.",
      reservation,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating reservation:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour la réservation." });
  } finally {
    connection.release();
  }
}

async function deleteReservation(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    const [existingRows] = await connection.query(
      "SELECT id, client_id FROM reservations WHERE id = ? LIMIT 1",
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: "Réservation introuvable." });
    }

    const clientId = existingRows[0].client_id;

    await connection.beginTransaction();
    await connection.query("DELETE FROM reservations WHERE id = ?", [id]);
    await syncClientReservationStats(connection, clientId);
    await connection.commit();

    return res.status(200).json({ message: "Réservation supprimée." });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting reservation:", error);
    return res.status(500).json({ message: "Impossible de supprimer la réservation." });
  } finally {
    connection.release();
  }
}

module.exports = {
  getReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation,
};
