const { pool } = require("../../database/db");

const TYPE_REDUCTION = new Set(["pourcentage", "valeur"]);
const TYPE_CONDITION = new Set([
  "early_booking",
  "last_minute",
  "duree_minimum",
  "code_promo",
  "saisonniere",
  "sans_condition",
]);
const APPLICABLE_A = new Set(["toutes_chambres", "categorie", "chambre_specifique"]);
const STATUTS = new Set(["active", "inactive", "expiree"]);

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
  return Number.isFinite(number) ? number : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return value === true || value === 1 || value === "1" || value === "true";
}

function pickPromotionFields(body = {}) {
  const applicableA = APPLICABLE_A.has(body.applicable_a)
    ? body.applicable_a
    : "toutes_chambres";

  return {
    maison_id: toIntOrNull(body.maison_id),
    nom: body.nom?.trim() || null,
    code_promo: emptyToNull(body.code_promo?.trim()?.toUpperCase()),
    description: emptyToNull(body.description?.trim()),
    type_reduction: TYPE_REDUCTION.has(body.type_reduction) ? body.type_reduction : "pourcentage",
    valeur_reduction: toDecimalOrDefault(body.valeur_reduction, 0),
    type_condition: TYPE_CONDITION.has(body.type_condition)
      ? body.type_condition
      : "sans_condition",
    jours_avant_min: toIntOrNull(body.jours_avant_min),
    jours_avant_max: toIntOrNull(body.jours_avant_max),
    duree_sejour_min: toIntOrNull(body.duree_sejour_min),
    applicable_a: applicableA,
    categorie_id: applicableA === "categorie" ? toIntOrNull(body.categorie_id) : null,
    chambre_id: applicableA === "chambre_specifique" ? toIntOrNull(body.chambre_id) : null,
    inclut_supplements: toBool(body.inclut_supplements),
    date_debut_validite: emptyToNull(body.date_debut_validite),
    date_fin_validite: emptyToNull(body.date_fin_validite),
    date_debut_sejour: emptyToNull(body.date_debut_sejour),
    date_fin_sejour: emptyToNull(body.date_fin_sejour),
    utilisation_max: toIntOrNull(body.utilisation_max),
    cumulable: toBool(body.cumulable),
    statut: STATUTS.has(body.statut) ? body.statut : "active",
  };
}

function validatePromotionFields(fields) {
  if (!fields.nom) {
    return "Le nom est requis.";
  }

  if (!fields.date_debut_validite || !fields.date_fin_validite) {
    return "Les dates de validité sont requises.";
  }

  if (fields.date_fin_validite < fields.date_debut_validite) {
    return "La date de fin de validité doit être postérieure à la date de début.";
  }

  if (
    fields.date_debut_sejour &&
    fields.date_fin_sejour &&
    fields.date_fin_sejour < fields.date_debut_sejour
  ) {
    return "La date de fin de séjour doit être postérieure à la date de début.";
  }

  if (fields.type_reduction === "pourcentage" && fields.valeur_reduction > 100) {
    return "Le pourcentage de réduction ne peut pas dépasser 100.";
  }

  if (fields.valeur_reduction <= 0) {
    return "La valeur de réduction doit être supérieure à 0.";
  }

  if (fields.type_condition === "code_promo" && !fields.code_promo) {
    return "Un code promo est requis pour ce type de condition.";
  }

  if (fields.applicable_a === "categorie" && !fields.categorie_id) {
    return "Une catégorie de chambre est requise.";
  }

  if (fields.applicable_a === "chambre_specifique" && !fields.chambre_id) {
    return "Une chambre est requise.";
  }

  if (fields.type_condition === "duree_minimum" && !fields.duree_sejour_min) {
    return "La durée minimale de séjour est requise.";
  }

  return null;
}

const PROMOTION_SELECT = `
  SELECT
    p.*,
    m.nom AS maison_nom,
    cc.nom AS categorie_nom,
    c.nom AS chambre_nom
  FROM promotions p
  LEFT JOIN maisons_hotes m ON m.id = p.maison_id
  LEFT JOIN categories_chambre cc ON cc.id = p.categorie_id
  LEFT JOIN chambres c ON c.id = p.chambre_id
`;

