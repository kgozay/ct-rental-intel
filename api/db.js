const { neon } = require('@neondatabase/serverless');

if (!process.env.NEON_DATABASE_URL) {
  throw new Error("NEON_DATABASE_URL is not set");
}

module.exports = {
  sql: neon(process.env.NEON_DATABASE_URL)
};
