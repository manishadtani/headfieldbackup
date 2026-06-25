require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

async function viewData() {
  try {
    // Hum file data nahi dikha rahe (kyunki wo bahut bada binary text hoga), baaki sab nikal rahe hain
    const query = 'SELECT id, from_name, from_email, phone, source, linked_in, cv_filename, created_at FROM form_data';
    const result = await pool.query(query);
    
    console.log(`\n--- Total Submissions: ${result.rows.length} ---\n`);
    console.table(result.rows);
    
  } catch (err) {
    console.error("Error fetching data:", err);
  } finally {
    await pool.end();
  }
}

viewData();
