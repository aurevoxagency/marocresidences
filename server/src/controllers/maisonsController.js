const { pool } = require("../../database/db");

const JOURS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

const STATUTS = new Set(["actif", "inactif", "en_attente"]);

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIntOrDefault(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function normalizeTime(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  const text = String(value).trim();

  if (/^\d{2}:\d{2}$/.test(text)) {
    return `${text}:00`;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  return fallback;
}

function pickMaisonFields(body = {}) {
  return {
    nom: body.nom?.trim() || null,
    description: body.description?.trim() || null,
    categorie: body.categorie?.trim() || null,
    nb_chambres: toIntOrDefault(body.nb_chambres, 0),
    capacite_max: toIntOrDefault(body.capacite_max, 0),
    adresse: body.adresse?.trim() || null,
    quartier: body.quartier?.trim() || null,
    ville: body.ville?.trim() || null,
    code_postal: body.code_postal?.trim() || null,
    pays: body.pays?.trim() || "Maroc",
    latitude: toNumberOrNull(body.latitude),
    longitude: toNumberOrNull(body.longitude),
    telephone: body.telephone?.trim() || null,
    whatsapp: body.whatsapp?.trim() || null,
    email: body.email?.trim() || null,
    site_web: body.site_web?.trim() || null,
    devise: body.devise?.trim() || "MAD",
    taux_tva: toNumberOrNull(body.taux_tva) ?? 0,
    numero_patente: body.numero_patente?.trim() || null,
    numero_ice: body.numero_ice?.trim() || null,
    numero_classement: body.numero_classement?.trim() || null,
    statut: STATUTS.has(body.statut) ? body.statut : "en_attente",
    heure_checkin: normalizeTime(body.heure_checkin, "14:00:00"),
    heure_checkout: normalizeTime(body.heure_checkout, "12:00:00"),
  };
}

async function fetchMaisonById(connection, id) {
  const [rows] = await connection.query(
    "SELECT * FROM maisons_hotes WHERE id = ? LIMIT 1",
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  const maison = rows[0];

  const [photos] = await connection.query(
    "SELECT id, maison_id, url, legende, est_principale, ordre, date_ajout FROM photos WHERE maison_id = ? ORDER BY ordre ASC, id ASC",
    [id]
  );

  const [services] = await connection.query(
    `
      SELECT s.id, s.nom, s.icone
      FROM services s
      INNER JOIN maison_services ms ON ms.service_id = s.id
      WHERE ms.maison_id = ?
      ORDER BY s.nom ASC
    `,
    [id]
  );

  const [equipements] = await connection.query(
    `
      SELECT e.id, e.nom, e.categorie, e.icone
      FROM equipements e
      INNER JOIN maison_equipements me ON me.equipement_id = e.id
      WHERE me.maison_id = ?
      ORDER BY e.nom ASC
    `,
    [id]
  );

  const [langues] = await connection.query(
    `
      SELECT l.id, l.code, l.nom
      FROM langues l
      INNER JOIN maison_langues ml ON ml.langue_id = l.id
      WHERE ml.maison_id = ?
      ORDER BY l.nom ASC
    `,
    [id]
  );

  const [horaires] = await connection.query(
    `
      SELECT id, maison_id, jour_semaine, heure_ouverture, heure_fermeture, ferme
      FROM horaires
      WHERE maison_id = ?
      ORDER BY FIELD(jour_semaine, 'lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche')
    `,
    [id]
  );

  return {
    ...maison,
    photos: photos.map((photo) => ({
      ...photo,
      est_principale: Boolean(photo.est_principale),
    })),
    services,
    equipements,
    langues,
    horaires: horaires.map((horaire) => ({
      ...horaire,
      ferme: Boolean(horaire.ferme),
    })),
    service_ids: services.map((item) => item.id),
    equipement_ids: equipements.map((item) => item.id),
    langue_ids: langues.map((item) => item.id),
  };
}

async function syncRelations(connection, maisonId, payload) {
  const serviceIds = Array.isArray(payload.service_ids)
    ? [...new Set(payload.service_ids.map(Number).filter((id) => id > 0))]
    : [];
  const equipementIds = Array.isArray(payload.equipement_ids)
    ? [...new Set(payload.equipement_ids.map(Number).filter((id) => id > 0))]
    : [];
  const langueIds = Array.isArray(payload.langue_ids)
    ? [...new Set(payload.langue_ids.map(Number).filter((id) => id > 0))]
    : [];
  const photos = Array.isArray(payload.photos) ? payload.photos : [];
  const horaires = Array.isArray(payload.horaires) ? payload.horaires : [];

  await connection.query("DELETE FROM maison_services WHERE maison_id = ?", [maisonId]);
  await connection.query("DELETE FROM maison_equipements WHERE maison_id = ?", [maisonId]);
  await connection.query("DELETE FROM maison_langues WHERE maison_id = ?", [maisonId]);
  await connection.query("DELETE FROM photos WHERE maison_id = ?", [maisonId]);
  await connection.query("DELETE FROM horaires WHERE maison_id = ?", [maisonId]);

  for (const serviceId of serviceIds) {
    await connection.query(
      "INSERT INTO maison_services (maison_id, service_id) VALUES (?, ?)",
      [maisonId, serviceId]
    );
  }

  for (const equipementId of equipementIds) {
    await connection.query(
      "INSERT INTO maison_equipements (maison_id, equipement_id) VALUES (?, ?)",
      [maisonId, equipementId]
    );
  }

  for (const langueId of langueIds) {
    await connection.query(
      "INSERT INTO maison_langues (maison_id, langue_id) VALUES (?, ?)",
      [maisonId, langueId]
    );
  }

  for (const [index, photo] of photos.entries()) {
    const url = photo?.url?.trim();

    if (!url) {
      continue;
    }

    await connection.query(
      `
        INSERT INTO photos (maison_id, url, legende, est_principale, ordre)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        maisonId,
        url,
        photo.legende?.trim() || null,
        photo.est_principale ? 1 : 0,
        toIntOrDefault(photo.ordre, index),
      ]
    );
  }

  for (const horaire of horaires) {
    if (!JOURS.includes(horaire?.jour_semaine)) {
      continue;
    }

    await connection.query(
      `
        INSERT INTO horaires
        (maison_id, jour_semaine, heure_ouverture, heure_fermeture, ferme)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        maisonId,
        horaire.jour_semaine,
        horaire.ferme ? null : normalizeTime(horaire.heure_ouverture),
        horaire.ferme ? null : normalizeTime(horaire.heure_fermeture),
        horaire.ferme ? 1 : 0,
      ]
    );
  }
}

async function getMaisons(req, res) {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          m.*,
          (
            SELECT p.url
            FROM photos p
            WHERE p.maison_id = m.id
            ORDER BY p.est_principale DESC, p.ordre ASC, p.id ASC
            LIMIT 1
          ) AS photo_principale
        FROM maisons_hotes m
        ORDER BY m.date_maj DESC
      `
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching maisons:", error);
    return res.status(500).json({ message: "Unable to fetch maisons d'hôtes." });
  }
}

async function getMaisonsCatalog(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const params = [];
    let where = "WHERE m.statut = 'actif'";

    if (q) {
      where += ` AND (
        m.nom LIKE ? OR m.ville LIKE ? OR m.quartier LIKE ?
        OR m.adresse LIKE ? OR m.categorie LIKE ?
      )`;
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    const [rows] = await pool.query(
      `
        SELECT
          m.id,
          m.nom,
          m.description,
          m.categorie,
          m.nb_chambres,
          m.capacite_max,
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
          (
            SELECT p.url
            FROM photos p
            WHERE p.maison_id = m.id
            ORDER BY p.est_principale DESC, p.ordre ASC, p.id ASC
            LIMIT 1
          ) AS photo_principale
        FROM maisons_hotes m
        ${where}
        ORDER BY m.note_moyenne DESC, m.nom ASC
      `,
      params
    );

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    const ids = rows.map((row) => row.id);

    const [priceRows] = await pool.query(
      `
        SELECT
          c.maison_id,
          MIN(tc.prix_adulte) AS prix_adulte_min
        FROM chambres c
        INNER JOIN tarifs_chambre tc ON tc.chambre_id = c.id
        INNER JOIN saisons s ON s.id = tc.saison_id AND s.maison_id = c.maison_id
        WHERE c.maison_id IN (?)
          AND c.statut = 'actif'
          AND tc.prix_adulte > 0
          AND (
            CURDATE() BETWEEN s.date_debut AND s.date_fin
            OR NOT EXISTS (
              SELECT 1
              FROM saisons sx
              WHERE sx.maison_id = c.maison_id
                AND CURDATE() BETWEEN sx.date_debut AND sx.date_fin
            )
          )
        GROUP BY c.maison_id
      `,
      [ids]
    );

    const prixByMaison = new Map(
      priceRows.map((row) => [row.maison_id, Number(row.prix_adulte_min)])
    );

    const [services] = await pool.query(
      `
        SELECT ms.maison_id, s.nom
        FROM maison_services ms
        INNER JOIN services s ON s.id = ms.service_id
        WHERE ms.maison_id IN (?)
        ORDER BY s.nom ASC
      `,
      [ids]
    );
    const [equipements] = await pool.query(
      `
        SELECT me.maison_id, e.nom
        FROM maison_equipements me
        INNER JOIN equipements e ON e.id = me.equipement_id
        WHERE me.maison_id IN (?)
        ORDER BY e.nom ASC
      `,
      [ids]
    );

    const servicesByMaison = new Map();
    for (const item of services) {
      const list = servicesByMaison.get(item.maison_id) || [];
      list.push(item.nom);
      servicesByMaison.set(item.maison_id, list);
    }

    const equipementsByMaison = new Map();
    for (const item of equipements) {
      const list = equipementsByMaison.get(item.maison_id) || [];
      list.push(item.nom);
      equipementsByMaison.set(item.maison_id, list);
    }

    return res.status(200).json(
      rows.map((row) => ({
        ...row,
        prix_adulte_min: prixByMaison.get(row.id) ?? null,
        services: (servicesByMaison.get(row.id) || []).slice(0, 6),
        equipements: (equipementsByMaison.get(row.id) || []).slice(0, 6),
      }))
    );
  } catch (error) {
    console.error("Error fetching maisons catalog:", error);
    return res.status(500).json({ message: "Impossible de charger le catalogue." });
  }
}

async function getMaisonById(req, res) {
  try {
    const maison = await fetchMaisonById(pool, req.params.id);

    if (!maison) {
      return res.status(404).json({ message: "Maison d'hôtes not found." });
    }

    return res.status(200).json(maison);
  } catch (error) {
    console.error("Error fetching maison:", error);
    return res.status(500).json({ message: "Unable to fetch maison d'hôtes." });
  }
}

async function createMaison(req, res) {
  const connection = await pool.getConnection();

  try {
    const fields = pickMaisonFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est obligatoire." });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO maisons_hotes (
          nom, description, categorie, nb_chambres, capacite_max,
          adresse, quartier, ville, code_postal, pays,
          latitude, longitude, telephone, whatsapp, email, site_web,
          devise, taux_tva, numero_patente, numero_ice, numero_classement,
          statut, heure_checkin, heure_checkout
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        fields.nom,
        fields.description,
        fields.categorie,
        fields.nb_chambres,
        fields.capacite_max,
        fields.adresse,
        fields.quartier,
        fields.ville,
        fields.code_postal,
        fields.pays,
        fields.latitude,
        fields.longitude,
        fields.telephone,
        fields.whatsapp,
        fields.email,
        fields.site_web,
        fields.devise,
        fields.taux_tva,
        fields.numero_patente,
        fields.numero_ice,
        fields.numero_classement,
        fields.statut,
        fields.heure_checkin,
        fields.heure_checkout,
      ]
    );

    const maisonId = result.insertId;
    await syncRelations(connection, maisonId, req.body);
    await connection.commit();

    const maison = await fetchMaisonById(connection, maisonId);

    return res.status(201).json({
      message: "Maison d'hôtes créée avec succès.",
      maison,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating maison:", error);
    return res.status(500).json({ message: "Unable to create maison d'hôtes." });
  } finally {
    connection.release();
  }
}

async function updateMaison(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const fields = pickMaisonFields(req.body);

    if (!fields.nom) {
      return res.status(400).json({ message: "Le nom est obligatoire." });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        UPDATE maisons_hotes SET
          nom = ?, description = ?, categorie = ?, nb_chambres = ?, capacite_max = ?,
          adresse = ?, quartier = ?, ville = ?, code_postal = ?, pays = ?,
          latitude = ?, longitude = ?, telephone = ?, whatsapp = ?, email = ?, site_web = ?,
          devise = ?, taux_tva = ?, numero_patente = ?, numero_ice = ?, numero_classement = ?,
          statut = ?, heure_checkin = ?, heure_checkout = ?, date_maj = NOW()
        WHERE id = ?
      `,
      [
        fields.nom,
        fields.description,
        fields.categorie,
        fields.nb_chambres,
        fields.capacite_max,
        fields.adresse,
        fields.quartier,
        fields.ville,
        fields.code_postal,
        fields.pays,
        fields.latitude,
        fields.longitude,
        fields.telephone,
        fields.whatsapp,
        fields.email,
        fields.site_web,
        fields.devise,
        fields.taux_tva,
        fields.numero_patente,
        fields.numero_ice,
        fields.numero_classement,
        fields.statut,
        fields.heure_checkin,
        fields.heure_checkout,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Maison d'hôtes not found." });
    }

    await syncRelations(connection, id, req.body);
    await connection.commit();

    const maison = await fetchMaisonById(connection, id);

    return res.status(200).json({
      message: "Maison d'hôtes mise à jour avec succès.",
      maison,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating maison:", error);
    return res.status(500).json({ message: "Unable to update maison d'hôtes." });
  } finally {
    connection.release();
  }
}

async function deleteMaison(req, res) {
  try {
    const { id } = req.params;
    const [result] = await pool.query("DELETE FROM maisons_hotes WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Maison d'hôtes not found." });
    }

    return res.status(200).json({ message: "Maison d'hôtes supprimée avec succès." });
  } catch (error) {
    console.error("Error deleting maison:", error);
    return res.status(500).json({ message: "Unable to delete maison d'hôtes." });
  }
}

async function getReferenceData(req, res) {
  try {
    const [services] = await pool.query(
      "SELECT id, nom, icone FROM services ORDER BY nom ASC"
    );
    const [equipements] = await pool.query(
      "SELECT id, nom, categorie, icone FROM equipements ORDER BY nom ASC"
    );
    const [langues] = await pool.query(
      "SELECT id, code, nom FROM langues ORDER BY nom ASC"
    );

    return res.status(200).json({ services, equipements, langues });
  } catch (error) {
    console.error("Error fetching reference data:", error);
    return res.status(500).json({ message: "Unable to fetch reference data." });
  }
}

module.exports = {
  getMaisons,
  getMaisonsCatalog,
  getMaisonById,
  createMaison,
  updateMaison,
  deleteMaison,
  getReferenceData,
};
