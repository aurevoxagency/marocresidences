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

const SOURCE_LABELS = {
  site_web: "Site web",
  reseaux_sociaux: "Réseaux sociaux",
  booking: "Booking",
  airbnb: "Airbnb",
  agence: "Agence",
  bouche_a_oreille: "Bouche à oreille",
  walk_in: "Walk-in",
  autre: "Autre",
};

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

function formatDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function buildClientNotesFromProspect(prospect) {
  const lines = [];

  if (prospect.notes_internes) {
    lines.push(String(prospect.notes_internes).trim());
  }

  if (prospect.message) {
    lines.push(`Message initial : ${String(prospect.message).trim()}`);
  }

  const details = [];
  const sourceLabel = SOURCE_LABELS[prospect.source] || prospect.source;
  if (sourceLabel) details.push(`Source : ${sourceLabel}`);
  if (prospect.canal_contact) details.push(`Canal : ${prospect.canal_contact}`);
  if (prospect.maison_nom) details.push(`Maison : ${prospect.maison_nom}`);

  const arrivee = formatDateOnly(prospect.date_arrivee_souhaitee);
  const depart = formatDateOnly(prospect.date_depart_souhaitee);
  if (arrivee || depart) {
    details.push(
      `Séjour souhaité : ${arrivee || "?"} → ${depart || "?"}`
    );
  }

  if (prospect.nb_personnes != null) {
    details.push(`Personnes : ${prospect.nb_personnes}`);
  }

  if (prospect.budget_estime != null && prospect.budget_estime !== "") {
    details.push(`Budget estimé : ${prospect.budget_estime}`);
  }

  if (prospect.assigne_a) {
    details.push(`Assigné à : ${prospect.assigne_a}`);
  }

  const premierContact = formatDateOnly(prospect.date_premier_contact);
  const dernierContact = formatDateOnly(prospect.date_dernier_contact);
  if (premierContact) details.push(`Premier contact : ${premierContact}`);
  if (dernierContact) details.push(`Dernier contact : ${dernierContact}`);

  if (details.length > 0) {
    lines.push(`Infos prospect :\n- ${details.join("\n- ")}`);
  }

  return lines.length > 0 ? lines.join("\n\n") : null;
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

async function convertProspectToClient(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [prospectRows] = await connection.query(
      `
        SELECT
          p.*,
          m.nom AS maison_nom
        FROM prospects p
        LEFT JOIN maisons_hotes m ON m.id = p.maison_id
        WHERE p.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [id]
    );

    if (prospectRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Prospect introuvable." });
    }

    const prospect = prospectRows[0];

    if (prospect.statut === "converti") {
      await connection.rollback();
      return res.status(409).json({
        message: "Ce prospect est déjà converti en client.",
      });
    }

    const civilite = CIVILITES.has(prospect.civilite) ? prospect.civilite : null;
    const nom = String(prospect.nom || "").trim();
    const prenom = emptyToNull(String(prospect.prenom || "").trim());
    const email = emptyToNull(String(prospect.email || "").trim().toLowerCase());
    const telephone = emptyToNull(String(prospect.telephone || "").trim());
    const pays = emptyToNull(String(prospect.pays || "").trim());
    const notesPreferences = buildClientNotesFromProspect(prospect);

    if (!nom) {
      await connection.rollback();
      return res.status(400).json({
        message: "Le prospect doit avoir un nom pour être converti.",
      });
    }

    if (email) {
      const [existingByEmail] = await connection.query(
        "SELECT id FROM clients WHERE email = ? LIMIT 1",
        [email]
      );

      if (existingByEmail.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          message: "Un client avec le même email existe déjà.",
        });
      }
    }

    const [insertResult] = await connection.query(
      `
        INSERT INTO clients (
          civilite, nom, prenom, date_naissance, nationalite,
          type_piece, numero_piece, email, telephone, adresse, ville, pays,
          langue_preferee, allergies_regime, notes_preferences,
          is_vip, nb_reservations_total, montant_total_depense,
          date_premiere_reservation, date_derniere_reservation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        civilite,
        nom,
        prenom,
        null,
        null,
        null,
        null,
        email,
        telephone,
        null,
        null,
        pays,
        null,
        null,
        notesPreferences,
        0,
        0,
        0,
        null,
        null,
      ]
    );

    await connection.query(
      "UPDATE prospects SET statut = 'converti' WHERE id = ?",
      [id]
    );

    const [clientRows] = await connection.query(
      "SELECT * FROM clients WHERE id = ? LIMIT 1",
      [insertResult.insertId]
    );

    const [updatedProspectRows] = await connection.query(
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

    await connection.commit();

    return res.status(201).json({
      message: "Prospect converti en client avec succès.",
      client: {
        ...clientRows[0],
        is_vip: Boolean(clientRows[0].is_vip),
      },
      prospect: updatedProspectRows[0],
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error converting prospect:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Un client avec ces informations existe déjà.",
      });
    }

    return res.status(500).json({
      message: "Impossible de convertir le prospect en client.",
    });
  } finally {
    connection.release();
  }
}

module.exports = {
  getProspects,
  getProspectById,
  createProspect,
  updateProspect,
  deleteProspect,
  convertProspectToClient,
};
