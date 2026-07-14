const { pool } = require("../../database/db");
const {
  ROOM_TYPES,
  getRoomTypesOrderSql,
} = require("../../database/hebergementCatalogSchema");

const MARGE_TYPES = new Set(["pourcentage", "valeur"]);
const STATUTS = new Set(["actif", "inactif"]);

function toIntOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function toDecimalOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pickSaisonFields(body = {}) {
  return {
    nom: body.nom?.trim() || null,
    date_debut: body.date_debut || null,
    date_fin: body.date_fin || null,
    couleur: body.couleur?.trim() || null,
  };
}

function pickChambreFields(body = {}) {
  return {
    nom: body.nom?.trim() || null,
    categorie_id: toIntOrDefault(body.categorie_id, 0),
    type_id: toIntOrDefault(body.type_id, 0),
    allotement: Math.max(1, toIntOrDefault(body.allotement, 1)),
    capacite_max: Math.max(1, toIntOrDefault(body.capacite_max, 1)),
    marge_type: MARGE_TYPES.has(body.marge_type) ? body.marge_type : "pourcentage",
    marge_valeur: toDecimalOrDefault(body.marge_valeur, 0),
    statut: STATUTS.has(body.statut) ? body.statut : "actif",
  };
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

function pickTrancheAgeFields(body = {}) {
  return {
    nom: body.nom?.trim() || null,
    age_min: Math.max(0, toIntOrDefault(body.age_min, 0)),
    age_max: Math.max(0, toIntOrDefault(body.age_max, 0)),
  };
}

function pickCategorieChambreFields(body = {}) {
  return {
    nom: body.nom?.trim() || null,
  };
}

function pickSupplementFields(body = {}) {
  return {
    nom: body.nom?.trim() || null,
    description: body.description?.trim() || null,
    statut: STATUTS.has(body.statut) ? body.statut : "actif",
  };
}

async function syncMaisonChambreCounts(connection, maisonId) {
  await connection.query(
    `
      UPDATE maisons_hotes m
      SET
        nb_chambres = (
          SELECT COALESCE(SUM(c.allotement), 0)
          FROM chambres c
          WHERE c.maison_id = m.id AND c.statut = 'actif'
        )
      WHERE m.id = ?
    `,
    [maisonId]
  );
}

async function fetchTarifsChambre(connection, chambreId) {
  const [tarifs] = await connection.query(
    `
      SELECT id, chambre_id, saison_id, prix_adulte
      FROM tarifs_chambre
      WHERE chambre_id = ?
      ORDER BY saison_id ASC
    `,
    [chambreId]
  );

  const [tarifsEnfant] = await connection.query(
    `
      SELECT id, chambre_id, saison_id, tranche_age_id, prix
      FROM tarifs_chambre_enfant
      WHERE chambre_id = ?
      ORDER BY saison_id ASC, tranche_age_id ASC
    `,
    [chambreId]
  );

  return tarifs.map((tarif) => ({
    ...tarif,
    prix_adulte: Number(tarif.prix_adulte),
    tarifs_enfant: tarifsEnfant
      .filter((row) => row.saison_id === tarif.saison_id)
      .map((row) => ({
        id: row.id,
        tranche_age_id: row.tranche_age_id,
        prix: Number(row.prix),
      })),
  }));
}

async function syncChambreTarifs(connection, chambreId, tarifs = []) {
  await connection.query("DELETE FROM tarifs_chambre_enfant WHERE chambre_id = ?", [chambreId]);
  await connection.query("DELETE FROM tarifs_chambre WHERE chambre_id = ?", [chambreId]);

  for (const tarif of tarifs) {
    const saisonId = toIntOrDefault(tarif.saison_id, 0);

    if (!saisonId) {
      continue;
    }

    await connection.query(
      `
        INSERT INTO tarifs_chambre (chambre_id, saison_id, prix_adulte)
        VALUES (?, ?, ?)
      `,
      [chambreId, saisonId, toDecimalOrDefault(tarif.prix_adulte, 0)]
    );

    for (const childTarif of tarif.tarifs_enfant || []) {
      const trancheId = toIntOrDefault(childTarif.tranche_age_id, 0);

      if (!trancheId) {
        continue;
      }

      await connection.query(
        `
          INSERT INTO tarifs_chambre_enfant (chambre_id, saison_id, tranche_age_id, prix)
          VALUES (?, ?, ?, ?)
        `,
        [chambreId, saisonId, trancheId, toDecimalOrDefault(childTarif.prix, 0)]
      );
    }
  }
}

async function fetchChambreById(connection, id) {
  const [rows] = await connection.query(
    `
      SELECT
        c.*,
        cc.nom AS categorie_nom,
        tc.nom AS type_nom
      FROM chambres c
      INNER JOIN categories_chambre cc ON cc.id = c.categorie_id
      INNER JOIN types_chambre tc ON tc.id = c.type_id
      WHERE c.id = ?
      LIMIT 1
    `,
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  const chambre = rows[0];
  chambre.tarifs = await fetchTarifsChambre(connection, id);

  return chambre;
}

async function getReferences(req, res) {
  try {
    const [categories] = await pool.query(
      "SELECT id, nom FROM categories_chambre ORDER BY nom ASC"
    );
    const [types] = await pool.query(
      `
        SELECT id, nom
        FROM types_chambre
        WHERE nom IN (${ROOM_TYPES.map(() => "?").join(", ")})
        ORDER BY FIELD(nom, ${getRoomTypesOrderSql()})
      `,
      ROOM_TYPES
    );
    const [tranches] = await pool.query(
      "SELECT id, nom, age_min, age_max FROM tranches_age ORDER BY age_min ASC"
    );
    const [supplements] = await pool.query(
      "SELECT id, nom, description, statut FROM supplements ORDER BY nom ASC"
    );

    return res.status(200).json({
      categories_chambre: categories,
      types_chambre: types,
      tranches_age: tranches,
      supplements,
    });
  } catch (error) {
    console.error("Error fetching hebergement references:", error);
    return res.status(500).json({ message: "Impossible de charger les références." });
  }
}

async function getSaisons(req, res) {
  try {
    const maisonId = toIntOrDefault(req.query.maison_id, 0);

    if (!maisonId) {
      return res.status(400).json({ message: "maison_id est requis." });
    }

    const [rows] = await pool.query(
      `
        SELECT id, maison_id, nom, date_debut, date_fin, couleur
        FROM saisons
        WHERE maison_id = ?
        ORDER BY date_debut ASC
      `,
      [maisonId]
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching saisons:", error);
    return res.status(500).json({ message: "Impossible de charger les saisons." });
  }
}

async function createSaison(req, res) {
  const connection = await pool.getConnection();

  try {
    const maisonId = toIntOrDefault(req.body.maison_id, 0);
    const fields = pickSaisonFields(req.body);

    if (!maisonId || !fields.nom || !fields.date_debut || !fields.date_fin) {
      return res.status(400).json({
        message: "maison_id, nom, date_debut et date_fin sont requis.",
      });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO saisons (maison_id, nom, date_debut, date_fin, couleur)
        VALUES (?, ?, ?, ?, ?)
      `,
      [maisonId, fields.nom, fields.date_debut, fields.date_fin, fields.couleur]
    );

    const [rows] = await connection.query(
      "SELECT id, maison_id, nom, date_debut, date_fin, couleur FROM saisons WHERE id = ? LIMIT 1",
      [result.insertId]
    );

    await connection.commit();

    return res.status(201).json({
      message: "Saison créée avec succès.",
      saison: rows[0],
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating saison:", error);
    return res.status(500).json({ message: "Impossible de créer la saison." });
  } finally {
    connection.release();
  }
}

async function updateSaison(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const fields = pickSaisonFields(req.body);

    if (!fields.nom || !fields.date_debut || !fields.date_fin) {
      return res.status(400).json({
        message: "nom, date_debut et date_fin sont requis.",
      });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        UPDATE saisons
        SET nom = ?, date_debut = ?, date_fin = ?, couleur = ?
        WHERE id = ?
      `,
      [fields.nom, fields.date_debut, fields.date_fin, fields.couleur, id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Saison introuvable." });
    }

    const [rows] = await connection.query(
      "SELECT id, maison_id, nom, date_debut, date_fin, couleur FROM saisons WHERE id = ? LIMIT 1",
      [id]
    );

    await connection.commit();

    return res.status(200).json({
      message: "Saison mise à jour.",
      saison: rows[0],
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating saison:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour la saison." });
  } finally {
    connection.release();
  }
}

async function deleteSaison(req, res) {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM saisons WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Saison introuvable." });
    }

    return res.status(200).json({ message: "Saison supprimée." });
  } catch (error) {
    console.error("Error deleting saison:", error);
    return res.status(500).json({ message: "Impossible de supprimer la saison." });
  }
}

async function getTranchesAge(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT id, nom, age_min, age_max FROM tranches_age ORDER BY age_min ASC"
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching tranches age:", error);
    return res.status(500).json({ message: "Impossible de charger les tranches d'âge." });
  }
}

async function createTrancheAge(req, res) {
  try {
    const fields = pickTrancheAgeFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est requis." });
    }

    if (fields.age_max < fields.age_min) {
      return res.status(400).json({
        message: "L'âge maximum doit être supérieur ou égal à l'âge minimum.",
      });
    }

    const [result] = await pool.query(
      "INSERT INTO tranches_age (nom, age_min, age_max) VALUES (?, ?, ?)",
      [fields.nom, fields.age_min, fields.age_max]
    );

    const [rows] = await pool.query(
      "SELECT id, nom, age_min, age_max FROM tranches_age WHERE id = ? LIMIT 1",
      [result.insertId]
    );

    return res.status(201).json({
      message: "Tranche d'âge créée avec succès.",
      tranche: rows[0],
    });
  } catch (error) {
    console.error("Error creating tranche age:", error);
    return res.status(500).json({ message: "Impossible de créer la tranche d'âge." });
  }
}

async function updateTrancheAge(req, res) {
  try {
    const { id } = req.params;
    const fields = pickTrancheAgeFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est requis." });
    }

    if (fields.age_max < fields.age_min) {
      return res.status(400).json({
        message: "L'âge maximum doit être supérieur ou égal à l'âge minimum.",
      });
    }

    const [result] = await pool.query(
      "UPDATE tranches_age SET nom = ?, age_min = ?, age_max = ? WHERE id = ?",
      [fields.nom, fields.age_min, fields.age_max, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Tranche d'âge introuvable." });
    }

    const [rows] = await pool.query(
      "SELECT id, nom, age_min, age_max FROM tranches_age WHERE id = ? LIMIT 1",
      [id]
    );

    return res.status(200).json({
      message: "Tranche d'âge mise à jour.",
      tranche: rows[0],
    });
  } catch (error) {
    console.error("Error updating tranche age:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour la tranche d'âge." });
  }
}

async function deleteTrancheAge(req, res) {
  try {
    const { id } = req.params;

    const [usage] = await pool.query(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM tarifs_chambre_enfant
            WHERE tranche_age_id = ?
          ) +
          (
            SELECT COUNT(*)
            FROM tarifs_supplement_enfant
            WHERE tranche_age_id = ?
          ) AS total
      `,
      [id, id]
    );

    if (usage[0]?.total > 0) {
      return res.status(409).json({
        message:
          "Cette tranche d'âge est utilisée dans des tarifs et ne peut pas être supprimée.",
      });
    }

    const [result] = await pool.query("DELETE FROM tranches_age WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Tranche d'âge introuvable." });
    }

    return res.status(200).json({ message: "Tranche d'âge supprimée." });
  } catch (error) {
    console.error("Error deleting tranche age:", error);
    return res.status(500).json({ message: "Impossible de supprimer la tranche d'âge." });
  }
}

async function getCategoriesChambre(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT id, nom FROM categories_chambre ORDER BY nom ASC"
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching categories chambre:", error);
    return res.status(500).json({ message: "Impossible de charger les catégories." });
  }
}

async function createCategorieChambre(req, res) {
  try {
    const fields = pickCategorieChambreFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est requis." });
    }

    const [result] = await pool.query(
      "INSERT INTO categories_chambre (nom) VALUES (?)",
      [fields.nom]
    );

    const [rows] = await pool.query(
      "SELECT id, nom FROM categories_chambre WHERE id = ? LIMIT 1",
      [result.insertId]
    );

    return res.status(201).json({
      message: "Catégorie créée avec succès.",
      categorie: rows[0],
    });
  } catch (error) {
    console.error("Error creating categorie chambre:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Cette catégorie existe déjà." });
    }

    return res.status(500).json({ message: "Impossible de créer la catégorie." });
  }
}

async function updateCategorieChambre(req, res) {
  try {
    const { id } = req.params;
    const fields = pickCategorieChambreFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est requis." });
    }

    const [result] = await pool.query(
      "UPDATE categories_chambre SET nom = ? WHERE id = ?",
      [fields.nom, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Catégorie introuvable." });
    }

    const [rows] = await pool.query(
      "SELECT id, nom FROM categories_chambre WHERE id = ? LIMIT 1",
      [id]
    );

    return res.status(200).json({
      message: "Catégorie mise à jour.",
      categorie: rows[0],
    });
  } catch (error) {
    console.error("Error updating categorie chambre:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Cette catégorie existe déjà." });
    }

    return res.status(500).json({ message: "Impossible de mettre à jour la catégorie." });
  }
}

async function deleteCategorieChambre(req, res) {
  try {
    const { id } = req.params;

    const [usage] = await pool.query(
      `
        SELECT
          (SELECT COUNT(*) FROM chambres WHERE categorie_id = ?) +
          (SELECT COUNT(*) FROM promotions WHERE categorie_id = ?) AS total
      `,
      [id, id]
    );

    if (usage[0]?.total > 0) {
      return res.status(409).json({
        message:
          "Cette catégorie est utilisée par des chambres ou des promotions et ne peut pas être supprimée.",
      });
    }

    const [result] = await pool.query("DELETE FROM categories_chambre WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Catégorie introuvable." });
    }

    return res.status(200).json({ message: "Catégorie supprimée." });
  } catch (error) {
    console.error("Error deleting categorie chambre:", error);
    return res.status(500).json({ message: "Impossible de supprimer la catégorie." });
  }
}

async function getChambres(req, res) {
  try {
    const maisonId = toIntOrDefault(req.query.maison_id, 0);
    const saisonId = toIntOrDefault(req.query.saison_id, 0);

    if (!maisonId) {
      return res.status(400).json({ message: "maison_id est requis." });
    }

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
          c.marge_type,
          c.marge_valeur,
          c.statut,
          c.date_creation,
          c.date_maj,
          cc.nom AS categorie_nom,
          tc.nom AS type_nom
        FROM chambres c
        INNER JOIN categories_chambre cc ON cc.id = c.categorie_id
        INNER JOIN types_chambre tc ON tc.id = c.type_id
        WHERE c.maison_id = ?
        ORDER BY c.nom ASC
      `,
      [maisonId]
    );

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

    if (saisonId && rows.length > 0) {
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

    const chambres = rows.map((row) => {
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
        nb_promotions: applicablePromotions.length,
        has_promotion: applicablePromotions.length > 0,
      };
    });

    return res.status(200).json(chambres);
  } catch (error) {
    console.error("Error fetching chambres:", error);
    return res.status(500).json({ message: "Impossible de charger les chambres." });
  }
}

