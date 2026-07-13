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

const TYPES_REDUCTION = new Set(["%", "MAD"]);

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

function pickReservationFields(body = {}) {
  const prixChambre = toDecimalOrDefault(body.prix_chambre_total, 0);
  const prixBebe = toDecimalOrDefault(body.prix_bebe_total, 0);
  const prixEnfants = toDecimalOrDefault(body.prix_enfants_total, 0);
  const typeReduction = TYPES_REDUCTION.has(body.type_reduction) ? body.type_reduction : null;
  const valeurReduction = toDecimalOrDefault(body.valeur_reduction, 0);
  const subtotal = prixChambre + prixBebe + prixEnfants;
  const montantReduction = computeMontantReduction(subtotal, typeReduction, valeurReduction);
  const tauxTva = toDecimalOrDefault(body.taux_tva_applique, 0);
  const prixTotalHt =
    body.prix_total_ht != null
      ? toDecimalOrDefault(body.prix_total_ht)
      : Math.max(0, subtotal - montantReduction);
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
    type_reduction: typeReduction,
    valeur_reduction: typeReduction ? valeurReduction : 0,
    supplement_id: emptyToNull(body.supplement_id) ? toIntOrDefault(body.supplement_id, 0) : null,
    prix_chambre_total: prixChambre,
    prix_bebe_total: prixBebe,
    prix_enfants_total: prixEnfants,
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

const OCCUPANT_TYPES = new Set(["adulte", "enfant", "bebe"]);

function pickOccupants(body = {}) {
  const raw = Array.isArray(body.occupants) ? body.occupants : [];

  return raw
    .map((item, index) => {
      const type = OCCUPANT_TYPES.has(item?.type_occupant)
        ? item.type_occupant
        : null;

      if (!type) {
        return null;
      }

      const ageEnfant =
        type === "enfant" ? Math.max(0, toIntOrDefault(item.age_enfant, -1)) : null;
      const trancheAgeId =
        type === "enfant" && emptyToNull(item.tranche_age_id) != null
          ? toIntOrDefault(item.tranche_age_id, 0)
          : null;
      const supplementId = emptyToNull(item.supplement_id)
        ? toIntOrDefault(item.supplement_id, 0)
        : null;

      return {
        type_occupant: type,
        nom: emptyToNull(item.nom?.trim()),
        prenom: emptyToNull(item.prenom?.trim()),
        age_enfant: ageEnfant != null && ageEnfant >= 0 ? ageEnfant : null,
        tranche_age_id: trancheAgeId && trancheAgeId > 0 ? trancheAgeId : null,
        supplement_id: supplementId && supplementId > 0 ? supplementId : null,
        date_naissance: emptyToNull(item.date_naissance),
        piece_identite: emptyToNull(item.piece_identite?.trim()),
        allergies_regime: emptyToNull(item.allergies_regime?.trim()),
        prix_unitaire: toDecimalOrDefault(item.prix_unitaire, 0),
        prix_total: toDecimalOrDefault(item.prix_total, 0),
        _index: index,
      };
    })
    .filter(Boolean);
}

function validateOccupants(fields, occupants) {
  const adults = occupants.filter((item) => item.type_occupant === "adulte");
  const children = occupants.filter((item) => item.type_occupant === "enfant");
  const babies = occupants.filter((item) => item.type_occupant === "bebe");

  if (adults.length !== fields.nb_adultes) {
    return `Le nombre d'adultes (${fields.nb_adultes}) ne correspond pas aux occupants adultes (${adults.length}).`;
  }

  if (children.length !== fields.nbrs_enfants) {
    return `Le nombre d'enfants (${fields.nbrs_enfants}) ne correspond pas aux occupants enfants (${children.length}).`;
  }

  if (babies.length !== fields.nbrs_bebe) {
    return `Le nombre de bébés (${fields.nbrs_bebe}) ne correspond pas aux occupants bébés (${babies.length}).`;
  }

  for (const child of children) {
    if (child.age_enfant == null) {
      return "Chaque enfant doit avoir un âge.";
    }
  }

  return null;
}

async function fetchOccupants(connection, reservationId) {
  const [rows] = await connection.query(
    `
      SELECT
        o.id,
        o.reservation_id,
        o.type_occupant,
        o.nom,
        o.prenom,
        o.age_enfant,
        o.tranche_age_id,
        o.supplement_id,
        o.date_naissance,
        o.piece_identite,
        o.allergies_regime,
        o.prix_unitaire,
        o.prix_total,
        o.date_creation,
        ta.nom AS tranche_age_nom,
        s.nom AS supplement_nom
      FROM reservation_occupants o
      LEFT JOIN tranches_age ta ON ta.id = o.tranche_age_id
      LEFT JOIN supplements s ON s.id = o.supplement_id
      WHERE o.reservation_id = ?
      ORDER BY
        FIELD(o.type_occupant, 'adulte', 'enfant', 'bebe'),
        o.id ASC
    `,
    [reservationId]
  );

  return rows;
}

async function syncReservationOccupants(connection, reservationId, occupants) {
  await connection.query("DELETE FROM reservation_occupants WHERE reservation_id = ?", [
    reservationId,
  ]);

  for (const occupant of occupants) {
    await connection.query(
      `
        INSERT INTO reservation_occupants (
          reservation_id, type_occupant, nom, prenom,
          age_enfant, tranche_age_id, supplement_id, date_naissance, piece_identite,
          allergies_regime, prix_unitaire, prix_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        reservationId,
        occupant.type_occupant,
        occupant.nom,
        occupant.prenom,
        occupant.age_enfant,
        occupant.tranche_age_id,
        occupant.supplement_id,
        occupant.date_naissance,
        occupant.piece_identite,
        occupant.allergies_regime,
        occupant.prix_unitaire,
        occupant.prix_total,
      ]
    );
  }
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
  const occupants = await fetchOccupants(connection, id);

  return {
    ...row,
    client_nom: row.client_nom?.trim() || null,
    promotion_nom: row.promotion_nom || null,
    occupants,
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
    const occupants = pickOccupants(req.body);
    const validationError = await validateReservationRelations(connection, fields);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const occupantsError = validateOccupants(fields, occupants);

    if (occupantsError) {
      return res.status(400).json({ message: occupantsError });
    }

    // Garder age_enfant compatible (âge du premier enfant renseigné)
    if (occupants.some((item) => item.type_occupant === "enfant")) {
      const firstChild = occupants.find((item) => item.type_occupant === "enfant");
      fields.age_enfant = firstChild?.age_enfant ?? 0;
    }

    await connection.beginTransaction();

    const reference = await generateReference(connection);

    const [result] = await connection.query(
      `
        INSERT INTO reservations (
          reference, client_id, chambre_id, maison_id,
          date_arrivee, date_depart, nb_nuits, nb_adultes, nbrs_enfants, nbrs_bebe, age_enfant,
          source, promotion_id, type_reduction, valeur_reduction, supplement_id,
          prix_chambre_total, prix_bebe_total, prix_enfants_total,
          prix_total_ht, taux_tva_applique, montant_tva, prix_total_ttc,
          statut_reservation, statut_paiement, montant_paye, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        fields.type_reduction,
        fields.valeur_reduction,
        fields.supplement_id,
        fields.prix_chambre_total,
        fields.prix_bebe_total,
        fields.prix_enfants_total,
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

    await syncReservationOccupants(connection, result.insertId, occupants);
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
    const occupants = pickOccupants(req.body);
    const validationError = await validateReservationRelations(connection, fields, Number(id));

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const occupantsError = validateOccupants(fields, occupants);

    if (occupantsError) {
      return res.status(400).json({ message: occupantsError });
    }

    if (occupants.some((item) => item.type_occupant === "enfant")) {
      const firstChild = occupants.find((item) => item.type_occupant === "enfant");
      fields.age_enfant = firstChild?.age_enfant ?? 0;
    } else {
      fields.age_enfant = 0;
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
          source = ?, promotion_id = ?, type_reduction = ?, valeur_reduction = ?, supplement_id = ?,
          prix_chambre_total = ?, prix_bebe_total = ?, prix_enfants_total = ?,
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
        fields.type_reduction,
        fields.valeur_reduction,
        fields.supplement_id,
        fields.prix_chambre_total,
        fields.prix_bebe_total,
        fields.prix_enfants_total,
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

    await syncReservationOccupants(connection, id, occupants);
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

async function findOrCreatePublicClient(connection, clientInput = {}) {
  const nom = emptyToNull(String(clientInput.nom || "").trim());
  const prenom = emptyToNull(String(clientInput.prenom || "").trim());
  const email = emptyToNull(String(clientInput.email || "").trim().toLowerCase());
  const telephone = emptyToNull(String(clientInput.telephone || "").trim());
  const civilite = emptyToNull(String(clientInput.civilite || "").trim());
  const dateNaissance = emptyToNull(String(clientInput.date_naissance || "").trim());
  const numeroPiece = emptyToNull(
    String(clientInput.piece_identite || clientInput.numero_piece || "").trim()
  );
  const typePieceRaw = emptyToNull(String(clientInput.type_piece || "").trim());
  const typePiece =
    typePieceRaw && ["CIN", "Passeport", "Carte_sejour"].includes(typePieceRaw)
      ? typePieceRaw
      : null;

  if (!nom) {
    return { error: "Le nom du client est obligatoire." };
  }

  if (!email) {
    return { error: "L'email est obligatoire." };
  }

  if (!telephone) {
    return { error: "Le téléphone est obligatoire." };
  }

  const [existing] = await connection.query(
    "SELECT id FROM clients WHERE LOWER(email) = ? LIMIT 1",
    [email]
  );

  if (existing.length > 0) {
    await connection.query(
      `
        UPDATE clients SET
          civilite = COALESCE(?, civilite),
          nom = ?,
          prenom = COALESCE(?, prenom),
          telephone = COALESCE(?, telephone),
          date_naissance = COALESCE(?, date_naissance),
          type_piece = COALESCE(?, type_piece),
          numero_piece = COALESCE(?, numero_piece)
        WHERE id = ?
      `,
      [civilite, nom, prenom, telephone, dateNaissance, typePiece, numeroPiece, existing[0].id]
    );

    return { clientId: existing[0].id };
  }

  const [result] = await connection.query(
    `
      INSERT INTO clients (
        civilite, nom, prenom, date_naissance, type_piece, numero_piece,
        email, telephone, pays,
        is_vip, nb_reservations_total, montant_total_depense
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Maroc', 0, 0, 0)
    `,
    [civilite, nom, prenom, dateNaissance, typePiece, numeroPiece, email, telephone]
  );

  return { clientId: result.insertId };
}

async function createPublicReservation(req, res) {
  const connection = await pool.getConnection();

  try {
    const clientResult = await findOrCreatePublicClient(connection, req.body.client);

    if (clientResult.error) {
      return res.status(400).json({ message: clientResult.error });
    }

    const fields = pickReservationFields({
      ...req.body,
      client_id: clientResult.clientId,
      source: "site_web",
      statut_reservation: "en_attente",
      statut_paiement: "non_paye",
      montant_paye: 0,
      promotion_id: req.body.promotion_id ?? null,
      type_reduction: req.body.type_reduction ?? null,
      valeur_reduction: req.body.valeur_reduction ?? 0,
      supplement_id: null,
    });

    const occupants = pickOccupants(req.body);

    for (const occupant of occupants) {
      if (!occupant.nom || !occupant.prenom) {
        return res.status(400).json({
          message: "Chaque occupant doit avoir un nom et un prénom.",
        });
      }
    }

    const [maisonRows] = await connection.query(
      "SELECT id FROM maisons_hotes WHERE id = ? AND statut = 'actif' LIMIT 1",
      [fields.maison_id]
    );

    if (maisonRows.length === 0) {
      return res.status(400).json({ message: "Maison d'hôtes introuvable ou inactive." });
    }

    const validationError = await validateReservationRelations(connection, fields);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const occupantsError = validateOccupants(fields, occupants);

    if (occupantsError) {
      return res.status(400).json({ message: occupantsError });
    }

    if (occupants.some((item) => item.type_occupant === "enfant")) {
      const firstChild = occupants.find((item) => item.type_occupant === "enfant");
      fields.age_enfant = firstChild?.age_enfant ?? 0;
    }

    await connection.beginTransaction();

    const reference = await generateReference(connection);

    const [result] = await connection.query(
      `
        INSERT INTO reservations (
          reference, client_id, chambre_id, maison_id,
          date_arrivee, date_depart, nb_nuits, nb_adultes, nbrs_enfants, nbrs_bebe, age_enfant,
          source, promotion_id, type_reduction, valeur_reduction, supplement_id,
          prix_chambre_total, prix_bebe_total, prix_enfants_total,
          prix_total_ht, taux_tva_applique, montant_tva, prix_total_ttc,
          statut_reservation, statut_paiement, montant_paye, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        fields.type_reduction,
        fields.valeur_reduction,
        fields.supplement_id,
        fields.prix_chambre_total,
        fields.prix_bebe_total,
        fields.prix_enfants_total,
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

    await syncReservationOccupants(connection, result.insertId, occupants);
    await syncClientReservationStats(connection, fields.client_id);
    await connection.commit();

    const reservation = await fetchReservationById(pool, result.insertId);

    return res.status(201).json({
      message: "Demande de réservation enregistrée avec succès.",
      reservation,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating public reservation:", error);
    return res.status(500).json({ message: "Impossible d'enregistrer la réservation." });
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
  createPublicReservation,
};
