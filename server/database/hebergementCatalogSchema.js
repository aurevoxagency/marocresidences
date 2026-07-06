const { pool } = require("./db");

const ROOM_TYPES = ["Single", "Double", "Triple", "Quadruple", "Quintuple"];

async function ensureHebergementCatalogues() {
  try {
    for (const nom of ROOM_TYPES) {
      await pool.query("INSERT IGNORE INTO types_chambre (nom) VALUES (?)", [nom]);
    }

    console.log("[DB] Catalogue types_chambre synchronisé.");
  } catch (error) {
    console.warn("[DB] Impossible de synchroniser types_chambre:", error.message);
  }
}

function getRoomTypesOrderSql() {
  return ROOM_TYPES.map((nom) => `'${nom}'`).join(", ");
}

module.exports = {
  ROOM_TYPES,
  ensureHebergementCatalogues,
  getRoomTypesOrderSql,
};
