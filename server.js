require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer Configuration (Memory Storage + 2MB Limit)
// Memory storage is used so we don't save to Render's temporary disk, but directly to DB.
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB limit in bytes
});

// PostgreSQL Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

// 1. Ping Route
app.get('/ping', (req, res) => {
  console.log("Ping received, staying awake!");
  res.status(200).send('Server is awake!');
});

// 2. Form Submission Route (Accepts file and text fields)
// 'my_file' match karna chahiye frontend ke file input naam se
app.post('/api/submit-form', (req, res) => {
  
  // upload.single('my_file') ek non-blocking function hai jo file ko handle karega
  upload.single('my_file')(req, res, async function (err) {
    // === ERROR HANDLING (Taaki server crash/block na ho) ===
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "File size cannot exceed 2MB." });
      }
      return res.status(400).json({ success: false, message: "Multer error: " + err.message });
    } else if (err) {
      return res.status(500).json({ success: false, message: "Unknown file upload error." });
    }

    // === SUCCESSFUL UPLOAD -> NOW SAVE TO DATABASE ===
    try {
      // Ye saari fields aapke screenshot ke hisaab se li gayi hain. Hum 'linked-in' aur 'linked_in' dono check kar rahe hain taaki null na aaye.
      const { from_name, from_email, phone, source, 'linked-in': linkedInDash, linked_in, cv_filename } = req.body; 
      
      const finalLinkedIn = linkedInDash || linked_in || null;

      // File ka data (binary) aur uska asali naam
      const fileData = req.file ? req.file.buffer : null; 
      const actualFilename = req.file ? req.file.originalname : cv_filename;

      const query = `
        INSERT INTO form_data (from_name, from_email, phone, source, linked_in, cv_filename, cv_file_data) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id, from_name;
      `;
      
      const values = [from_name, from_email, phone, source, finalLinkedIn, actualFilename, fileData];

      const result = await pool.query(query, values);
      
      console.log("Data saved successfully with ID:", result.rows[0].id);
      res.status(200).json({ success: true, message: "Form submitted successfully!" });
      
    } catch (error) {
      console.error('Error saving to Database:', error);
      res.status(500).json({ success: false, message: "Failed to save form data to database." });
    }
  });
});

// 3. Admin Route - Data Webpage Par Dekhne Ke Liye
app.get('/admin/data', async (req, res) => {
  try {
    const query = 'SELECT id, from_name, from_email, phone, source, linked_in, cv_filename, created_at FROM form_data ORDER BY created_at DESC';
    const result = await pool.query(query);
    
    let html = `
      <html>
      <head>
        <title>Admin Submissions</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background-color: #f4f7f6; }
          h2 { color: #333; }
          table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #007bff; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <h2>Submitted Applications</h2>
        <table>
          <tr>
            <th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>LinkedIn</th><th>CV File</th><th>Date</th>
          </tr>
    `;
    
    result.rows.forEach(row => {
      html += `
        <tr>
          <td>${row.id}</td>
          <td>${row.from_name || '-'}</td>
          <td>${row.from_email || '-'}</td>
          <td>${row.phone || '-'}</td>
          <td>${row.source || '-'}</td>
          <td><a href="${row.linked_in}" target="_blank">Link</a></td>
          <td>${row.cv_filename ? `<a href="/admin/download/${row.id}" style="color: #28a745; font-weight: bold; text-decoration: none;">📥 Download</a>` : '-'}</td>
          <td>${new Date(row.created_at).toLocaleString()}</td>
        </tr>
      `;
    });
    
    html += `
        </table>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching data");
  }
});

// 4. Download Route - Resume ko database se nikal kar download karwane ke liye
app.get('/admin/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT cv_filename, cv_file_data FROM form_data WHERE id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0 || !result.rows[0].cv_file_data) {
      return res.status(404).send("File not found or no CV was uploaded.");
    }

    const fileBuffer = result.rows[0].cv_file_data;
    const fileName = result.rows[0].cv_filename || 'resume.pdf';

    // Browser ko batate hain ki ye ek file hai jise download karna hai
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).send("Error downloading file");
  }
});

// Server Start
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
