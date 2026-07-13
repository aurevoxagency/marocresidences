const { pool } = require("../../database/db");

const ETATS_CHECKIN = new Set(["bon", "a_signaler"]);
const ETATS_CHECKOUT = new Set(["bon", "a_signaler", "degats"]);
const DEPOT_STATUTS = new Set(["non_pris", "pris", "rendu", "retenu"]);

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

  const normalized = String(raw).trim().replace("T", " ").slice(0, 19);
  return normalized || null;
}

function pickCheckinFields(body = {}) {
  const etatCheckin = emptyToNull(body.etat_chambre_checkin);
  const etatCheckout = emptyToNull(body.etat_chambre_checkout);
  const depotStatut = emptyToNull(body.depot_garantie_statut);

  return {
    reservation_id: toIntOrNull(body.reservation_id),
    date_checkin_reel: toDateTimeOrNull(body.date_checkin_reel),
    date_checkout_reel: toDateTimeOrNull(body.date_checkout_reel),
    checkin_par: emptyToNull(body.checkin_par?.trim()),
    checkout_par: emptyToNull(body.checkout_par?.trim()),
    etat_chambre_checkin: ETATS_CHECKIN.has(etatCheckin) ? etatCheckin : null,
    etat_chambre_checkout: ETATS_CHECKOUT.has(etatCheckout) ? etatCheckout : null,
    depot_garantie_montant: toDecimalOrDefault(body.depot_garantie_montant, 0),
    depot_garantie_statut: DEPOT_STATUTS.has(depotStatut) ? depotStatut : "non_pris",
    notes_checkin: emptyToNull(body.notes_checkin?.trim()),
    notes_checkout: emptyToNull(body.notes_checkout?.trim()),
  };
}

function validateCheckinFields(fields, { requireReservation = true } = {}) {
  if (requireReservation && !fields.reservation_id) {
    return "La réservation est requise.";
  }

  if (fields.date_checkin_reel && fields.date_checkout_reel) {
    const checkin = new Date(fields.date_checkin_reel.replace(" ", "T"));
    const checkout = new Date(fields.date_checkout_reel.replace(" ", "T"));

    if (
      Number.isFinite(checkin.getTime()) &&
      Number.isFinite(checkout.getTime()) &&
      checkout < checkin
    ) {
      return "La date de check-out doit être après le check-in.";
    }
  }

  return null;
}

const CHECKIN_SELECT = `
  SELECT
    cc.*,
    r.reference AS reservation_reference,
    r.date_arrivee AS reservation_date_arrivee,
    r.date_depart AS reservation_date_depart,
    r.statut_reservation AS reservation_statut,
    r.nb_adultes,
    r.nbrs_enfants,
    r.nbrs_bebe,
    CONCAT(COALESCE(c.prenom, ''), ' ', COALESCE(c.nom, '')) AS client_nom,
    c.email AS client_email,
    c.telephone AS client_telephone,
    m.nom AS maison_nom,
    ch.nom AS chambre_nom
  FROM checkins_checkouts cc
  INNER JOIN reservations r ON r.id = cc.reservation_id
  INNER JOIN clients c ON c.id = r.client_id
  INNER JOIN maisons_hotes m ON m.id = r.maison_id
  INNER JOIN chambres ch ON ch.id = r.chambre_id
`;

async function fetchCheckinById(connection, id) {
  const [rows] = await connection.query(`${CHECKIN_SELECT} WHERE cc.id = ? LIMIT 1`, [id]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    ...row,
    client_nom: row.client_nom?.trim() || null,
  };
}

async function getCheckins(req, res) {
  try {
    const maisonId = Number(req.query.maison_id);
    const params = [];
    let query = `${CHECKIN_SELECT} WHERE 1 = 1`;

    if (maisonId) {
      query += " AND r.maison_id = ?";
      params.push(maisonId);
    }

    query += " ORDER BY COALESCE(cc.date_checkin_reel, r.date_arrivee) DESC, cc.id DESC";

    const [rows] = await pool.query(query, params);

    return res.status(200).json(
      rows.map((row) => ({
        ...row,
        client_nom: row.client_nom?.trim() || null,
      }))
    );
  } catch (error) {
    console.error("Error fetching checkins:", error);
    return res.status(500).json({ message: "Impossible de charger les check-in / check-out." });
  }
}

async function getCheckinById(req, res) {
  try {
    const checkin = await fetchCheckinById(pool, req.params.id);

    if (!checkin) {
      return res.status(404).json({ message: "Check-in / check-out introuvable." });
    }

    return res.status(200).json(checkin);
  } catch (error) {
    console.error("Error fetching checkin:", error);
    return res.status(500).json({ message: "Impossible de charger le check-in / check-out." });
  }
}

