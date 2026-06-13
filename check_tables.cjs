const { sql } = require('./api/db.js');

async function check() {
  try {
    const tables = await sql.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log("TABLES IN DB:", tables);

    // Let's check schemas of listings and scrapes
    const scrapesCols = await sql.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'scrapes';
    `);
    console.log("SCRAPES COLUMNS:", scrapesCols);
    
  } catch (err) {
    console.error(err);
  }
}

check();
