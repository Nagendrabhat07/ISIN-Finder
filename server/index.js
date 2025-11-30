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

// Debug endpoint to test URL access
app.post('/test-url', async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on any status
    });

    const buffer = Buffer.from(response.data);
    const fileHeader = buffer.slice(0, 100).toString();
    const contentType = response.headers['content-type'] || 'unknown';

    return res.json({
      status: response.status,
      contentType,
      contentLength: buffer.length,
      isPdf: fileHeader.startsWith('%PDF'),
      headerPreview: fileHeader.substring(0, 200),
      redirects: response.request.res?.responseUrl !== url,
      finalUrl: response.request.res?.responseUrl || url,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      code: error.code,
    });
  }
});

async function fetchPdf(url, depth = 0) {
  // Prevent infinite recursion
  if (depth > 2) {
    throw new Error('Maximum redirect depth exceeded');
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/pdf,application/octet-stream,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': url,
  };

  // Try multiple approaches to get the PDF
  const attempts = [
    // Try direct access with PDF preference
    { url, headers: { ...headers, 'Accept': 'application/pdf' } },
    // Try direct access with generic headers
    { url, headers },
  ];

  // If it's a Credit Agricole preview URL, try the direct PDF endpoint
  if (url.includes('credit-agricole.com') && url.includes('/pdfPreview/')) {
    const match = url.match(/\/pdfPreview\/(\d+)/);
    if (match) {
      attempts.push({
        url: `https://www.credit-agricole.com/content/dam/cacorp/pdf/en/${match[1]}.pdf`,
        headers: { ...headers, 'Accept': 'application/pdf' }
      });
    }
  }

  for (const attempt of attempts) {
    try {
      console.log(`Trying to fetch (depth ${depth}): ${attempt.url}`);
      const response = await axios.get(attempt.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: attempt.headers,
        maxRedirects: 10,
        validateStatus: (status) => status < 500,
      });

      const buffer = Buffer.from(response.data);
      const fileHeader = buffer.slice(0, 4).toString();
      const contentType = response.headers['content-type'] || '';

      // Check if we got a PDF
      if (fileHeader.startsWith('%PDF') || contentType.includes('application/pdf')) {
        console.log('Successfully retrieved PDF');
        return buffer;
      }

      // If we got HTML on first attempt, try to extract PDF URL
      if (depth === 0 && (contentType.includes('text/html') || fileHeader.startsWith('<!') || fileHeader.startsWith('<html'))) {
        const html = buffer.toString('utf-8');
        // Look for PDF links in HTML - various patterns
        const pdfLinkPatterns = [
          /href=["']([^"']*\.pdf[^"']*)["']/i,
          /src=["']([^"']*\.pdf[^"']*)["']/i,
          /url\(["']?([^"')]*\.pdf[^"')]*)["']?\)/i,
          /["']([^"']*\/pdf\/[^"']*)["']/i,
          /["']([^"']*\/file\/[^"']*\.pdf[^"']*)["']/i,
        ];

        for (const pattern of pdfLinkPatterns) {
          const match = html.match(pattern);
          if (match) {
            let pdfLink = match[1];
            // Make absolute URL if relative
            try {
              const baseUrl = new URL(attempt.url);
              if (pdfLink.startsWith('/')) {
                pdfLink = `${baseUrl.origin}${pdfLink}`;
              } else if (!pdfLink.startsWith('http')) {
                pdfLink = `${baseUrl.origin}${baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/'))}/${pdfLink}`;
              }
              console.log(`Found PDF link in HTML: ${pdfLink}`);
              // Try the found PDF link
              if (pdfLink !== attempt.url) {
                return await fetchPdf(pdfLink, depth + 1);
              }
            } catch (urlError) {
              console.log('Error parsing PDF URL from HTML:', urlError.message);
            }
          }
        }
      }
    } catch (error) {
      console.log(`Attempt failed: ${error.message}`);
      continue;
    }
  }

  throw new Error('Could not retrieve PDF from the provided URL');
}

