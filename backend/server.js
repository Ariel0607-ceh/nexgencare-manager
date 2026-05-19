require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nexgencare',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

const JWT_SECRET = process.env.JWT_SECRET || 'nexgencare-secret-key';

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
};

const generateJobId = () => `JOB-${Date.now().toString(36).toUpperCase()}`;

// ==================== AUTH ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [req.user.userId]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CLIENTS ====================
app.get('/api/clients', auth, async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `
      SELECT c.*, COUNT(j.id) as job_count 
      FROM clients c 
      LEFT JOIN jobs j ON c.id = j.client_id
    `;
    let params = [];
    
    if (search) {
      sql += ` WHERE c.full_name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    sql += ` GROUP BY c.id ORDER BY c.created_at DESC`;
    
    const result = await pool.query(sql, params);
    res.json(result.rows.map(r => ({
      id: r.id.toString(),
      fullName: r.full_name,
      phone: r.phone,
      email: r.email,
      address: r.address,
      createdAt: r.created_at,
      _count: { jobs: parseInt(r.job_count) || 0 }
    })));
  } catch (err) {
    console.error('Get clients error:', err);
    res.status(500).json({ error: 'Failed to load clients' });
  }
});

app.post('/api/clients', auth, async (req, res) => {
  try {
    const { fullName, phone, email, address } = req.body;
    const result = await pool.query(
      `INSERT INTO clients (full_name, phone, email, address) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [fullName, phone, email, address]
    );
    const c = result.rows[0];
    res.status(201).json({
      id: c.id.toString(),
      fullName: c.full_name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      createdAt: c.created_at,
      _count: { jobs: 0 }
    });
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.get('/api/clients/:id', auth, async (req, res) => {
  try {
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!clientResult.rows[0]) return res.status(404).json({ error: 'Not found' });
    const c = clientResult.rows[0];
    
    const jobsResult = await pool.query(
      `SELECT id, job_id, status, brand, model, device_type, created_at 
       FROM jobs WHERE client_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    
    res.json({
      id: c.id.toString(),
      fullName: c.full_name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      createdAt: c.created_at,
      jobs: jobsResult.rows.map(r => ({
        id: r.id.toString(),
        jobId: r.job_id,
        status: r.status,
        createdAt: r.created_at,
        device: { brand: r.brand, model: r.model, deviceType: r.device_type }
      }))
    });
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/clients/:id', auth, async (req, res) => {
  try {
    const { fullName, phone, email, address } = req.body;
    await pool.query(
      'UPDATE clients SET full_name=$1, phone=$2, email=$3, address=$4 WHERE id=$5',
      [fullName, phone, email, address, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', auth, async (req, res) => {
  try {
    const jobsCheck = await pool.query(
      'SELECT COUNT(*) as count FROM jobs WHERE client_id = $1',
      [req.params.id]
    );
    
    const jobCount = parseInt(jobsCheck.rows[0].count);
    
    if (jobCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete client. They have ${jobCount} job(s) linked to their record. Please delete or reassign those jobs first.` 
      });
    }
    
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete client error:', err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ==================== JOBS ====================
app.get('/api/jobs/stats/overview', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('RECEIVED','IN_PROGRESS') THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today,
        COUNT(CASE WHEN status = 'RECEIVED' THEN 1 END) as received,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'CLEANING_COMPLETED' THEN 1 END) as cleaning_completed,
        COUNT(CASE WHEN status = 'READY_FOR_PICKUP' THEN 1 END) as ready_for_pickup
      FROM jobs
    `);
    const r = result.rows[0];
    res.json({
      total: parseInt(r.total) || 0,
      pending: parseInt(r.pending) || 0,
      completed: parseInt(r.completed) || 0,
      today: parseInt(r.today) || 0,
      received: parseInt(r.received) || 0,
      inProgress: parseInt(r.in_progress) || 0,
      cleaningCompleted: parseInt(r.cleaning_completed) || 0,
      readyForPickup: parseInt(r.ready_for_pickup) || 0,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

app.get('/api/jobs', auth, async (req, res) => {
  try {
    const { status, search, clientId } = req.query;
    let sql = `
      SELECT j.*, c.full_name as client_name, c.phone as client_phone 
      FROM jobs j 
      LEFT JOIN clients c ON j.client_id = c.id 
      WHERE 1=1
    `;
    let params = [];
    
    if (status) {
      params.push(status);
      sql += ` AND j.status = $${params.length}`;
    }
    if (clientId) {
      params.push(clientId);
      sql += ` AND j.client_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (j.job_id ILIKE $${params.length} OR c.full_name ILIKE $${params.length})`;
    }
    
    sql += ` ORDER BY j.created_at DESC`;
    
    const result = await pool.query(sql, params);
    res.json(result.rows.map(r => ({
      id: r.id.toString(),
      jobId: r.job_id,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      client: r.client_name ? { fullName: r.client_name, phone: r.client_phone } : null,
      device: { brand: r.brand, model: r.model, serialNumber: r.serial_number, deviceType: r.device_type }
    })));
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: 'Failed to load jobs' });
  }
});

app.get('/api/jobs/:id', auth, async (req, res) => {
  try {
    const jobResult = await pool.query(`
      SELECT j.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email,
             u.name as created_by_name, au.name as assigned_to_name
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      LEFT JOIN users u ON j.created_by = u.id
      LEFT JOIN users au ON j.assigned_to_id = au.id
      WHERE j.id = $1
    `, [req.params.id]);
    
    if (!jobResult.rows[0]) return res.status(404).json({ error: 'Not found' });
    const r = jobResult.rows[0];
    
    const checklistResult = await pool.query(
      `SELECT id, job_id, title, description, completed, notes, created_at, completed_at,
              completed_by,
              (SELECT name FROM users WHERE id = completed_by) as completed_by_name
       FROM job_checklists WHERE job_id = $1 ORDER BY id ASC`,
      [req.params.id]
    );
    
    const mediaResult = await pool.query(
      `SELECT id, job_id, type, category, file_data as url, filename, mime_type, created_at 
       FROM media_files WHERE job_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    
    const consentResult = await pool.query(
      `SELECT * FROM consent_forms WHERE job_id = $1 LIMIT 1`,
      [req.params.id]
    );
    
    const handoverResult = await pool.query(
      `SELECT * FROM handover_records WHERE job_id = $1 LIMIT 1`,
      [req.params.id]
    );
    
    res.json({
      id: r.id.toString(),
      jobId: r.job_id,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      receivedAt: r.received_at || r.created_at,
      completedAt: r.completed_at || null,
      client: { fullName: r.client_name, phone: r.client_phone, email: r.client_email },
      device: { brand: r.brand, model: r.model, serialNumber: r.serial_number, deviceType: r.device_type },
      issueDescription: r.reported_issues,
      scratches: r.scratches,
      damageNotes: r.damage_notes,
      reportedIssues: r.reported_issues,
      notes: r.notes,
      createdBy: r.created_by_name ? { name: r.created_by_name } : null,
      createdByName: r.created_by_name,
      assignedTo: r.assigned_to_name ? { name: r.assigned_to_name } : null,
      checklist: checklistResult.rows.map(item => ({
        id: item.id.toString(),
        title: item.title,
        description: item.description,
        completed: item.completed,
        notes: item.notes,
        completedAt: item.completed_at,
        user: item.completed_by_name ? { name: item.completed_by_name } : null,
      })),
      mediaFiles: mediaResult.rows.map(m => ({
        id: m.id.toString(),
        type: m.type,
        category: m.category,
        url: m.url,
        filename: m.filename,
        mimeType: m.mime_type,
      })),
      consentForm: consentResult.rows[0] ? {
        id: consentResult.rows[0].id.toString(),
        clientSignature: consentResult.rows[0].client_signature,
        clientSignedAt: consentResult.rows[0].created_at,
        voluntaryHandover: consentResult.rows[0].voluntary_handover,
        allowCleaning: consentResult.rows[0].allow_cleaning,
        acknowledgeRisk: consentResult.rows[0].acknowledge_risk,
        confirmCondition: consentResult.rows[0].confirm_condition,
        staffWitnessName: consentResult.rows[0].staff_witness_name,
      } : null,
      handoverRecord: handoverResult.rows[0] ? {
        id: handoverResult.rows[0].id.toString(),
        clientSignature: handoverResult.rows[0].client_signature,
        paymentStatus: handoverResult.rows[0].payment_status,
        paymentAmount: handoverResult.rows[0].payment_amount,
        paymentNotes: handoverResult.rows[0].payment_notes,
        finalCondition: handoverResult.rows[0].final_condition,
        completed: handoverResult.rows[0].completed,
        completedAt: handoverResult.rows[0].completed_at,
      } : null,
    });
  } catch (err) {
    console.error('Get job detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/jobs', auth, async (req, res) => {
  try {
    const { clientId, brand, model, serialNumber, deviceType, scratches, damageNotes, reportedIssues, notes, receivedAt, createdByName, consentForm } = req.body;
    
    if (!clientId || !brand || !model) {
      return res.status(400).json({ error: 'Client, brand and model are required' });
    }
    
    const jobId = generateJobId();
    const creatorName = createdByName?.trim() || 'Zihan';
    
    let createdById = req.user.userId;
    const userCheck = await pool.query('SELECT id FROM users WHERE name = $1 LIMIT 1', [creatorName]);
    if (userCheck.rows[0]) {
      createdById = userCheck.rows[0].id;
    }
    
    const result = await pool.query(
      `INSERT INTO jobs (job_id, client_id, brand, model, serial_number, device_type, scratches, damage_notes, reported_issues, notes, status, created_by, received_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RECEIVED',$11,$12,null) RETURNING *`,
      [jobId, clientId || null, brand, model, serialNumber || null, deviceType || 'LAPTOP', scratches || null, damageNotes || null, reportedIssues || null, notes || null, createdById, receivedAt || null]
    );
    
    const newJob = result.rows[0];
    
    // Create consent form with received_at timestamp
    if (consentForm && consentForm.clientSignature) {
      await pool.query(
        `INSERT INTO consent_forms (job_id, voluntary_handover, allow_cleaning, acknowledge_risk, confirm_condition, client_signature, staff_witness_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [newJob.id, 
         consentForm.voluntaryHandover ?? true, 
         consentForm.allowCleaning ?? true, 
         consentForm.acknowledgeRisk ?? true, 
         consentForm.confirmCondition ?? true, 
         consentForm.clientSignature, 
         consentForm.staffWitnessName || creatorName,
         receivedAt || new Date().toISOString()]
      );
    }
    
    // Create checklist based on device type
    const checklists = {
      LAPTOP: [
        { title: 'Remove internal fan (4-6 screws)', description: 'Carefully unscrew and remove the internal cooling fan' },
        { title: 'Remove heatsink (8-12 screws)', description: 'Unscrew and detach the heatsink assembly from the motherboard' },
        { title: 'Clean old CPU and GPU thermal paste', description: 'Remove all old, dried thermal paste using isopropyl alcohol' },
        { title: 'Repaste CPU and GPU', description: 'Apply new high-quality thermal paste to CPU and GPU' },
        { title: 'Reattach heatsink and internal fan', description: 'Securely screw back the heatsink and fan assembly' },
        { title: 'Check battery and cable connections', description: 'Verify all internal cables and battery connections are secure' },
      ],
      DESKTOP: [
        { title: 'Remove internal fan (4-6 screws)', description: 'Carefully unscrew and remove the internal cooling fan' },
        { title: 'Remove heatsink (8-12 screws)', description: 'Unscrew and detach the heatsink assembly from the motherboard' },
        { title: 'Clean old CPU and GPU thermal paste', description: 'Remove all old, dried thermal paste using isopropyl alcohol' },
        { title: 'Repaste CPU and GPU', description: 'Apply new high-quality thermal paste to CPU and GPU' },
        { title: 'Reattach heatsink and internal fan', description: 'Securely screw back the heatsink and fan assembly' },
        { title: 'Check cable connections', description: 'Verify all internal cables and power connections are secure' },
      ],
      SMARTPHONE: [
        { title: 'Replace LCD screen', description: 'Remove damaged LCD and install new display assembly' },
        { title: 'Replace battery', description: 'Remove old battery and install new battery unit' },
        { title: 'Apply screen protector', description: 'Clean screen and apply new tempered glass protector' },
      ]
    };
    
    const items = checklists[deviceType] || checklists.LAPTOP;
    for (const item of items) {
      await pool.query(
        `INSERT INTO job_checklists (job_id, title, description, completed, created_at) VALUES ($1, $2, $3, false, NOW())`,
        [newJob.id, item.title, item.description]
      );
    }
    
    res.status(201).json(newJob);
  } catch (err) {
    console.error('Create job error:', err.message);
    res.status(500).json({ error: 'Failed to create job', detail: err.message });
  }
});

// ENFORCED STATUS FLOW: RECEIVED -> IN_PROGRESS -> CLEANING_COMPLETED -> READY_FOR_PICKUP -> COMPLETED
const validStatusTransitions = {
  'RECEIVED': ['IN_PROGRESS', 'CANCELLED'],
  'IN_PROGRESS': ['CLEANING_COMPLETED', 'CANCELLED'],
  'CLEANING_COMPLETED': ['READY_FOR_PICKUP', 'CANCELLED'],
  'READY_FOR_PICKUP': ['COMPLETED', 'CANCELLED'],
  'COMPLETED': [],
  'CANCELLED': ['RECEIVED'],
};

app.patch('/api/jobs/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Get current job status
    const currentJob = await pool.query('SELECT status, received_at FROM jobs WHERE id = $1', [req.params.id]);
    if (!currentJob.rows[0]) return res.status(404).json({ error: 'Job not found' });
    
    const currentStatus = currentJob.rows[0].status;
    const receivedAt = currentJob.rows[0].received_at;
    
    // Validate status transition
    const allowedTransitions = validStatusTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(status) && currentStatus !== status) {
      return res.status(400).json({ 
        error: `Invalid status transition. Cannot go from "${currentStatus}" to "${status}". Valid transitions: ${allowedTransitions.join(', ') || 'None'}` 
      });
    }
    
    // Check checklist completion for CLEANING_COMPLETED, READY_FOR_PICKUP, COMPLETED
    if (['CLEANING_COMPLETED', 'READY_FOR_PICKUP', 'COMPLETED'].includes(status)) {
      const checklistCheck = await pool.query(
        'SELECT COUNT(*) as total, COUNT(CASE WHEN completed = true THEN 1 END) as completed FROM job_checklists WHERE job_id = $1',
        [req.params.id]
      );
      const total = parseInt(checklistCheck.rows[0].total);
      const completed = parseInt(checklistCheck.rows[0].completed);
      
      if (completed < total) {
        return res.status(400).json({ 
          error: `Cannot update to ${status}. All checklist items must be completed first. Currently ${completed}/${total} completed.` 
        });
      }
    }
    
    // Check handover record for COMPLETED status
    if (status === 'COMPLETED') {
      const handoverCheck = await pool.query(
        'SELECT completed FROM handover_records WHERE job_id = $1',
        [req.params.id]
      );
      
      if (!handoverCheck.rows[0] || !handoverCheck.rows[0].completed) {
        return res.status(400).json({ 
          error: 'Cannot mark as COMPLETED. Handover must be verified first. Please go to Handover section and click "Complete Job".' 
        });
      }
      
      // Use handover completed_at date
      const handoverResult = await pool.query(
        'SELECT completed_at FROM handover_records WHERE job_id = $1 AND completed = true',
        [req.params.id]
      );
      const completedAt = handoverResult.rows[0]?.completed_at || receivedAt || new Date().toISOString();
      
      await pool.query(
        'UPDATE jobs SET status=$1, updated_at=NOW(), completed_at=$2 WHERE id=$3', 
        [status, completedAt, req.params.id]
      );
    } else {
      await pool.query('UPDATE jobs SET status=$1, updated_at=NOW() WHERE id=$2', [status, req.params.id]);
    }
    
    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/jobs/:id', auth, async (req, res) => {
  try {
    const { jobId, brand, model, serialNumber, deviceType, scratches, damageNotes, reportedIssues, notes, status, receivedAt } = req.body;
    
    await pool.query(
      `UPDATE jobs 
       SET job_id=$1, brand=$2, model=$3, serial_number=$4, device_type=$5, scratches=$6, 
           damage_notes=$7, reported_issues=$8, notes=$9, status=$10, updated_at=NOW(),
           received_at=$11
       WHERE id=$12`,
      [
        jobId || null,
        brand || null, 
        model || null, 
        serialNumber || null, 
        deviceType || 'LAPTOP', 
        scratches || null, 
        damageNotes || null, 
        reportedIssues || null, 
        notes || null,
        status || 'RECEIVED',
        receivedAt || null,
        req.params.id
      ]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

app.delete('/api/jobs/:id', auth, async (req, res) => {
  try {
    const safeDelete = async (table, column) => {
      try {
        await pool.query(`DELETE FROM ${table} WHERE ${column} = $1`, [req.params.id]);
      } catch (err) {
        console.log(`Note: ${table} not found or error, skipping`);
      }
    };

    await safeDelete('job_checklists', 'job_id');
    await safeDelete('media_files', 'job_id');
    await safeDelete('consent_forms', 'job_id');
    await safeDelete('handover_records', 'job_id');
    await safeDelete('audit_logs', 'job_id');
    
    await pool.query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// ==================== CHECKLIST ====================
app.patch('/api/checklist/:id/toggle', auth, async (req, res) => {
  try {
    const { notes } = req.body;
    const current = await pool.query('SELECT completed, job_id FROM job_checklists WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Not found' });
    
    const newCompleted = !current.rows[0].completed;
    const jobId = current.rows[0].job_id;
    
    // Get job received_at for the DATE portion
    const jobResult = await pool.query('SELECT received_at FROM jobs WHERE id = $1', [jobId]);
    const receivedAt = jobResult.rows[0]?.received_at;
    
    // =====================================================================
    // Build timestamp: received date + current real time (MANUAL STRING FIX)
    // =====================================================================
    let timestampForChecklist;
    
    // 1. Get ONLY the current time in Malaysia as a string (e.g., "18:51:00")
    const msiaTime = new Date().toLocaleTimeString('en-GB', { 
      timeZone: 'Asia/Kuala_Lumpur' 
    });

    if (receivedAt) {
      // 2. Extract the Date parts (Year, Month, Day) from the receivedDate
      const rd = new Date(receivedAt);
      const yyyy = rd.getFullYear();
      const mm = String(rd.getMonth() + 1).padStart(2, '0');
      const dd = String(rd.getDate()).padStart(2, '0');

      // 3. Manually glue them together with .000Z to lock in the exact Malaysian hour
      timestampForChecklist = `${yyyy}-${mm}-${dd}T${msiaTime}.000Z`;
    } else {
      // Fallback if there's no receivedAt: use today's date + Malaysian time
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      
      timestampForChecklist = `${yyyy}-${mm}-${dd}T${msiaTime}.000Z`;
    }
    // =====================================================================

    if (newCompleted) {
      await pool.query(
        `UPDATE job_checklists 
         SET completed = true, 
             completed_at = $1, 
             completed_by = $2::integer,
             notes = $3
         WHERE id = $4`,
        [timestampForChecklist, req.user.userId, notes || null, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE job_checklists 
         SET completed = false, 
             completed_at = NULL, 
             completed_by = NULL,
             notes = $1
         WHERE id = $2`,
        [notes || null, req.params.id]
      );
    }
    
    res.json({ success: true, completed: newCompleted });
  } catch (err) {
    console.error('Toggle checklist error:', err);
    res.status(500).json({ error: 'Failed to update checklist' });
  }
});

// ==================== MEDIA FILES ====================
app.post('/api/media', auth, async (req, res) => {
  try {
    const { jobId, type, category, fileData, filename, mimeType } = req.body;
    
    if (!fileData || !fileData.includes('base64')) {
      return res.status(400).json({ error: 'Invalid file data. Expected base64 data URI.' });
    }
    
    // Upload to Cloudinary instead of storing base64 in DB
    const resourceType = type === 'VIDEO' ? 'video' : 'image';
    const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
    
    const uploadResult = await cloudinary.uploader.upload(fileData, {
      resource_type: resourceType,
      folder: `nexgencare/jobs/${jobId}`,
      public_id: `${Date.now()}_${cleanName}`,
    });
    
    // Store only the Cloudinary URL in PostgreSQL
    const result = await pool.query(
      `INSERT INTO media_files (job_id, type, category, file_data, filename, mime_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [jobId, type, category, uploadResult.secure_url, filename, mimeType]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload media error:', err);
    res.status(500).json({ error: 'Failed to upload media', detail: err.message });
  }
});

app.delete('/api/media/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM media_files WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete media error:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// ==================== CONSENT FORMS ====================
app.post('/api/consent-forms', auth, async (req, res) => {
  try {
    const { jobId, voluntaryHandover, allowCleaning, acknowledgeRisk, confirmCondition, clientSignature, staffWitnessName } = req.body;
    
    await pool.query('DELETE FROM consent_forms WHERE job_id = $1', [jobId]);
    
    // Get job received_at for timestamp
    const jobResult = await pool.query('SELECT received_at FROM jobs WHERE id = $1', [jobId]);
    const receivedAt = jobResult.rows[0]?.received_at || new Date().toISOString();
    
    const result = await pool.query(
      `INSERT INTO consent_forms (job_id, voluntary_handover, allow_cleaning, acknowledge_risk, confirm_condition, client_signature, staff_witness_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING *`,
      [jobId, voluntaryHandover, allowCleaning, acknowledgeRisk, confirmCondition, clientSignature, staffWitnessName, receivedAt]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Save consent error:', err);
    res.status(500).json({ error: 'Failed to save consent form' });
  }
});

// ==================== HANDOVER RECORDS ====================
app.post('/api/handover-records', auth, async (req, res) => {
  try {
    const { jobId, clientSignature, paymentStatus, paymentAmount, paymentNotes, finalCondition, completedAt } = req.body;
    
    await pool.query('DELETE FROM handover_records WHERE job_id = $1', [jobId]);
    
    const result = await pool.query(
      `INSERT INTO handover_records (job_id, client_signature, payment_status, payment_amount, payment_notes, final_condition, completed, completed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7, NOW(), NOW()) RETURNING *`,
      [jobId, clientSignature, paymentStatus || 'UNPAID', paymentAmount || null, paymentNotes || null, finalCondition || null, completedAt || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Save handover error:', err);
    res.status(500).json({ error: 'Failed to save handover record' });
  }
});

app.patch('/api/handover-records/:id/complete', auth, async (req, res) => {
  try {
    const { completedAt } = req.body;
    const finalCompletedAt = completedAt || new Date().toISOString();
    
    // Check if all checklist items are completed
    const handover = await pool.query('SELECT job_id FROM handover_records WHERE id = $1', [req.params.id]);
    if (!handover.rows[0]) return res.status(404).json({ error: 'Handover record not found' });
    
    const jobId = handover.rows[0].job_id;
    
    const checklistCheck = await pool.query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN completed = true THEN 1 END) as completed FROM job_checklists WHERE job_id = $1',
      [jobId]
    );
    const total = parseInt(checklistCheck.rows[0].total);
    const completed = parseInt(checklistCheck.rows[0].completed);
    
    if (completed < total) {
      return res.status(400).json({ 
        error: `Cannot complete handover. All checklist items must be completed first. Currently ${completed}/${total} completed.` 
      });
    }
    
    await pool.query(
      `UPDATE handover_records SET completed = true, completed_at = $1, updated_at = NOW() WHERE id = $2`,
      [finalCompletedAt, req.params.id]
    );
    
    // Also update job status to COMPLETED
    await pool.query(
      `UPDATE jobs SET status = 'COMPLETED', completed_at = $1, updated_at = NOW() WHERE id = $2`,
      [finalCompletedAt, jobId]
    );
    
    res.json({ success: true, message: 'Handover completed and job marked as COMPLETED' });
  } catch (err) {
    console.error('Complete handover error:', err);
    res.status(500).json({ error: 'Failed to complete handover' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ==================== PUBLIC API (No Auth Required) ====================
app.get('/api/public/jobs/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter at least 2 characters' });
    }

    const searchTerm = `%${q.trim()}%`;
    
    const result = await pool.query(`
      SELECT j.id, j.job_id, j.status, j.brand, j.model, 
             c.full_name as client_name, c.phone as client_phone
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE j.job_id ILIKE $1 
         OR c.full_name ILIKE $1 
         OR c.phone ILIKE $1
      ORDER BY j.created_at DESC
      LIMIT 20
    `, [searchTerm]);

    res.json(result.rows.map(r => ({
      id: r.id.toString(),
      jobId: r.job_id,
      status: r.status,
      client: { 
        fullName: r.client_name || 'Unknown Client', 
        phone: r.client_phone || 'N/A' 
      },
      device: { 
        brand: r.brand || '', 
        model: r.model || '' 
      }
    })));
  } catch (err) {
    console.error('Public search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Public job detail endpoint
app.get('/api/public/jobs/:id', async (req, res) => {
  try {
    const jobResult = await pool.query(`
      SELECT j.*, c.full_name as client_name, c.phone as client_phone, c.email as client_email
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE j.id = $1
    `, [req.params.id]);
    
    if (!jobResult.rows[0]) return res.status(404).json({ error: 'Not found' });
    const r = jobResult.rows[0];
    
    const checklistResult = await pool.query(
      `SELECT id, job_id, title, description, completed, notes, created_at, completed_at,
              (SELECT name FROM users WHERE id = completed_by) as completed_by_name
       FROM job_checklists WHERE job_id = $1 ORDER BY id ASC`,
      [req.params.id]
    );
    
    const mediaResult = await pool.query(
      `SELECT id, job_id, type, category, file_data as url, filename, mime_type, created_at 
       FROM media_files WHERE job_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    
    const handoverResult = await pool.query(
      `SELECT * FROM handover_records WHERE job_id = $1 LIMIT 1`,
      [req.params.id]
    );
    
    res.json({
      id: r.id.toString(),
      jobId: r.job_id,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      receivedAt: r.received_at || r.created_at,
      completedAt: r.completed_at || null,
      client: { fullName: r.client_name, phone: r.client_phone, email: r.client_email },
      device: { brand: r.brand, model: r.model, serialNumber: r.serial_number, deviceType: r.device_type },
      scratches: r.scratches,
      damageNotes: r.damage_notes,
      reportedIssues: r.reported_issues,
      notes: r.notes,
      checklist: checklistResult.rows.map(item => ({
        id: item.id.toString(),
        title: item.title,
        description: item.description,
        completed: item.completed,
        notes: item.notes,
        completedAt: item.completed_at,
        user: item.completed_by_name ? { name: item.completed_by_name } : null,
      })),
      mediaFiles: mediaResult.rows.map(m => ({
        id: m.id.toString(),
        type: m.type,
        category: m.category,
        url: m.url,
        filename: m.filename,
        mimeType: m.mime_type,
      })),
      handoverRecord: handoverResult.rows[0] ? {
        id: handoverResult.rows[0].id.toString(),
        clientSignature: handoverResult.rows[0].client_signature,
        paymentStatus: handoverResult.rows[0].payment_status,
        paymentAmount: handoverResult.rows[0].payment_amount,
        paymentNotes: handoverResult.rows[0].payment_notes,
        finalCondition: handoverResult.rows[0].final_condition,
        completed: handoverResult.rows[0].completed,
        completedAt: handoverResult.rows[0].completed_at,
      } : null,
    });
  } catch (err) {
    console.error('Public job detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== STATISTICS DASHBOARD ====================
app.get('/api/stats/dashboard', auth, async (req, res) => {
  try {
    // Revenue stats (from handover payment amounts)
    const revenueResult = await pool.query(`
      SELECT 
        COALESCE(SUM(payment_amount), 0) as total_revenue,
        COUNT(*) as total_handovers,
        COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paid_count,
        COUNT(CASE WHEN payment_status = 'UNPAID' THEN 1 END) as unpaid_count
      FROM handover_records
      WHERE completed = true
    `);
    
    // Client stats
    const clientResult = await pool.query(`
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as new_this_month
      FROM clients
    `);
    
    // Job stats by status
    const jobStatusResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM jobs
      GROUP BY status
      ORDER BY count DESC
    `);
    
    // Jobs per month (last 6 months)
    const monthlyJobsResult = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
        COUNT(*) as count
      FROM jobs
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `);
    
    // Jobs per day (last 14 days)
    const dailyJobsResult = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', created_at), 'DD Mon') as date,
        COUNT(*) as count
      FROM jobs
      WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at) ASC
    `);
    
    // Device type distribution
    const deviceTypeResult = await pool.query(`
      SELECT device_type, COUNT(*) as count
      FROM jobs
      GROUP BY device_type
    `);
    
    // Top clients by job count
    const topClientsResult = await pool.query(`
      SELECT c.full_name, COUNT(j.id) as job_count
      FROM clients c
      LEFT JOIN jobs j ON c.id = j.client_id
      GROUP BY c.id, c.full_name
      ORDER BY job_count DESC
      LIMIT 5
    `);
    
    // Revenue by month (last 6 months)
    const monthlyRevenueResult = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', h.completed_at), 'Mon YYYY') as month,
        COALESCE(SUM(h.payment_amount), 0) as amount
      FROM handover_records h
      WHERE h.completed = true 
        AND h.completed_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
      GROUP BY DATE_TRUNC('month', h.completed_at)
      ORDER BY DATE_TRUNC('month', h.completed_at) ASC
    `);
    
    // Revenue by day (last 14 days)
    const dailyRevenueResult = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('day', h.completed_at), 'DD Mon') as date,
        COALESCE(SUM(h.payment_amount), 0) as amount
      FROM handover_records h
      WHERE h.completed = true 
        AND h.completed_at >= CURRENT_DATE - INTERVAL '13 days'
      GROUP BY DATE_TRUNC('day', h.completed_at)
      ORDER BY DATE_TRUNC('day', h.completed_at) ASC
    `);
    
    res.json({
      revenue: {
        total: parseFloat(revenueResult.rows[0].total_revenue) || 0,
        totalHandovers: parseInt(revenueResult.rows[0].total_handovers) || 0,
        paidCount: parseInt(revenueResult.rows[0].paid_count) || 0,
        unpaidCount: parseInt(revenueResult.rows[0].unpaid_count) || 0,
      },
      clients: {
        total: parseInt(clientResult.rows[0].total_clients) || 0,
        newThisMonth: parseInt(clientResult.rows[0].new_this_month) || 0,
      },
      jobsByStatus: jobStatusResult.rows.map(r => ({
        status: r.status,
        count: parseInt(r.count),
        label: r.status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      })),
      monthlyJobs: monthlyJobsResult.rows.map(r => ({
        month: r.month,
        count: parseInt(r.count),
      })),
      dailyJobs: dailyJobsResult.rows.map(r => ({
        date: r.date,
        count: parseInt(r.count),
      })),
      deviceTypes: deviceTypeResult.rows.map(r => ({
        type: r.device_type,
        count: parseInt(r.count),
      })),
      topClients: topClientsResult.rows.map(r => ({
        name: r.full_name,
        jobCount: parseInt(r.job_count),
      })),
      monthlyRevenue: monthlyRevenueResult.rows.map(r => ({
        month: r.month,
        amount: parseFloat(r.amount) || 0,
      })),
      dailyRevenue: dailyRevenueResult.rows.map(r => ({
        date: r.date,
        amount: parseFloat(r.amount) || 0,
      })),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load statistics' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});