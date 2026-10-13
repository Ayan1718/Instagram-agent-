
const crypto = require("node:crypto");
const { Pool } = require("pg");

function getEncryptionKey() {
const key = process.env.CANVA_TOKEN_ENCRYPTION_KEY;

if (!key || !/^[0-9a-f]{64}$/i.test(key)) {
throw new Error(
"CANVA_TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters."
);
}

return Buffer.from(key, "hex");
}

function encrypt(value) {
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv(
"aes-256-gcm",
getEncryptionKey(),
iv
);

const encrypted = Buffer.concat([
cipher.update(JSON.stringify(value), "utf8"),
cipher.final(),
]);

const tag = cipher.getAuthTag();

return [iv, tag, encrypted]
.map((part) => part.toString("base64"))
.join(".");
}

function decrypt(value) {
const parts = value.split(".");

if (parts.length !== 3) {
throw new Error("Invalid encrypted Canva data.");
}

const [iv, tag, encrypted] = parts.map((part) =>
Buffer.from(part, "base64")
);

const decipher = crypto.createDecipheriv(
"aes-256-gcm",
getEncryptionKey(),
iv
);

decipher.setAuthTag(tag);

const decrypted = Buffer.concat([
decipher.update(encrypted),
decipher.final(),
]);

return JSON.parse(decrypted.toString("utf8"));
}

const pool = process.env.DATABASE_URL
? new Pool({
connectionString: process.env.DATABASE_URL,
ssl:
process.env.PGSSL === "true"
? { rejectUnauthorized: false }
: undefined,
})
: null;

async function initializeCanvaDatabase() {
if (!pool) {
throw new Error("DATABASE_URL is not configured.");
}

await pool.query("CREATE TABLE IF NOT EXISTS canva_oauth_sessions ( session_id TEXT PRIMARY KEY, client_info JSONB, encrypted_tokens TEXT, encrypted_verifier TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() )");
}

async function getCanvaSession(sessionId) {
if (!pool) {
throw new Error("DATABASE_URL is not configured.");
}

const result = await pool.query(
"SELECT session_id, client_info, encrypted_tokens, encrypted_verifier FROM canva_oauth_sessions WHERE session_id = $1",
[sessionId]
);

const row = result.rows[0];

if (!row) return undefined;

return {
sessionId: row.session_id,
clientInfo: row.client_info,
tokens: row.encrypted_tokens
? decrypt(row.encrypted_tokens)
: undefined,
verifier: row.encrypted_verifier
? decrypt(row.encrypted_verifier)
: undefined,
};
}

async function saveCanvaSession(sessionId, data) {
if (!pool) {
throw new Error("DATABASE_URL is not configured.");
}

const existing = await getCanvaSession(sessionId);

const clientInfo =
data.clientInfo !== undefined
? data.clientInfo
: existing?.clientInfo;

const tokens =
data.tokens !== undefined
? data.tokens
: existing?.tokens;

const verifier =
data.verifier !== undefined
? data.verifier
: existing?.verifier;

await pool.query(
"INSERT INTO canva_oauth_sessions (session_id, client_info, encrypted_tokens, encrypted_verifier, updated_at) VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (session_id) DO UPDATE SET client_info = EXCLUDED.client_info, encrypted_tokens = EXCLUDED.encrypted_tokens, encrypted_verifier = EXCLUDED.encrypted_verifier, updated_at = NOW()",
[
sessionId,
clientInfo == null ? null : JSON.stringify(clientInfo),
tokens == null ? null : encrypt(tokens),
verifier == null ? null : encrypt(verifier),
]
);
}

async function deleteCanvaSession(sessionId) {
if (!pool) {
throw new Error("DATABASE_URL is not configured.");
}

await pool.query(
"DELETE FROM canva_oauth_sessions WHERE session_id = $1",
[sessionId]
);
}

module.exports = {
pool,
initializeCanvaDatabase,
getCanvaSession,
saveCanvaSession,
deleteCanvaSession,
};
