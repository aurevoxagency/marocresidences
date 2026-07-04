const { pool } = require("../../database/db");

const CIVILITES = new Set(["M.", "Mme", "Mlle"]);
const SOURCES = new Set([
  "site_web",
  "reseaux_sociaux",
  "booking",
  "airbnb",
  "agence",
  "bouche_a_oreille",
  "walk_in",
  "autre",
]);
const STATUTS = new Set([
  "nouveau",
  "contacte",
  "en_negociation",
  "converti",
  "perdu",
]);

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

function pickProspectFields(body = {}) {
  return {
    civilite: CIVILITES.has(body.civilite) ? body.civilite : null,
    nom: body.nom?.trim() || null,
    prenom: emptyToNull(body.prenom?.trim()),
    email: emptyToNull(body.email?.trim()?.toLowerCase()),
    telephone: emptyToNull(body.telephone?.trim()),
    pays: emptyToNull(body.pays?.trim()),
    source: SOURCES.has(body.source) ? body.source : "autre",
    canal_contact: emptyToNull(body.canal_contact?.trim()),
    maison_id: toIntOrNull(body.maison_id),
    date_arrivee_souhaitee: emptyToNull(body.date_arrivee_souhaitee),
    date_depart_souhaitee: emptyToNull(body.date_depart_souhaitee),
    nb_personnes: toIntOrNull(body.nb_personnes),
    budget_estime: toNumberOrNull(body.budget_estime),
    message: emptyToNull(body.message?.trim()),
    notes_internes: emptyToNull(body.notes_internes?.trim()),
    statut: STATUTS.has(body.statut) ? body.statut : "nouveau",
    assigne_a: emptyToNull(body.assigne_a?.trim()),
    date_premier_contact: emptyToNull(body.date_premier_contact),
    date_dernier_contact: emptyToNull(body.date_dernier_contact),
    raison_perte: emptyToNull(body.raison_perte?.trim()),
  };
}

async function getProspects(req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          p.*,
          m.nom AS maison_nom
        FROM prospects p
        LEFT JOIN maisons_hotes m ON m.id = p.maison_id
        ORDER BY p.date_maj DESC
      `
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching prospects:", error);
    return res.status(500).json({ message: "Unable to fetch prospects." });
  }
}

async function getProspectById(req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          p.*,
          m.nom AS maison_nom
        FROM prospects p
        LEFT JOIN maisons_hotes m ON m.id = p.maison_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Prospect not found." });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching prospect:", error);
    return res.status(500).json({ message: "Unable to fetch prospect." });
  }
}

async function createProspect(req, res) {
  try {
    const fields = pickProspectFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est obligatoire." });
    }

    const [result] = await pool.query(
      `
        INSERT INTO prospects (
          civilite, nom, prenom, email, telephone, pays,
          source, canal_contact, maison_id,
          date_arrivee_souhaitee, date_depart_souhaitee, nb_personnes, budget_estime,
          message, notes_internes, statut, assigne_a,
          date_premier_contact, date_dernier_contact, raison_perte
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        fields.civilite,
        fields.nom,
        fields.prenom,
        fields.email,
        fields.telephone,
        fields.pays,
        fields.source,
        fields.canal_contact,
        fields.maison_id,
        fields.date_arrivee_souhaitee,
        fields.date_depart_souhaitee,
        fields.nb_personnes,
        fields.budget_estime,
        fields.message,
        fields.notes_internes,
        fields.statut,
        fields.assigne_a,
        fields.date_premier_contact,
        fields.date_dernier_contact,
        fields.raison_perte,
      ]
    );

    const [rows] = await pool.query(
      `
        SELECT
          p.*,
          m.nom AS maison_nom
        FROM prospects p
        LEFT JOIN maisons_hotes m ON m.id = p.maison_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      message: "Prospect créé avec succès.",
      prospect: rows[0],
    });
  } catch (error) {
    console.error("Error creating prospect:", error);
    return res.status(500).json({ message: "Unable to create prospect." });
  }
}

async function updateProspect(req, res) {
  try {
    const { id } = req.params;
    const fields = pickProspectFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est obligatoire." });
    }

    const [result] = await pool.query(
      `
        UPDATE prospects SET
          civilite = ?, nom = ?, prenom = ?, email = ?, telephone = ?, pays = ?,
          source = ?, canal_contact = ?, maison_id = ?,
          date_arrivee_souhaitee = ?, date_depart_souhaitee = ?, nb_personnes = ?, budget_estime = ?,
          message = ?, notes_internes = ?, statut = ?, assigne_a = ?,
          date_premier_contact = ?, date_dernier_contact = ?, raison_perte = ?
        WHERE id = ?
      `,
      [
        fields.civilite,
        fields.nom,
        fields.prenom,
        fields.email,
        fields.telephone,
        fields.pays,
        fields.source,
        fields.canal_contact,
        fields.maison_id,
        fields.date_arrivee_souhaitee,
        fields.date_depart_souhaitee,
        fields.nb_personnes,
        fields.budget_estime,
        fields.message,
        fields.notes_internes,
        fields.statut,
        fields.assigne_a,
        fields.date_premier_contact,
        fields.date_dernier_contact,
        fields.raison_perte,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Prospect not found." });
    }

    const [rows] = await pool.query(
      `
        SELECT
          p.*,
          m.nom AS maison_nom
        FROM prospects p
        LEFT JOIN maisons_hotes m ON m.id = p.maison_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [id]
    );

    return res.status(200).json({
      message: "Prospect mis à jour avec succès.",
      prospect: rows[0],
    });
  } catch (error) {
    console.error("Error updating prospect:", error);
    return res.status(500).json({ message: "Unable to update prospect." });
  }
}

async function deleteProspect(req, res) {
  try {
    const [result] = await pool.query("DELETE FROM prospects WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Prospect not found." });
    }

    return res.status(200).json({ message: "Prospect supprimé avec succès." });
  } catch (error) {
    console.error("Error deleting prospect:", error);
    return res.status(500).json({ message: "Unable to delete prospect." });
  }
}

module.exports = {
  getProspects,
  getProspectById,
  createProspect,
  updateProspect,
  deleteProspect,
};
