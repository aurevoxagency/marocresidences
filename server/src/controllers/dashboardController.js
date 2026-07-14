const { pool } = require("../../database/db");

const PROSPECT_STATUT_LABELS = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  en_negociation: "En négociation",
  converti: "Converti",
  perdu: "Perdu",
};

const PROSPECT_SOURCE_LABELS = {
  site_web: "Site web",
  reseaux_sociaux: "Réseaux sociaux",
  booking: "Booking",
  airbnb: "Airbnb",
  agence: "Agence",
  bouche_a_oreille: "Bouche-à-oreille",
  walk_in: "Walk-in",
  autre: "Autre",
};

const MAISON_STATUT_LABELS = {
  actif: "Active",
  inactif: "Inactive",
  en_attente: "En attente",
};

const RESERVATION_STATUT_LABELS = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  annulee: "Annulée",
  terminee: "Terminée",
  no_show: "No-show",
};

const RESERVATION_SOURCE_LABELS = {
  site_web: "Site web",
  booking: "Booking",
  airbnb: "Airbnb",
  agence: "Agence",
  telephone: "Téléphone",
  walk_in: "Walk-in",
  autre: "Autre",
};

const RESERVATION_PAIEMENT_LABELS = {
  non_paye: "Non payé",
  acompte_paye: "Acompte payé",
  paye_totalement: "Payé totalement",
  rembourse: "Remboursé",
};

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function buildLastMonths(count = 6) {
  const months = [];
  const now = new Date();

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    months.push({
      month: key,
      label: `${MONTH_LABELS[date.getMonth()]} ${String(year).slice(-2)}`,
    });
  }

  return months;
}

function mapCounts(rows, labelMap, keyField = "key") {
  return rows.map((row) => {
    const key = row[keyField];
    return {
      key,
      label: labelMap[key] || key,
      total: Number(row.total) || 0,
    };
  });
}

function mergeMonthlyTrend(months, prospectRows, clientRows) {
  const prospectMap = new Map(
    prospectRows.map((row) => [row.month, Number(row.total) || 0])
  );
  const clientMap = new Map(
    clientRows.map((row) => [row.month, Number(row.total) || 0])
  );

  return months.map((item) => ({
    month: item.month,
    label: item.label,
    prospects: prospectMap.get(item.month) || 0,
    clients: clientMap.get(item.month) || 0,
  }));
}

function mergeReservationMonthlyTrend(months, reservationRows) {
  const countMap = new Map(
    reservationRows.map((row) => [row.month, Number(row.total) || 0])
  );
  const revenueMap = new Map(
    reservationRows.map((row) => [row.month, Number(row.ca) || 0])
  );

  return months.map((item) => ({
    month: item.month,
    label: item.label,
    reservations: countMap.get(item.month) || 0,
    chiffre_affaires: revenueMap.get(item.month) || 0,
  }));
}

