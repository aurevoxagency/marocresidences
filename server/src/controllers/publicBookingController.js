const { pool } = require("../../database/db");

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

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function todayIsoLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function findSaisonId(saisons, dateArrivee) {
  if (!dateArrivee || !saisons.length) {
    return saisons[0]?.id ?? null;
  }

  const match = saisons.find((saison) => {
    const start = String(saison.date_debut).slice(0, 10);
    const end = String(saison.date_fin).slice(0, 10);
    return dateArrivee >= start && dateArrivee <= end;
  });

  return match?.id ?? saisons[0]?.id ?? null;
}

function promotionAppliesToChambre(promotion, chambre) {
  if (promotion.maison_id != null && Number(promotion.maison_id) !== Number(chambre.maison_id)) {
    return false;
  }

  if (promotion.applicable_a === "toutes_chambres") {
    return true;
  }

  if (promotion.applicable_a === "categorie") {
    return Number(promotion.categorie_id) === Number(chambre.categorie_id);
  }

  if (promotion.applicable_a === "chambre_specifique") {
    return Number(promotion.chambre_id) === Number(chambre.id);
  }

  return false;
}

function getPromotionSavings(price, promotion) {
  const base = Number(price);

  if (!Number.isFinite(base) || base <= 0 || !promotion) {
    return 0;
  }

  const value = Number(promotion.valeur_reduction);

  if (promotion.type_reduction === "pourcentage") {
    return base * (value / 100);
  }

  return Math.min(base, value);
}

function pickBestPromotionForChambre(promotions, prixAdulte) {
  if (promotions.length === 0) {
    return null;
  }

  let best = promotions[0];
  let bestSavings = getPromotionSavings(prixAdulte, best);

  for (let index = 1; index < promotions.length; index += 1) {
    const candidate = promotions[index];
    const savings = getPromotionSavings(prixAdulte, candidate);

    if (savings > bestSavings) {
      best = candidate;
      bestSavings = savings;
    }
  }

  return {
    id: best.id,
    nom: best.nom,
    type_reduction: best.type_reduction,
    valeur_reduction: Number(best.valeur_reduction),
  };
}

async function loadChambresWithTarifs(maisonId, saisonId) {
  const [rows] = await pool.query(
    `
      SELECT
        c.id,
        c.maison_id,
        c.nom,
        c.categorie_id,
        c.type_id,
        c.allotement,
        c.capacite_max,
        c.statut,
        cc.nom AS categorie_nom,
        tc.nom AS type_nom
      FROM chambres c
      INNER JOIN categories_chambre cc ON cc.id = c.categorie_id
      INNER JOIN types_chambre tc ON tc.id = c.type_id
      WHERE c.maison_id = ?
        AND c.statut = 'actif'
      ORDER BY c.nom ASC
    `,
    [maisonId]
  );

  if (rows.length === 0) {
    return [];
  }

  const [promotions] = await pool.query(
    `
      SELECT
        id,
        nom,
        type_reduction,
        valeur_reduction,
        applicable_a,
        categorie_id,
        chambre_id,
        maison_id
      FROM promotions
      WHERE statut = 'active'
        AND CURDATE() BETWEEN date_debut_validite AND date_fin_validite
        AND (maison_id IS NULL OR maison_id = ?)
        AND (utilisation_max IS NULL OR utilisation_actuelle < utilisation_max)
    `,
    [maisonId]
  );

  const tarifsAdulteByChambre = new Map();
  const tarifsEnfantByChambre = new Map();

  if (saisonId) {
    const chambreIds = rows.map((row) => row.id);
    const placeholders = chambreIds.map(() => "?").join(", ");

    const [tarifsAdulte] = await pool.query(
      `
        SELECT chambre_id, prix_adulte
        FROM tarifs_chambre
        WHERE saison_id = ? AND chambre_id IN (${placeholders})
      `,
      [saisonId, ...chambreIds]
    );

    const [tarifsEnfant] = await pool.query(
      `
        SELECT
          tce.chambre_id,
          tce.prix,
          ta.id AS tranche_age_id,
          ta.nom AS tranche_nom,
          ta.age_min,
          ta.age_max
        FROM tarifs_chambre_enfant tce
        INNER JOIN tranches_age ta ON ta.id = tce.tranche_age_id
        WHERE tce.saison_id = ? AND tce.chambre_id IN (${placeholders})
        ORDER BY ta.age_min ASC
      `,
      [saisonId, ...chambreIds]
    );

    for (const tarif of tarifsAdulte) {
      tarifsAdulteByChambre.set(tarif.chambre_id, Number(tarif.prix_adulte));
    }

    for (const tarif of tarifsEnfant) {
      const list = tarifsEnfantByChambre.get(tarif.chambre_id) || [];
      list.push({
        tranche_age_id: Number(tarif.tranche_age_id),
        tranche_nom: tarif.tranche_nom,
        age_min: Number(tarif.age_min),
        age_max: Number(tarif.age_max),
        prix: Number(tarif.prix),
      });
      tarifsEnfantByChambre.set(tarif.chambre_id, list);
    }
  }

  return rows.map((row) => {
    const normalizedTarifs = tarifsEnfantByChambre.get(row.id) || [];
    const bebeTranche = normalizedTarifs.find(
      (tarif) =>
        /b[eé]b[eé]/i.test(tarif.tranche_nom || "") || Number(tarif.age_max) <= 2
    );
    const autresEnfants = normalizedTarifs.filter((tarif) => tarif !== bebeTranche);
    const prixAdulte = tarifsAdulteByChambre.get(row.id);
    const applicablePromotions = promotions.filter((promotion) =>
      promotionAppliesToChambre(promotion, row)
    );
    const promotion = pickBestPromotionForChambre(applicablePromotions, prixAdulte);

    return {
      ...row,
      prix_adulte: prixAdulte != null ? prixAdulte : null,
      prix_bebe: bebeTranche ? bebeTranche.prix : null,
      prix_enfant: autresEnfants.length === 1 ? autresEnfants[0].prix : null,
      tarifs_enfant: normalizedTarifs,
      promotion,
      has_promotion: applicablePromotions.length > 0,
      nb_promotions: applicablePromotions.length,
    };
  });
}