async function getChambreById(req, res) {
  const connection = await pool.getConnection();

  try {
    const chambre = await fetchChambreById(connection, req.params.id);

    if (!chambre) {
      return res.status(404).json({ message: "Chambre introuvable." });
    }

    return res.status(200).json(chambre);
  } catch (error) {
    console.error("Error fetching chambre:", error);
    return res.status(500).json({ message: "Impossible de charger la chambre." });
  } finally {
    connection.release();
  }
}

async function createChambre(req, res) {
  const connection = await pool.getConnection();

  try {
    const maisonId = toIntOrDefault(req.body.maison_id, 0);
    const fields = pickChambreFields(req.body);
    const tarifs = Array.isArray(req.body.tarifs) ? req.body.tarifs : [];

    if (!maisonId || !fields.nom || !fields.categorie_id || !fields.type_id) {
      return res.status(400).json({
        message: "maison_id, nom, categorie_id et type_id sont requis.",
      });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO chambres
          (maison_id, nom, categorie_id, type_id, allotement, capacite_max, marge_type, marge_valeur, statut)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        maisonId,
        fields.nom,
        fields.categorie_id,
        fields.type_id,
        fields.allotement,
        fields.capacite_max,
        fields.marge_type,
        fields.marge_valeur,
        fields.statut,
      ]
    );

    const chambreId = result.insertId;
    await syncChambreTarifs(connection, chambreId, tarifs);
    await syncMaisonChambreCounts(connection, maisonId);

    const chambre = await fetchChambreById(connection, chambreId);

    await connection.commit();

    return res.status(201).json({
      message: "Chambre créée avec succès.",
      chambre,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating chambre:", error);
    return res.status(500).json({ message: "Impossible de créer la chambre." });
  } finally {
    connection.release();
  }
}

async function updateChambre(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const fields = pickChambreFields(req.body);
    const tarifs = Array.isArray(req.body.tarifs) ? req.body.tarifs : [];

    if (!fields.nom || !fields.categorie_id || !fields.type_id) {
      return res.status(400).json({
        message: "nom, categorie_id et type_id sont requis.",
      });
    }

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      "SELECT maison_id FROM chambres WHERE id = ? LIMIT 1",
      [id]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Chambre introuvable." });
    }

    const maisonId = existingRows[0].maison_id;

    await connection.query(
      `
        UPDATE chambres
        SET
          nom = ?,
          categorie_id = ?,
          type_id = ?,
          allotement = ?,
          capacite_max = ?,
          marge_type = ?,
          marge_valeur = ?,
          statut = ?
        WHERE id = ?
      `,
      [
        fields.nom,
        fields.categorie_id,
        fields.type_id,
        fields.allotement,
        fields.capacite_max,
        fields.marge_type,
        fields.marge_valeur,
        fields.statut,
        id,
      ]
    );

    await syncChambreTarifs(connection, id, tarifs);
    await syncMaisonChambreCounts(connection, maisonId);

    const chambre = await fetchChambreById(connection, id);

    await connection.commit();

    return res.status(200).json({
      message: "Chambre mise à jour.",
      chambre,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating chambre:", error);
    return res.status(500).json({ message: "Impossible de mettre à jour la chambre." });
  } finally {
    connection.release();
  }
}

async function deleteChambre(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      "SELECT maison_id FROM chambres WHERE id = ? LIMIT 1",
      [id]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Chambre introuvable." });
    }

    const maisonId = existingRows[0].maison_id;

    await connection.query("DELETE FROM chambres WHERE id = ?", [id]);
    await syncMaisonChambreCounts(connection, maisonId);

    await connection.commit();

    return res.status(200).json({ message: "Chambre supprimée." });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting chambre:", error);
    return res.status(500).json({ message: "Impossible de supprimer la chambre." });
  } finally {
    connection.release();
  }
}

