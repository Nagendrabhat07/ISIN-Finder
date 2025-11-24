require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration - allow frontend origin from env or all origins in dev
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));

// Matches ISO 6166 ISIN codes: two letters, nine alphanumerics, one digit.
const ISIN_REGEX = /\b[A-Z]{2}[A-Z0-9]{9}\d\b/g;

// Root route - API info
app.get('/', (_req, res) => {
  res.json({
    name: 'ISIN Extractor API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      extractIsin: 'POST /extract-isin',
    },
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/extract-isin', async (req, res) => {
  const { pdfUrl } = req.body || {};

  if (!pdfUrl || typeof pdfUrl !== 'string' || !pdfUrl.trim()) {
    return res.status(400).json({ error: 'pdfUrl is required' });
  }

  try {
    const trimmedUrl = pdfUrl.trim();
    const response = await axios.get(trimmedUrl, { responseType: 'arraybuffer' });
    const pdfBuffer = Buffer.from(response.data);
    const parsed = await pdfParse(pdfBuffer);
    const rawText = parsed.text || '';
    const normalizedText = rawText.replace(/\s+/g, ' ');
    const matches = normalizedText.match(ISIN_REGEX) || [];
    const uniqueIsins = [...new Set(matches)];

    res.json({
      pdfUrl: trimmedUrl,
      isins: uniqueIsins,
      count: uniqueIsins.length,
    });
  } catch (error) {
    console.error('Failed to process the PDF:', error.message);
    res.status(500).json({ error: 'Failed to process the PDF' });
  }
});

app.listen(PORT, () => {
  console.log(`ISIN Extractor server listening on port ${PORT}`);
});