async function getBookingContext(req, res) {
  try {
    const maisonId = toIntOrDefault(req.params.maisonId, 0);
    const dateArrivee = toIsoDate(req.query.date_arrivee);

    if (!maisonId) {
      return res.status(400).json({ message: "Maison invalide." });
    }

    const [maisonRows] = await pool.query(
      `
        SELECT
          m.id,
          m.nom,
          m.description,
          m.categorie,
          m.nb_chambres,
          m.lits_bebe_disponibles,
          m.nb_lits_bebe,
          m.adresse,
          m.quartier,
          m.ville,
          m.pays,
          m.telephone,
          m.whatsapp,
          m.note_moyenne,
          m.heure_checkin,
          m.heure_checkout,
          m.devise,
          m.taux_tva,
          m.taxe_de_sejour,
          (
            SELECT p.url
            FROM photos p
            WHERE p.maison_id = m.id
            ORDER BY p.est_principale DESC, p.ordre ASC, p.id ASC
            LIMIT 1
          ) AS photo_principale
        FROM maisons_hotes m
        WHERE m.id = ? AND m.statut = 'actif'
        LIMIT 1
      `,
      [maisonId]
    );

    if (maisonRows.length === 0) {
      return res.status(404).json({ message: "Maison d'hôtes introuvable." });
    }

    const [saisons] = await pool.query(
      `
        SELECT id, maison_id, nom, date_debut, date_fin, couleur
        FROM saisons
        WHERE maison_id = ?
        ORDER BY date_debut ASC
      `,
      [maisonId]
    );

    const [tranchesAge] = await pool.query(
      "SELECT id, nom, age_min, age_max FROM tranches_age ORDER BY age_min ASC"
    );

    const saisonId = findSaisonId(saisons, dateArrivee);
    const chambres = await loadChambresWithTarifs(maisonId, saisonId);

    let supplements = [];
    const saisonIds = saisons.map((row) => row.id);

    if (saisonIds.length > 0) {
      const [supplementRows] = await pool.query(
        "SELECT id, nom, description, statut FROM supplements WHERE statut = 'actif' ORDER BY nom ASC"
      );

      const [tarifs] = await pool.query(
        `
          SELECT id, supplement_id, saison_id, prix_adulte, prix_bebe
          FROM tarifs_supplement
          WHERE saison_id IN (?)
        `,
        [saisonIds]
      );

      const [tarifsEnfant] = await pool.query(
        `
          SELECT id, supplement_id, saison_id, tranche_age_id, prix
          FROM tarifs_supplement_enfant
          WHERE saison_id IN (?)
        `,
        [saisonIds]
      );

      supplements = supplementRows.map((supplement) => ({
        ...supplement,
        tarifs: saisons.map((saison) => {
          const tarif = tarifs.find(
            (row) => row.supplement_id === supplement.id && row.saison_id === saison.id
          );

          return {
            saison_id: saison.id,
            prix_adulte: tarif ? Number(tarif.prix_adulte) : 0,
            prix_bebe: tarif ? Number(tarif.prix_bebe) : 0,
            tarifs_enfant: tarifsEnfant
              .filter(
                (row) =>
                  row.supplement_id === supplement.id && row.saison_id === saison.id
              )
              .map((row) => ({
                tranche_age_id: row.tranche_age_id,
                prix: Number(row.prix),
              })),
          };
        }),
      }));
    }

    return res.status(200).json({
      maison: {
        ...maisonRows[0],
        lits_bebe_disponibles: Boolean(
          maisonRows[0].lits_bebe_disponibles === true ||
            maisonRows[0].lits_bebe_disponibles === 1
        ),
        nb_lits_bebe: Number(maisonRows[0].nb_lits_bebe) || 0,
      },
      saisons,
      saison_id: saisonId,
      tranches_age: tranchesAge,
      chambres,
      supplements,
    });
  } catch (error) {
    console.error("Error loading public booking context:", error);
    return res.status(500).json({ message: "Impossible de charger la réservation." });
  }
}

