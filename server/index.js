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
// Enhanced regex that doesn't rely on word boundaries to catch codes with special chars nearby
const ISIN_REGEX = /[A-Z]{2}[A-Z0-9]{9}\d/g;

/**
 * Extract ISIN codes from text, handling various formatting issues in PDFs
 * - Handles codes split across lines or with spaces
 * - Removes all whitespace before matching to catch split codes
 * - Validates that extracted codes match ISIN format
 */
function extractIsins(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // First, try matching in normalized text (spaces normalized to single space)
  const normalized = text.replace(/\s+/g, ' ');
  let matches = normalized.match(ISIN_REGEX) || [];

  // Also try matching in text with all whitespace removed (catches split codes)
  const noWhitespace = text.replace(/\s+/g, '');
  const matchesNoSpace = noWhitespace.match(ISIN_REGEX) || [];

  // Combine both approaches
  const allMatches = [...matches, ...matchesNoSpace];

  // Validate ISIN format and get unique codes
  const validIsins = new Set();
  for (const match of allMatches) {
    // ISIN must be exactly 12 characters: 2 letters + 9 alphanumeric + 1 digit
    if (match.length === 12) {
      // First 2 must be letters
      if (/^[A-Z]{2}/.test(match)) {
        // Last character must be a digit
        if (/\d$/.test(match)) {
          // Middle 9 must be alphanumeric
          if (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(match)) {
            validIsins.add(match);
          }
        }
      }
    }
  }

  return Array.from(validIsins).sort();
}

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
    console.log(`Processing PDF: ${trimmedUrl}`);
    
    const response = await axios.get(trimmedUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,application/octet-stream,*/*'
      },
      maxRedirects: 5
    });
    
    // Check if we got a PDF (PDF files start with %PDF)
    const buffer = Buffer.from(response.data);
    const fileHeader = buffer.slice(0, 4).toString();
    
    if (!fileHeader.startsWith('%PDF')) {
      console.error('Response is not a PDF. Content-Type:', response.headers['content-type']);
      return res.status(400).json({ 
        error: 'The URL does not point to a valid PDF file. Please provide a direct PDF link.' 
      });
    }
    
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text || '';
    
    console.log(`Extracted ${rawText.length} characters from PDF`);
    
    // Extract ISINs using improved function
    const isins = extractIsins(rawText);
    
    console.log(`Found ${isins.length} unique ISIN codes`);

    res.json({
      pdfUrl: trimmedUrl,
      isins: isins,
      count: isins.length,
    });
  } catch (error) {
    console.error('Failed to process the PDF:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to process the PDF' });
  }
});

app.listen(PORT, () => {
  console.log(`ISIN Extractor server listening on port ${PORT}`);
});