async function getCheckinByReservation(req, res) {
  try {
    const reservationId = Number(req.params.reservationId);

    if (!reservationId) {
      return res.status(400).json({ message: "Réservation invalide." });
    }

    const [rows] = await pool.query(
      `${CHECKIN_SELECT} WHERE cc.reservation_id = ? LIMIT 1`,
      [reservationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Aucun check-in pour cette réservation." });
    }

    return res.status(200).json({
      ...rows[0],
      client_nom: rows[0].client_nom?.trim() || null,
    });
  } catch (error) {
    console.error("Error fetching checkin by reservation:", error);
    return res.status(500).json({ message: "Impossible de charger le check-in / check-out." });
  }
}

async function createCheckin(req, res) {
  const connection = await pool.getConnection();

  try {
    const fields = pickCheckinFields(req.body);
    const validationError = validateCheckinFields(fields);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const [reservations] = await connection.query(
      "SELECT id, statut_reservation FROM reservations WHERE id = ? LIMIT 1",
      [fields.reservation_id]
    );

    if (reservations.length === 0) {
      return res.status(400).json({ message: "Réservation introuvable." });
    }

    if (reservations[0].statut_reservation === "annulee") {
      return res.status(400).json({ message: "Impossible de faire un check-in sur une réservation annulée." });
    }

    const [existing] = await connection.query(
      "SELECT id FROM checkins_checkouts WHERE reservation_id = ? LIMIT 1",
      [fields.reservation_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Un check-in / check-out existe déjà pour cette réservation.",
      });
    }

    const [result] = await connection.query(
      `
        INSERT INTO checkins_checkouts (
          reservation_id, date_checkin_reel, date_checkout_reel,
          checkin_par, checkout_par,
          etat_chambre_checkin, etat_chambre_checkout,
          depot_garantie_montant, depot_garantie_statut,
          notes_checkin, notes_checkout
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        fields.reservation_id,
        fields.date_checkin_reel,
        fields.date_checkout_reel,
        fields.checkin_par,
        fields.checkout_par,
        fields.etat_chambre_checkin,
        fields.etat_chambre_checkout,
        fields.depot_garantie_montant,
        fields.depot_garantie_statut,
        fields.notes_checkin,
        fields.notes_checkout,
      ]
    );

    const checkin = await fetchCheckinById(connection, result.insertId);

    return res.status(201).json({
      message: "Check-in / check-out créé avec succès.",
      checkin,
    });
  } catch (error) {
    console.error("Error creating checkin:", error);
    return res.status(500).json({ message: "Impossible de créer le check-in / check-out." });
  } finally {
    connection.release();
  }
}

async function updateCheckin(req, res) {
  const connection = await pool.getConnection();

  try {
    const id = Number(req.params.id);
    const existing = await fetchCheckinById(connection, id);

    if (!existing) {
      return res.status(404).json({ message: "Check-in / check-out introuvable." });
    }

    const fields = pickCheckinFields({
      ...req.body,
      reservation_id: existing.reservation_id,
    });
    const validationError = validateCheckinFields(fields, { requireReservation: false });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await connection.query(
      `
        UPDATE checkins_checkouts SET
          date_checkin_reel = ?,
          date_checkout_reel = ?,
          checkin_par = ?,
          checkout_par = ?,
          etat_chambre_checkin = ?,
          etat_chambre_checkout = ?,
          depot_garantie_montant = ?,
          depot_garantie_statut = ?,
          notes_checkin = ?,
          notes_checkout = ?
        WHERE id = ?
      `,
      [
        fields.date_checkin_reel,
        fields.date_checkout_reel,
        fields.checkin_par,
        fields.checkout_par,
        fields.etat_chambre_checkin,
        fields.etat_chambre_checkout,
        fields.depot_garantie_montant,
        fields.depot_garantie_statut,
        fields.notes_checkin,
        fields.notes_checkout,
        id,
      ]
    );

    const checkin = await fetchCheckinById(connection, id);

    return res.status(200).json({
      message: "Check-in / check-out mis à jour.",
      checkin,
    });
  } catch (error) {
    console.error("Error updating checkin:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour le check-in / check-out." });
  } finally {
    connection.release();
  }
}

async function deleteCheckin(req, res) {
  try {
    const [result] = await pool.query("DELETE FROM checkins_checkouts WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Check-in / check-out introuvable." });
    }

    return res.status(200).json({ message: "Check-in / check-out supprimé." });
  } catch (error) {
    console.error("Error deleting checkin:", error);
    return res.status(500).json({ message: "Impossible de supprimer le check-in / check-out." });
  }
}

module.exports = {
  getCheckins,
  getCheckinById,
  getCheckinByReservation,
  createCheckin,
  updateCheckin,
  deleteCheckin,
};