async function getPromotions(req, res) {
  try {
    const maisonId = toIntOrNull(req.query.maison_id);
    const params = [];
    let whereClause = "";

    if (maisonId) {
      whereClause = "WHERE p.maison_id = ? OR p.maison_id IS NULL";
      params.push(maisonId);
    }

    const [rows] = await pool.query(
      `
        ${PROMOTION_SELECT}
        ${whereClause}
        ORDER BY p.date_creation DESC
      `,
      params
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return res.status(500).json({ message: "Impossible de charger les promotions." });
  }
}

async function getPromotionById(req, res) {
  try {
    const [rows] = await pool.query(
      `
        ${PROMOTION_SELECT}
        WHERE p.id = ?
        LIMIT 1
      `,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Promotion introuvable." });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching promotion:", error);
    return res.status(500).json({ message: "Impossible de charger la promotion." });
  }
}

async function createPromotion(req, res) {
  try {
    const fields = pickPromotionFields(req.body);
    const validationError = validatePromotionFields(fields);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const [result] = await pool.query(
      `
        INSERT INTO promotions (
          maison_id, nom, code_promo, description,
          type_reduction, valeur_reduction, type_condition,
          jours_avant_min, jours_avant_max, duree_sejour_min,
          applicable_a, categorie_id, chambre_id, inclut_supplements,
          date_debut_validite, date_fin_validite,
          date_debut_sejour, date_fin_sejour,
          utilisation_max, utilisation_actuelle, cumulable, statut
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `,
      [
        fields.maison_id,
        fields.nom,
        fields.code_promo,
        fields.description,
        fields.type_reduction,
        fields.valeur_reduction,
        fields.type_condition,
        fields.jours_avant_min,
        fields.jours_avant_max,
        fields.duree_sejour_min,
        fields.applicable_a,
        fields.categorie_id,
        fields.chambre_id,
        fields.inclut_supplements ? 1 : 0,
        fields.date_debut_validite,
        fields.date_fin_validite,
        fields.date_debut_sejour,
        fields.date_fin_sejour,
        fields.utilisation_max,
        fields.cumulable ? 1 : 0,
        fields.statut,
      ]
    );

    const [rows] = await pool.query(
      `
        ${PROMOTION_SELECT}
        WHERE p.id = ?
        LIMIT 1
      `,
      [result.insertId]
    );

    return res.status(201).json({
      message: "Promotion créée avec succès.",
      promotion: rows[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ce code promo existe déjà." });
    }

    console.error("Error creating promotion:", error);
    return res.status(500).json({ message: "Impossible de créer la promotion." });
  }
}

async function updatePromotion(req, res) {
  try {
    const fields = pickPromotionFields(req.body);
    const validationError = validatePromotionFields(fields);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const [result] = await pool.query(
      `
        UPDATE promotions
        SET
          maison_id = ?,
          nom = ?,
          code_promo = ?,
          description = ?,
          type_reduction = ?,
          valeur_reduction = ?,
          type_condition = ?,
          jours_avant_min = ?,
          jours_avant_max = ?,
          duree_sejour_min = ?,
          applicable_a = ?,
          categorie_id = ?,
          chambre_id = ?,
          inclut_supplements = ?,
          date_debut_validite = ?,
          date_fin_validite = ?,
          date_debut_sejour = ?,
          date_fin_sejour = ?,
          utilisation_max = ?,
          cumulable = ?,
          statut = ?
        WHERE id = ?
      `,
      [
        fields.maison_id,
        fields.nom,
        fields.code_promo,
        fields.description,
        fields.type_reduction,
        fields.valeur_reduction,
        fields.type_condition,
        fields.jours_avant_min,
        fields.jours_avant_max,
        fields.duree_sejour_min,
        fields.applicable_a,
        fields.categorie_id,
        fields.chambre_id,
        fields.inclut_supplements ? 1 : 0,
        fields.date_debut_validite,
        fields.date_fin_validite,
        fields.date_debut_sejour,
        fields.date_fin_sejour,
        fields.utilisation_max,
        fields.cumulable ? 1 : 0,
        fields.statut,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Promotion introuvable." });
    }

    const [rows] = await pool.query(
      `
        ${PROMOTION_SELECT}
        WHERE p.id = ?
        LIMIT 1
      `,
      [req.params.id]
    );

    return res.status(200).json({
      message: "Promotion mise à jour.",
      promotion: rows[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ce code promo existe déjà." });
    }

    console.error("Error updating promotion:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour la promotion." });
  }
}

async function deletePromotion(req, res) {
  try {
    const [result] = await pool.query("DELETE FROM promotions WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Promotion introuvable." });
    }

    return res.status(200).json({ message: "Promotion supprimée." });
  } catch (error) {
    console.error("Error deleting promotion:", error);
    return res.status(500).json({ message: "Impossible de supprimer la promotion." });
  }
}

module.exports = {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
