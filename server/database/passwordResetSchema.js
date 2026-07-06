const { pool } = require("./db");

async function ensurePasswordResetSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_password_reset_token_hash (token_hash),
        INDEX idx_password_reset_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("[DB] Table password_reset_tokens prête.");
  } catch (error) {
    console.warn(
      "[DB] Impossible de créer password_reset_tokens:",
      error.message
    );
  }
}

module.exports = {
  ensurePasswordResetSchema,
};
