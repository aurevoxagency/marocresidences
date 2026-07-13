const { pool } = require("../../database/db");

const STATUTS = new Set(["en_attente", "publie", "masque", "signale"]);

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

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 45);
  }

  return (req.socket?.remoteAddress || req.ip || "").toString().slice(0, 45) || null;
}

function mapAvisRow(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    note: Number(row.note),
    maison_nom: row.maison_nom || null,
    maison_ville: row.maison_ville || null,
  };
}

const AVIS_SELECT = `
  SELECT
    a.id,
    a.maison_id,
    a.nom,
    a.email,
    a.note,
    a.titre,
    a.commentaire,
    a.reponse_gerant,
    a.date_reponse,
    a.ip_soumission,
    a.statut,
    a.date_creation,
    a.date_maj,
    m.nom AS maison_nom,
    m.ville AS maison_ville
  FROM avis_clients a
  INNER JOIN maisons_hotes m ON m.id = a.maison_id
`;

async function getAvis(req, res) {
  try {
    const maisonId = toIntOrDefault(req.query.maison_id, 0);
    const statut = emptyToNull(req.query.statut);
    const params = [];
    let query = `${AVIS_SELECT} WHERE 1 = 1`;

    if (maisonId) {
      query += " AND a.maison_id = ?";
      params.push(maisonId);
    }

    if (statut && STATUTS.has(statut)) {
      query += " AND a.statut = ?";
      params.push(statut);
    }

    query += " ORDER BY a.date_creation DESC, a.id DESC";

    const [rows] = await pool.query(query, params);
    return res.status(200).json(rows.map(mapAvisRow));
  } catch (error) {
    console.error("Error fetching avis clients:", error);
    return res.status(500).json({ message: "Impossible de charger les avis." });
  }
}

async function getAvisById(req, res) {
  try {
    const [rows] = await pool.query(`${AVIS_SELECT} WHERE a.id = ? LIMIT 1`, [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Avis introuvable." });
    }

    return res.status(200).json(mapAvisRow(rows[0]));
  } catch (error) {
    console.error("Error fetching avis:", error);
    return res.status(500).json({ message: "Impossible de charger l'avis." });
  }
}

async function getPublishedAvis(_req, res) {
  try {
    const [rows] = await pool.query(
      `
        ${AVIS_SELECT}
        WHERE a.statut = 'publie'
        ORDER BY a.date_creation DESC, a.id DESC
      `
    );

    return res.status(200).json(
      rows.map((row) => ({
        id: Number(row.id),
        nom: row.nom,
        note: Number(row.note),
        titre: row.titre || null,
        commentaire: row.commentaire,
        maison_nom: row.maison_nom || null,
        maison_ville: row.maison_ville || null,
        date_creation: row.date_creation,
      }))
    );
  } catch (error) {
    console.error("Error fetching published avis:", error);
    return res.status(500).json({ message: "Impossible de charger les avis." });
  }
}

async function createPublicAvis(req, res) {
  try {
    const maisonId = toIntOrDefault(req.body.maison_id, 0);
    const nom = emptyToNull(String(req.body.nom || "").trim());
    const email = emptyToNull(String(req.body.email || "").trim().toLowerCase());
    const note = toIntOrDefault(req.body.note, 0);
    const titre = emptyToNull(String(req.body.titre || "").trim());
    const commentaire = emptyToNull(String(req.body.commentaire || "").trim());

    if (!maisonId) {
      return res.status(400).json({ message: "La maison est obligatoire." });
    }

    if (!nom) {
      return res.status(400).json({ message: "Le nom est obligatoire." });
    }

    if (!email) {
      return res.status(400).json({ message: "L'email est obligatoire." });
    }

    if (note < 1 || note > 5) {
      return res.status(400).json({ message: "La note doit être entre 1 et 5." });
    }

    if (!commentaire || commentaire.length < 20) {
      return res.status(400).json({
        message: "Le commentaire doit contenir au moins 20 caractères.",
      });
    }

    const [maisonRows] = await pool.query(
      "SELECT id FROM maisons_hotes WHERE id = ? AND statut = 'actif' LIMIT 1",
      [maisonId]
    );

    if (maisonRows.length === 0) {
      return res.status(400).json({ message: "Maison d'hôtes introuvable." });
    }

    const [result] = await pool.query(
      `
        INSERT INTO avis_clients (
          maison_id, nom, email, note, titre, commentaire,
          ip_soumission, statut
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente')
      `,
      [maisonId, nom, email, note, titre, commentaire, getClientIp(req)]
    );

    const [rows] = await pool.query(`${AVIS_SELECT} WHERE a.id = ? LIMIT 1`, [
      result.insertId,
    ]);

    return res.status(201).json({
      message: "Avis envoyé avec succès. Il sera visible après validation.",
      avis: mapAvisRow(rows[0]),
    });
  } catch (error) {
    console.error("Error creating public avis:", error);
    return res.status(500).json({ message: "Impossible d'enregistrer l'avis." });
  }
}

async function updateAvis(req, res) {
  try {
    const id = toIntOrDefault(req.params.id, 0);
    const [existing] = await pool.query(
      "SELECT id FROM avis_clients WHERE id = ? LIMIT 1",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Avis introuvable." });
    }

    const updates = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "statut")) {
      const statut = emptyToNull(req.body.statut);

      if (!statut || !STATUTS.has(statut)) {
        return res.status(400).json({ message: "Statut invalide." });
      }

      updates.push("statut = ?");
      params.push(statut);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "reponse_gerant")) {
      const reponseGerant = emptyToNull(
        String(req.body.reponse_gerant || "").trim()
      );
      let dateReponse = emptyToNull(req.body.date_reponse);

      if (reponseGerant && !dateReponse) {
        dateReponse = new Date().toISOString().slice(0, 10);
      }

      if (!reponseGerant) {
        dateReponse = null;
      }

      updates.push("reponse_gerant = ?", "date_reponse = ?");
      params.push(reponseGerant, dateReponse);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Aucune modification fournie." });
    }

    params.push(id);
    await pool.query(
      `UPDATE avis_clients SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    const [rows] = await pool.query(`${AVIS_SELECT} WHERE a.id = ? LIMIT 1`, [id]);

    return res.status(200).json({
      message: "Avis mis à jour.",
      avis: mapAvisRow(rows[0]),
    });
  } catch (error) {
    console.error("Error updating avis:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour l'avis." });
  }
}

async function deleteAvis(req, res) {
  try {
    const [result] = await pool.query("DELETE FROM avis_clients WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Avis introuvable." });
    }

    return res.status(200).json({ message: "Avis supprimé." });
  } catch (error) {
    console.error("Error deleting avis:", error);
    return res.status(500).json({ message: "Impossible de supprimer l'avis." });
  }
}

module.exports = {
  getAvis,
  getAvisById,
  getPublishedAvis,
  createPublicAvis,
  updateAvis,
  deleteAvis,
};
