require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createTable() {
  try {
    const query = `
      DROP TABLE IF EXISTS form_data;
      
      CREATE TABLE form_data (
        id SERIAL PRIMARY KEY,
        from_name VARCHAR(255),
        from_email VARCHAR(255),
        phone VARCHAR(50),
        source VARCHAR(100),
        linked_in VARCHAR(255),
        cv_filename VARCHAR(255),
        cv_file_data BYTEA,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(query);
    console.log("Table 'form_data' created successfully on Render!");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    await pool.end();
  }
}

createTable();
