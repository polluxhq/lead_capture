const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USERNAME || process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'pollux_lead_capture',
};

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  return pool;
}

async function initDb() {
  const connection = await getPool().getConnection();

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id INT NOT NULL AUTO_INCREMENT,
        api_token VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        ftd_date DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);

    const [columns] = await connection.query(`SHOW COLUMNS FROM leads LIKE 'id'`);
    const idColumn = columns[0];
    const isAutoIncrementInt = idColumn
      && /int/i.test(idColumn.Type)
      && String(idColumn.Extra).toLowerCase().includes('auto_increment');

    if (!isAutoIncrementInt) {
      await connection.query(`
        CREATE TABLE leads_new (
          id INT NOT NULL AUTO_INCREMENT,
          api_token VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          ftd_date DATETIME NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        )
      `);
      await connection.query(`
        INSERT INTO leads_new (api_token, status, ftd_date, created_at)
        SELECT api_token, status, ftd_date, created_at
        FROM leads
        ORDER BY created_at ASC
      `);
      await connection.query('DROP TABLE leads');
      await connection.query('RENAME TABLE leads_new TO leads');
    }
  } finally {
    connection.release();
  }
}

async function insertLead({ apiToken, status, ftdDate }) {
  const [result] = await getPool().execute(
    `INSERT INTO leads (api_token, status, ftd_date)
     VALUES (?, ?, ?)`,
    [apiToken, status, ftdDate]
  );

  return result.insertId;
}

async function fireFtd(id) {
  const [result] = await getPool().execute(
    `UPDATE leads
     SET status = 'FTD', ftd_date = NOW()
     WHERE id = ?`,
    [id]
  );

  return result;
}

function dateBound(value, endOfDay) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return endOfDay ? `${raw} 23:59:59` : `${raw} 00:00:00`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error('Invalid date');
    error.code = 'INVALID_DATE';
    throw error;
  }

  return parsed;
}

async function getLeads({ apiToken, perPage = 1000, startDate, endDate }) {
  const conditions = ['api_token = ?'];
  const params = [apiToken];

  const startBound = dateBound(startDate, false);
  if (startBound) {
    conditions.push('created_at >= ?');
    params.push(startBound);
  }

  const endBound = dateBound(endDate, true);
  if (endBound) {
    conditions.push('created_at <= ?');
    params.push(endBound);
  }

  const limit = Number.isInteger(perPage) && perPage > 0 ? perPage : 1000;

  const [rows] = await getPool().execute(
    `SELECT id, api_token, status, ftd_date, created_at
     FROM leads
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    params
  );

  return rows;
}

module.exports = {
  initDb,
  insertLead,
  getLeads,
  fireFtd,
};
