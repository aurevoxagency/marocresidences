const { pool } = require("../../database/db");

const ADMIN_ROLE_IDS = new Set([1, 2]);

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

const ROLE_LABELS = {
  1: "Super admin",
  2: "Admin",
  3: "Client",
  4: "Réceptionniste",
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

async function getDashboardStats(req, res) {
  try {
    const isAdmin = ADMIN_ROLE_IDS.has(Number(req.auth?.role_id));
    const months = buildLastMonths(6);
    const oldestMonth = months[0]?.month;

    const [
      [maisonSummary],
      [hebergementSummary],
      [prospectSummary],
      [clientSummary],
      [maisonsStatut],
      [maisonsVille],
      [prospectsStatut],
      [prospectsSource],
      [prospectsMonthly],
      [clientsMonthly],
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
          COALESCE(SUM(nb_chambres), 0) AS chambres,
          COALESCE(SUM(capacite_max), 0) AS capacite
        FROM maisons_hotes
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM chambres WHERE statut = 'actif') AS chambres_actives,
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

    let utilisateursParRole = null;
    let utilisateursTotal = null;

    if (isAdmin) {
      const [[usersTotal], [usersRole]] = await Promise.all([
        pool.query("SELECT COUNT(*) AS total FROM users"),
        pool.query(`
          SELECT role_id, COUNT(*) AS total
          FROM users
          GROUP BY role_id
          ORDER BY total DESC
        `),
      ]);

      utilisateursTotal = Number(usersTotal[0]?.total) || 0;
      utilisateursParRole = usersRole.map((row) => ({
        role_id: Number(row.role_id),
        label: ROLE_LABELS[row.role_id] || `Rôle ${row.role_id}`,
        total: Number(row.total) || 0,
      }));
    }

    const prospectsTotal = Number(prospectSummary[0]?.total) || 0;
    const prospectsConvertis = Number(prospectSummary[0]?.convertis) || 0;

    return res.status(200).json({
      summary: {
        maisons: Number(maisonSummary[0]?.total) || 0,
        maisons_actives: Number(maisonSummary[0]?.actives) || 0,
        chambres: Number(maisonSummary[0]?.chambres) || 0,
        capacite_totale: Number(maisonSummary[0]?.capacite) || 0,
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
        utilisateurs: utilisateursTotal,
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
      utilisateurs_par_role: utilisateursParRole,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return res.status(500).json({ message: "Impossible de charger les statistiques." });
  }
}

module.exports = {
  getDashboardStats,
};
