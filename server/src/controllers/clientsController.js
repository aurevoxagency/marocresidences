const { pool } = require("../../database/db");

const CIVILITES = new Set(["M.", "Mme", "Mlle"]);
const TYPES_PIECE = new Set(["CIN", "Passeport", "Carte_sejour"]);

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

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toBool(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function pickClientFields(body = {}) {
  return {
    prospect_id: toIntOrNull(body.prospect_id),
    civilite: CIVILITES.has(body.civilite) ? body.civilite : null,
    nom: body.nom?.trim() || null,
    prenom: emptyToNull(body.prenom?.trim()),
    date_naissance: emptyToNull(body.date_naissance),
    nationalite: emptyToNull(body.nationalite?.trim()),
    type_piece: TYPES_PIECE.has(body.type_piece) ? body.type_piece : null,
    numero_piece: emptyToNull(body.numero_piece?.trim()),
    email: emptyToNull(body.email?.trim()?.toLowerCase()),
    telephone: emptyToNull(body.telephone?.trim()),
    adresse: emptyToNull(body.adresse?.trim()),
    ville: emptyToNull(body.ville?.trim()),
    pays: emptyToNull(body.pays?.trim()),
    langue_preferee: emptyToNull(body.langue_preferee?.trim()),
    allergies_regime: emptyToNull(body.allergies_regime?.trim()),
    notes_preferences: emptyToNull(body.notes_preferences?.trim()),
    is_vip: toBool(body.is_vip),
    nb_reservations_total: toIntOrNull(body.nb_reservations_total) ?? 0,
    montant_total_depense: toNumberOrNull(body.montant_total_depense) ?? 0,
    date_premiere_reservation: emptyToNull(body.date_premiere_reservation),
    date_derniere_reservation: emptyToNull(body.date_derniere_reservation),
  };
}

async function getClients(req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          c.*,
          CONCAT(COALESCE(p.prenom, ''), ' ', COALESCE(p.nom, '')) AS prospect_nom
        FROM clients c
        LEFT JOIN prospects p ON p.id = c.prospect_id
        ORDER BY c.date_maj DESC
      `
    );

    return res.status(200).json(
      rows.map((row) => ({
        ...row,
        is_vip: Boolean(row.is_vip),
        prospect_nom: row.prospect_nom?.trim() || null,
      }))
    );
  } catch (error) {
    console.error("Error fetching clients:", error);
    return res.status(500).json({ message: "Unable to fetch clients." });
  }
}

async function getClientById(req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          c.*,
          CONCAT(COALESCE(p.prenom, ''), ' ', COALESCE(p.nom, '')) AS prospect_nom
        FROM clients c
        LEFT JOIN prospects p ON p.id = c.prospect_id
        WHERE c.id = ?
        LIMIT 1
      `,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Client not found." });
    }

    return res.status(200).json({
      ...rows[0],
      is_vip: Boolean(rows[0].is_vip),
      prospect_nom: rows[0].prospect_nom?.trim() || null,
    });
  } catch (error) {
    console.error("Error fetching client:", error);
    return res.status(500).json({ message: "Unable to fetch client." });
  }
}

async function createClient(req, res) {
  try {
    const fields = pickClientFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est obligatoire." });
    }

    const [result] = await pool.query(
      `
        INSERT INTO clients (
          prospect_id, civilite, nom, prenom, date_naissance, nationalite,
          type_piece, numero_piece, email, telephone, adresse, ville, pays,
          langue_preferee, allergies_regime, notes_preferences,
          is_vip, nb_reservations_total, montant_total_depense,
          date_premiere_reservation, date_derniere_reservation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        fields.prospect_id,
        fields.civilite,
        fields.nom,
        fields.prenom,
        fields.date_naissance,
        fields.nationalite,
        fields.type_piece,
        fields.numero_piece,
        fields.email,
        fields.telephone,
        fields.adresse,
        fields.ville,
        fields.pays,
        fields.langue_preferee,
        fields.allergies_regime,
        fields.notes_preferences,
        fields.is_vip ? 1 : 0,
        fields.nb_reservations_total,
        fields.montant_total_depense,
        fields.date_premiere_reservation,
        fields.date_derniere_reservation,
      ]
    );

    const [rows] = await pool.query(
      `
        SELECT
          c.*,
          CONCAT(COALESCE(p.prenom, ''), ' ', COALESCE(p.nom, '')) AS prospect_nom
        FROM clients c
        LEFT JOIN prospects p ON p.id = c.prospect_id
        WHERE c.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      message: "Client créé avec succès.",
      client: {
        ...rows[0],
        is_vip: Boolean(rows[0].is_vip),
        prospect_nom: rows[0].prospect_nom?.trim() || null,
      },
    });
  } catch (error) {
    console.error("Error creating client:", error);
    return res.status(500).json({ message: "Unable to create client." });
  }
}

async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const fields = pickClientFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est obligatoire." });
    }

    const [result] = await pool.query(
      `
        UPDATE clients SET
          prospect_id = ?, civilite = ?, nom = ?, prenom = ?, date_naissance = ?, nationalite = ?,
          type_piece = ?, numero_piece = ?, email = ?, telephone = ?, adresse = ?, ville = ?, pays = ?,
          langue_preferee = ?, allergies_regime = ?, notes_preferences = ?,
          is_vip = ?, nb_reservations_total = ?, montant_total_depense = ?,
          date_premiere_reservation = ?, date_derniere_reservation = ?
        WHERE id = ?
      `,
      [
        fields.prospect_id,
        fields.civilite,
        fields.nom,
        fields.prenom,
        fields.date_naissance,
        fields.nationalite,
        fields.type_piece,
        fields.numero_piece,
        fields.email,
        fields.telephone,
        fields.adresse,
        fields.ville,
        fields.pays,
        fields.langue_preferee,
        fields.allergies_regime,
        fields.notes_preferences,
        fields.is_vip ? 1 : 0,
        fields.nb_reservations_total,
        fields.montant_total_depense,
        fields.date_premiere_reservation,
        fields.date_derniere_reservation,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Client not found." });
    }

    const [rows] = await pool.query(
      `
        SELECT
          c.*,
          CONCAT(COALESCE(p.prenom, ''), ' ', COALESCE(p.nom, '')) AS prospect_nom
        FROM clients c
        LEFT JOIN prospects p ON p.id = c.prospect_id
        WHERE c.id = ?
        LIMIT 1
      `,
      [id]
    );

    return res.status(200).json({
      message: "Client mis à jour avec succès.",
      client: {
        ...rows[0],
        is_vip: Boolean(rows[0].is_vip),
        prospect_nom: rows[0].prospect_nom?.trim() || null,
      },
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return res.status(500).json({ message: "Unable to update client." });
  }
}

async function deleteClient(req, res) {
  try {
    const [result] = await pool.query("DELETE FROM clients WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Client not found." });
    }

    return res.status(200).json({ message: "Client supprimé avec succès." });
  } catch (error) {
    console.error("Error deleting client:", error);
    return res.status(500).json({ message: "Unable to delete client." });
  }
}

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};