async function validatePromoCode(req, res) {
  try {
    const code = String(req.body?.code || "")
      .trim()
      .toUpperCase();
    const maisonId = toIntOrDefault(req.body?.maison_id, 0);
    const chambreId = toIntOrDefault(req.body?.chambre_id, 0);
    const dateArrivee = toIsoDate(req.body?.date_arrivee);
    const dateDepart = toIsoDate(req.body?.date_depart);

    if (!code) {
      return res.status(400).json({ message: "Veuillez saisir un code promo." });
    }

    if (maisonId <= 0) {
      return res.status(400).json({ message: "Maison invalide." });
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
          nom,
          code_promo,
          description,
          type_reduction,
          valeur_reduction,
          type_condition,
          jours_avant_min,
          jours_avant_max,
          duree_sejour_min,
          applicable_a,
          categorie_id,
          chambre_id,
          maison_id,
          DATE_FORMAT(date_debut_validite, '%Y-%m-%d') AS date_debut_validite,
          DATE_FORMAT(date_fin_validite, '%Y-%m-%d') AS date_fin_validite,
          DATE_FORMAT(date_debut_sejour, '%Y-%m-%d') AS date_debut_sejour,
          DATE_FORMAT(date_fin_sejour, '%Y-%m-%d') AS date_fin_sejour,
          utilisation_max,
          utilisation_actuelle,
          statut
        FROM promotions
        WHERE UPPER(TRIM(code_promo)) = ?
          AND statut = 'active'
          AND CURDATE() BETWEEN DATE(date_debut_validite) AND DATE(date_fin_validite)
        LIMIT 1
      `,
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Code promo incorrect" });
    }

    const promotion = rows[0];
    const today = todayIsoLocal();

    if (
      promotion.maison_id != null &&
      Number(promotion.maison_id) !== Number(maisonId)
    ) {
      return res.status(400).json({ message: "Code promo incorrect" });
    }

    if (
      promotion.utilisation_max != null &&
      Number(promotion.utilisation_actuelle) >= Number(promotion.utilisation_max)
    ) {
      return res.status(400).json({ message: "Code promo incorrect" });
    }

    if (dateArrivee && dateDepart) {
      const nights = Math.round(
        (new Date(`${dateDepart}T00:00:00`).getTime() -
          new Date(`${dateArrivee}T00:00:00`).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (
        promotion.duree_sejour_min != null &&
        nights < Number(promotion.duree_sejour_min)
      ) {
        return res.status(400).json({ message: "Code promo incorrect" });
      }

      if (promotion.date_debut_sejour && promotion.date_fin_sejour) {
        const stayStart = toIsoDate(promotion.date_debut_sejour);
        const stayEnd = toIsoDate(promotion.date_fin_sejour);

        if (!stayStart || !stayEnd || dateArrivee < stayStart || dateArrivee > stayEnd) {
          return res.status(400).json({ message: "Code promo incorrect" });
        }
      }

      if (
        promotion.type_condition === "early_booking" ||
        promotion.type_condition === "last_minute"
      ) {
        const daysBefore = Math.round(
          (new Date(`${dateArrivee}T00:00:00`).getTime() -
            new Date(`${today}T00:00:00`).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (
          promotion.jours_avant_min != null &&
          daysBefore < Number(promotion.jours_avant_min)
        ) {
          return res.status(400).json({ message: "Code promo incorrect" });
        }

        if (
          promotion.jours_avant_max != null &&
          daysBefore > Number(promotion.jours_avant_max)
        ) {
          return res.status(400).json({ message: "Code promo incorrect" });
        }
      }
    }

    if (chambreId > 0 && promotion.applicable_a !== "toutes_chambres") {
      const [chambres] = await pool.query(
        `
          SELECT id, maison_id, categorie_id
          FROM chambres
          WHERE id = ? AND maison_id = ? AND statut = 'actif'
          LIMIT 1
        `,
        [chambreId, maisonId]
      );

      if (chambres.length === 0 || !promotionAppliesToChambre(promotion, chambres[0])) {
        return res.status(400).json({ message: "Code promo incorrect" });
      }
    }

    return res.status(200).json({
      promotion: {
        id: promotion.id,
        nom: promotion.nom,
        code_promo: promotion.code_promo,
        description: promotion.description,
        type_reduction: promotion.type_reduction,
        valeur_reduction: Number(promotion.valeur_reduction),
      },
    });
  } catch (error) {
    console.error("Error validating promo code:", error);
    return res.status(500).json({ message: "Impossible de vérifier le code promo." });
  }
}

module.exports = {
  getBookingContext,
  validatePromoCode,
};