async function getDashboardStats(req, res) {
  try {
    const months = buildLastMonths(6);
    const oldestMonth = months[0]?.month;

    const [
      [maisonSummary],
      [hebergementSummary],
      [prospectSummary],
      [clientSummary],
      [reservationSummary],
      [maisonsStatut],
      [maisonsVille],
      [prospectsStatut],
      [prospectsSource],
      [prospectsMonthly],
      [clientsMonthly],
      [reservationsStatut],
      [reservationsSource],
      [reservationsPaiement],
      [reservationsMonthly],
      [reservationsMaison],
      [chambresMaison],
      [chambresStatut],
      [saisonsMaison],
      [clientsNationalite],
      [clientsVip],
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          SUM(statut = 'actif') AS actives,
          COALESCE(SUM(nb_chambres), 0) AS chambres
        FROM maisons_hotes
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM chambres WHERE statut = 'actif') AS chambres_actives,
          (SELECT COALESCE(SUM(capacite_max * allotement), 0) FROM chambres WHERE statut = 'actif') AS capacite,
          (SELECT COUNT(*) FROM saisons) AS saisons,
          (SELECT COUNT(*) FROM supplements WHERE statut = 'actif') AS supplements_actifs,
          (SELECT COUNT(*) FROM tranches_age) AS tranches_age
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          SUM(statut = 'converti') AS convertis
        FROM prospects
      `),
      pool.query(`SELECT COUNT(*) AS total FROM clients`),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          SUM(statut_reservation = 'confirmee') AS confirmees,
          SUM(statut_reservation = 'en_attente') AS en_attente,
          COALESCE(
            SUM(
              CASE
                WHEN statut_reservation NOT IN ('annulee') THEN prix_total_ttc
                ELSE 0
              END
            ),
            0
          ) AS chiffre_affaires
        FROM reservations
      `),
      pool.query(`
        SELECT statut AS \`key\`, COUNT(*) AS total
        FROM maisons_hotes
        GROUP BY statut
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(ville), ''), 'Non renseignée') AS ville,
          COUNT(*) AS total
        FROM maisons_hotes
        GROUP BY ville
        ORDER BY total DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT statut AS \`key\`, COUNT(*) AS total
        FROM prospects
        GROUP BY statut
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT source AS \`key\`, COUNT(*) AS total
        FROM prospects
        GROUP BY source
        ORDER BY total DESC
      `),
      pool.query(
        `
          SELECT DATE_FORMAT(date_creation, '%Y-%m') AS month, COUNT(*) AS total
          FROM prospects
          WHERE date_creation >= DATE_FORMAT(?, '%Y-%m-01')
          GROUP BY month
          ORDER BY month ASC
        `,
        [`${oldestMonth}-01`]
      ),
      pool.query(
        `
          SELECT DATE_FORMAT(date_creation, '%Y-%m') AS month, COUNT(*) AS total
          FROM clients
          WHERE date_creation >= DATE_FORMAT(?, '%Y-%m-01')
          GROUP BY month
          ORDER BY month ASC
        `,
        [`${oldestMonth}-01`]
      ),
      pool.query(`
        SELECT statut_reservation AS \`key\`, COUNT(*) AS total
        FROM reservations
        GROUP BY statut_reservation
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT source AS \`key\`, COUNT(*) AS total
        FROM reservations
        GROUP BY source
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT statut_paiement AS \`key\`, COUNT(*) AS total
        FROM reservations
        GROUP BY statut_paiement
        ORDER BY total DESC
      `),
      pool.query(
        `
          SELECT
            DATE_FORMAT(date_creation, '%Y-%m') AS month,
            COUNT(*) AS total,
            COALESCE(
              SUM(
                CASE
                  WHEN statut_reservation NOT IN ('annulee') THEN prix_total_ttc
                  ELSE 0
                END
              ),
              0
            ) AS ca
          FROM reservations
          WHERE date_creation >= DATE_FORMAT(?, '%Y-%m-01')
          GROUP BY month
          ORDER BY month ASC
        `,
        [`${oldestMonth}-01`]
      ),
      pool.query(`
        SELECT
          m.nom AS maison,
          COUNT(r.id) AS total,
          COALESCE(
            SUM(
              CASE
                WHEN r.statut_reservation NOT IN ('annulee') THEN r.prix_total_ttc
                ELSE 0
              END
            ),
            0
          ) AS chiffre_affaires
        FROM maisons_hotes m
        LEFT JOIN reservations r ON r.maison_id = m.id
        GROUP BY m.id, m.nom
        ORDER BY total DESC, chiffre_affaires DESC, m.nom ASC
        LIMIT 6
      `),
      pool.query(`
        SELECT
          m.nom AS maison,
          COUNT(c.id) AS chambres,
          COALESCE(SUM(c.allotement), 0) AS allotement
        FROM maisons_hotes m
        LEFT JOIN chambres c ON c.maison_id = m.id
        GROUP BY m.id, m.nom
        ORDER BY allotement DESC, chambres DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT statut AS \`key\`, COUNT(*) AS total
        FROM chambres
        GROUP BY statut
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT m.nom AS maison, COUNT(s.id) AS total
        FROM maisons_hotes m
        LEFT JOIN saisons s ON s.maison_id = m.id
        GROUP BY m.id, m.nom
        ORDER BY total DESC, m.nom ASC
        LIMIT 6
      `),
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(nationalite), ''), 'Non renseignée') AS nationalite,
          COUNT(*) AS total
        FROM clients
        GROUP BY nationalite
        ORDER BY total DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT is_vip AS vip, COUNT(*) AS total
        FROM clients
        GROUP BY is_vip
        ORDER BY vip DESC
      `),
    ]);

    const prospectsTotal = Number(prospectSummary[0]?.total) || 0;
    const prospectsConvertis = Number(prospectSummary[0]?.convertis) || 0;

    return res.status(200).json({
      summary: {
        maisons: Number(maisonSummary[0]?.total) || 0,
        maisons_actives: Number(maisonSummary[0]?.actives) || 0,
        chambres: Number(maisonSummary[0]?.chambres) || 0,
        capacite_totale: Number(hebergementSummary[0]?.capacite) || 0,
        chambres_actives: Number(hebergementSummary[0]?.chambres_actives) || 0,
        saisons: Number(hebergementSummary[0]?.saisons) || 0,
        supplements_actifs: Number(hebergementSummary[0]?.supplements_actifs) || 0,
        tranches_age: Number(hebergementSummary[0]?.tranches_age) || 0,
        prospects: prospectsTotal,
        prospects_convertis: prospectsConvertis,
        taux_conversion:
          prospectsTotal > 0
            ? Math.round((prospectsConvertis / prospectsTotal) * 1000) / 10
            : 0,
        clients: Number(clientSummary[0]?.total) || 0,
        reservations: Number(reservationSummary[0]?.total) || 0,
        reservations_confirmees: Number(reservationSummary[0]?.confirmees) || 0,
        reservations_en_attente: Number(reservationSummary[0]?.en_attente) || 0,
        chiffre_affaires_reservations:
          Number(reservationSummary[0]?.chiffre_affaires) || 0,
      },
      maisons_par_statut: mapCounts(maisonsStatut, MAISON_STATUT_LABELS),
      maisons_par_ville: maisonsVille.map((row) => ({
        ville: row.ville,
        total: Number(row.total) || 0,
      })),
      prospects_par_statut: mapCounts(prospectsStatut, PROSPECT_STATUT_LABELS),
      prospects_par_source: mapCounts(prospectsSource, PROSPECT_SOURCE_LABELS),
      evolution_mensuelle: mergeMonthlyTrend(months, prospectsMonthly, clientsMonthly),
      chambres_par_maison: chambresMaison.map((row) => ({
        maison: row.maison,
        chambres: Number(row.chambres) || 0,
        allotement: Number(row.allotement) || 0,
      })),
      chambres_par_statut: chambresStatut.map((row) => ({
        key: row.key,
        label: row.key === "actif" ? "Actives" : "Inactives",
        total: Number(row.total) || 0,
      })),
      saisons_par_maison: saisonsMaison.map((row) => ({
        maison: row.maison,
        total: Number(row.total) || 0,
      })),
      clients_par_nationalite: clientsNationalite.map((row) => ({
        nationalite: row.nationalite,
        total: Number(row.total) || 0,
      })),
      clients_vip: clientsVip.map((row) => ({
        vip: Boolean(row.vip),
        label: row.vip ? "Clients VIP" : "Clients standard",
        total: Number(row.total) || 0,
      })),
      reservations_par_statut: mapCounts(reservationsStatut, RESERVATION_STATUT_LABELS),
      reservations_par_source: mapCounts(reservationsSource, RESERVATION_SOURCE_LABELS),
      reservations_par_paiement: mapCounts(reservationsPaiement, RESERVATION_PAIEMENT_LABELS),
      reservations_evolution_mensuelle: mergeReservationMonthlyTrend(
        months,
        reservationsMonthly
      ),
      reservations_par_maison: reservationsMaison.map((row) => ({
        maison: row.maison,
        total: Number(row.total) || 0,
        chiffre_affaires: Number(row.chiffre_affaires) || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ message: "Impossible de charger les statistiques." });
  }
}

module.exports = {
  getDashboardStats,
};