app.post('/extract-isin', async (req, res) => {
  const { pdfUrl, debug } = req.body || {};

  if (!pdfUrl || typeof pdfUrl !== 'string' || !pdfUrl.trim()) {
    return res.status(400).json({ error: 'pdfUrl is required' });
  }

  try {
    const trimmedUrl = pdfUrl.trim();
    console.log(`Processing PDF: ${trimmedUrl}`);
    
    // Fetch PDF with multiple strategies
    let pdfBuffer;
    try {
      pdfBuffer = await fetchPdf(trimmedUrl);
    } catch (fetchError) {
      console.error('PDF fetch error:', fetchError.message);
      
      // If it's a Credit Agricole URL, try additional patterns
      if (trimmedUrl.includes('credit-agricole.com') && trimmedUrl.includes('/pdfPreview/')) {
        const match = trimmedUrl.match(/\/pdfPreview\/(\d+)/);
        if (match) {
          const id = match[1];
          const alternativeUrls = [
            `https://www.credit-agricole.com/content/dam/cacorp/pdf/en/${id}.pdf`,
            `https://www.credit-agricole.com/content/dam/cacorp/pdf/fr/${id}.pdf`,
            `https://www.credit-agricole.com/content/dam/cacorp/pdf/${id}.pdf`,
            `https://www.credit-agricole.com/pdf/${id}.pdf`,
          ];
          
          console.log('Trying alternative Credit Agricole PDF URLs...');
          for (const altUrl of alternativeUrls) {
            try {
              console.log(`Trying: ${altUrl}`);
              const response = await axios.get(altUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'application/pdf',
                },
              });
              const buffer = Buffer.from(response.data);
              if (buffer.slice(0, 4).toString().startsWith('%PDF')) {
                console.log(`Success with alternative URL: ${altUrl}`);
                pdfBuffer = buffer;
                break;
              }
            } catch (altError) {
              console.log(`Alternative URL failed: ${altError.message}`);
              continue;
            }
          }
        }
      }
      
      if (!pdfBuffer) {
        throw fetchError;
      }
    }
    
    const parsed = await pdfParse(pdfBuffer);
    const rawText = parsed.text || '';
    
    console.log(`Extracted ${rawText.length} characters from PDF`);
    
    // Log a sample of extracted text for debugging
    if (rawText.length > 0) {
      const sample = rawText.substring(0, 1000);
      console.log('Sample of extracted text (first 1000 chars):', sample);
      
      // Look for any patterns that might be ISIN-like
      const potentialIsins = rawText.match(/[A-Z]{2}[A-Z0-9]{9,11}/g) || [];
      if (potentialIsins.length > 0) {
        console.log(`Found ${potentialIsins.length} potential ISIN-like patterns:`, potentialIsins.slice(0, 20).join(', '));
      }
    } else {
      console.warn('No text extracted from PDF! PDF might be image-based or empty.');
      return res.status(400).json({ 
        error: 'No text could be extracted from this PDF. The PDF might be image-based or the text might not be extractable.',
        debug: debug ? { extractedLength: 0 } : undefined
      });
    }
    
    // Extract ISINs using improved function
    const isins = extractIsins(rawText);
    
    console.log(`Found ${isins.length} unique ISIN codes`);
    if (isins.length > 0) {
      console.log('ISINs found:', isins.slice(0, 20).join(', '));
    } else {
      console.warn('No ISIN codes found in extracted text');
      // Try to find patterns that might be ISINs but didn't match
      const allCaps = rawText.match(/[A-Z]{2}[A-Z0-9]+/g) || [];
      if (allCaps.length > 0) {
        console.log('Found other uppercase patterns (might be partial ISINs):', allCaps.slice(0, 30).join(', '));
      }
    }

    const response = {
      pdfUrl: trimmedUrl,
      isins: isins,
      count: isins.length,
    };

    // Include debug info if requested
    if (debug) {
      response.debug = {
        textLength: rawText.length,
        textSample: rawText.substring(0, 500),
        pages: parsed.numpages,
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to process the PDF:', error.message);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Failed to process the PDF';
    let statusCode = 500;
    
    if (error.message.includes('Could not retrieve PDF') || error.message.includes('retrieve')) {
      errorMessage = 'Could not retrieve PDF from the provided URL. The URL might require authentication, be blocked, or the PDF might not be accessible. Try downloading the PDF and hosting it on a public service like Google Drive or Dropbox.';
      statusCode = 400;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timed out. The PDF file might be too large or the server is slow to respond.';
      statusCode = 408;
    } else if (error.response) {
      errorMessage = `Server returned error: ${error.response.status} ${error.response.statusText}`;
      statusCode = error.response.status;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      debug: debug ? { originalError: error.message } : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`ISIN Extractor server listening on port ${PORT}`);
});