async function getSupplements(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT id, nom, description, statut FROM supplements ORDER BY nom ASC"
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching supplements:", error);
    return res.status(500).json({ message: "Impossible de charger les suppléments." });
  }
}

async function createSupplement(req, res) {
  try {
    const fields = pickSupplementFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est requis." });
    }

    const [result] = await pool.query(
      "INSERT INTO supplements (nom, description, statut) VALUES (?, ?, ?)",
      [fields.nom, fields.description, fields.statut]
    );

    const [rows] = await pool.query(
      "SELECT id, nom, description, statut FROM supplements WHERE id = ? LIMIT 1",
      [result.insertId]
    );

    return res.status(201).json({
      message: "Supplément créé avec succès.",
      supplement: rows[0],
    });
  } catch (error) {
    console.error("Error creating supplement:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ce supplément existe déjà." });
    }

    return res.status(500).json({ message: "Impossible de créer le supplément." });
  }
}

async function updateSupplement(req, res) {
  try {
    const { id } = req.params;
    const fields = pickSupplementFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est requis." });
    }

    const [result] = await pool.query(
      "UPDATE supplements SET nom = ?, description = ?, statut = ? WHERE id = ?",
      [fields.nom, fields.description, fields.statut, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Supplément introuvable." });
    }

    const [rows] = await pool.query(
      "SELECT id, nom, description, statut FROM supplements WHERE id = ? LIMIT 1",
      [id]
    );

    return res.status(200).json({
      message: "Supplément mis à jour.",
      supplement: rows[0],
    });
  } catch (error) {
    console.error("Error updating supplement:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ce supplément existe déjà." });
    }

    return res.status(500).json({ message: "Impossible de mettre à jour le supplément." });
  }
}

