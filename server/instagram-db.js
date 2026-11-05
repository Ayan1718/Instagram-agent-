const { pool, encrypt, decrypt } = require("./canva-db");

async function initializeInstagramDatabase() {
  if (!pool) throw new Error("DATABASE_URL is not configured.");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS instagram_oauth_tokens (
      id TEXT PRIMARY KEY,
      encrypted_token TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function saveInstagramToken(token) {
  if (!pool) throw new Error("DATABASE_URL is not configured.");

  await pool.query(
    `INSERT INTO instagram_oauth_tokens (id, encrypted_token)
     VALUES ('primary', $1)
     ON CONFLICT (id)
     DO UPDATE SET encrypted_token = EXCLUDED.encrypted_token,
                   updated_at = NOW()`,
    [encrypt(token)]
  );
}

async function getInstagramToken() {
  if (!pool) throw new Error("DATABASE_URL is not configured.");

  const result = await pool.query(
    "SELECT encrypted_token FROM instagram_oauth_tokens WHERE id = 'primary'"
  );

  return result.rows.length ? decrypt(result.rows[0].encrypted_token) : null;
}

module.exports = {
  initializeInstagramDatabase,
  saveInstagramToken,
  getInstagramToken
};
