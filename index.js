require('dotenv').config();
const express = require('express');
const { initDb, insertLead, getLeads, fireFtd } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

const LEAD_STATUSES = ['New', 'No Answer', 'Not Interested'];

app.use(express.json());

function randomStatus(statuses) {
  return statuses[Math.floor(Math.random() * statuses.length)];
}

app.post('/v1/dummy/leads', async (req, res) => {
  const apiToken = req.body?.api_token;

  if (!apiToken || typeof apiToken !== 'string') {
    return res.status(400).json({ message: 'api_token is required' });
  }

  const statuses = Array.isArray(req.body.status) && req.body.status.length
    ? req.body.status
    : LEAD_STATUSES;

  const status = randomStatus(statuses);

  try {
    const id = await insertLead({
      apiToken,
      status,
      ftdDate: null,
    });

    res.status(201).json({
      id,
      message: 'Created successfully',
      auto_login_url: `${APP_URL}/${id}`,
    });
  } catch (error) {
    console.error('Failed to store lead:', error);
    return res.status(500).json({ message: 'Failed to store lead' });
  }
});

app.get('/v1/dummy/leads', async (req, res) => {
  const apiToken = req.query.api_token;

  if (!apiToken || typeof apiToken !== 'string') {
    return res.status(400).json({ message: 'api_token is required' });
  }

  const perPage = req.query.per_page === undefined
    ? 1000
    : Number.parseInt(req.query.per_page, 10);

  if (!Number.isInteger(perPage) || perPage < 1) {
    return res.status(400).json({ message: 'per_page must be a positive integer' });
  }

  try {
    const leads = await getLeads({
      apiToken,
      perPage,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    });

    res.status(200).json(leads);
  } catch (error) {
    if (error.code === 'INVALID_DATE') {
      return res.status(400).json({ message: 'start_date and end_date must be valid dates' });
    }

    console.error('Failed to fetch leads:', error);
    return res.status(500).json({ message: 'Failed to fetch leads' });
  }
});

app.post('/migrate', async (req, res) => {
  try {
    await initDb();
    res.status(200).json({ message: 'Database migrated successfully' });
  } catch (error) {
    console.error('Failed to migrate database:', error);
    res.status(500).json({ message: 'Failed to migrate database' });
  }
});

app.post('/fire-ftd', async (req, res) => {
  const leadId = Number.parseInt(req.body?.id, 10);

  if (!Number.isInteger(leadId) || leadId < 1) {
    return res.status(400).json({ message: 'id is required' });
  }

  try {
    const result = await fireFtd(leadId);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    res.status(200).json({ message: 'FTD fired successfully' });
  } catch (error) {
    console.error('Failed to fire FTD:', error);
    res.status(500).json({ message: 'Failed to fire FTD' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