async function deleteSupplement(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    const [usage] = await connection.query(
      "SELECT COUNT(*) AS total FROM reservations WHERE supplement_id = ?",
      [id]
    );

    if (usage[0]?.total > 0) {
      return res.status(409).json({
        message:
          "Ce supplément est utilisé par des réservations et ne peut pas être supprimé.",
      });
    }

    await connection.beginTransaction();

    await connection.query("DELETE FROM tarifs_supplement_enfant WHERE supplement_id = ?", [
      id,
    ]);
    await connection.query("DELETE FROM tarifs_supplement WHERE supplement_id = ?", [id]);

    const [result] = await connection.query("DELETE FROM supplements WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Supplément introuvable." });
    }

    await connection.commit();
    return res.status(200).json({ message: "Supplément supprimé." });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting supplement:", error);
    return res.status(500).json({ message: "Impossible de supprimer le supplément." });
  } finally {
    connection.release();
  }
}

async function getSupplementTarifs(req, res) {
  try {
    const maisonId = toIntOrDefault(req.query.maison_id, 0);

    if (!maisonId) {
      return res.status(400).json({ message: "maison_id est requis." });
    }

    const [saisons] = await pool.query(
      "SELECT id, nom, date_debut, date_fin, couleur FROM saisons WHERE maison_id = ? ORDER BY date_debut ASC",
      [maisonId]
    );

    const saisonIds = saisons.map((row) => row.id);

    if (saisonIds.length === 0) {
      return res.status(200).json({ saisons, supplements: [] });
    }

    const [supplements] = await pool.query(
      "SELECT id, nom, description, statut FROM supplements ORDER BY nom ASC"
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

    const payload = supplements.map((supplement) => ({
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
              (row) => row.supplement_id === supplement.id && row.saison_id === saison.id
            )
            .map((row) => ({
              tranche_age_id: row.tranche_age_id,
              prix: Number(row.prix),
            })),
        };
      }),
    }));

    return res.status(200).json({
      saisons,
      supplements: payload,
    });
  } catch (error) {
    console.error("Error fetching supplement tarifs:", error);
    return res.status(500).json({ message: "Impossible de charger les tarifs suppléments." });
  }
}

