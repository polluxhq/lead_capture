require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

app.use(express.json());

function randomHex(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

app.post('/v1/dummy/leads', (req, res) => {
  const id = randomHex(8);
  // const token = randomHex(32);

  res.status(201).json({
    id,
    message: 'Created successfully',
    auto_login_url: `${APP_URL}/${id}`,
  });
});

app.get('/v1/dummy/leads', (req, res) => {
  res.status(200).json([]);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