async function updateSupplementTarifs(req, res) {
  const connection = await pool.getConnection();

  try {
    const supplementId = toIntOrDefault(req.params.supplementId, 0);
    const maisonId = toIntOrDefault(req.body.maison_id, 0);
    const tarifs = Array.isArray(req.body.tarifs) ? req.body.tarifs : [];

    if (!supplementId || !maisonId) {
      return res.status(400).json({
        message: "supplementId et maison_id sont requis.",
      });
    }

    const [saisons] = await connection.query(
      "SELECT id FROM saisons WHERE maison_id = ?",
      [maisonId]
    );
    const saisonIds = new Set(saisons.map((row) => row.id));

    await connection.beginTransaction();

    for (const saisonId of saisonIds) {
      await connection.query(
        "DELETE FROM tarifs_supplement_enfant WHERE supplement_id = ? AND saison_id = ?",
        [supplementId, saisonId]
      );
      await connection.query(
        "DELETE FROM tarifs_supplement WHERE supplement_id = ? AND saison_id = ?",
        [supplementId, saisonId]
      );
    }

    for (const tarif of tarifs) {
      const saisonId = toIntOrDefault(tarif.saison_id, 0);

      if (!saisonId || !saisonIds.has(saisonId)) {
        continue;
      }

      await connection.query(
        `
          INSERT INTO tarifs_supplement (supplement_id, saison_id, prix_adulte, prix_bebe)
          VALUES (?, ?, ?, ?)
        `,
        [
          supplementId,
          saisonId,
          toDecimalOrDefault(tarif.prix_adulte, 0),
          toDecimalOrDefault(tarif.prix_bebe, 0),
        ]
      );

      for (const childTarif of tarif.tarifs_enfant || []) {
        const trancheId = toIntOrDefault(childTarif.tranche_age_id, 0);

        if (!trancheId) {
          continue;
        }

        await connection.query(
          `
            INSERT INTO tarifs_supplement_enfant (supplement_id, saison_id, tranche_age_id, prix)
            VALUES (?, ?, ?, ?)
          `,
          [supplementId, saisonId, trancheId, toDecimalOrDefault(childTarif.prix, 0)]
        );
      }
    }

    await connection.commit();

    return res.status(200).json({ message: "Tarifs supplément enregistrés." });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating supplement tarifs:", error);
    return res.status(500).json({ message: "Impossible d'enregistrer les tarifs supplément." });
  } finally {
    connection.release();
  }
}

module.exports = {
  getReferences,
  getSaisons,
  createSaison,
  updateSaison,
  deleteSaison,
  getTranchesAge,
  createTrancheAge,
  updateTrancheAge,
  deleteTrancheAge,
  getCategoriesChambre,
  createCategorieChambre,
  updateCategorieChambre,
  deleteCategorieChambre,
  getChambres,
  getChambreById,
  createChambre,
  updateChambre,
  deleteChambre,
  getSupplements,
  createSupplement,
  updateSupplement,
  deleteSupplement,
  getSupplementTarifs,
  updateSupplementTarifs,
};
