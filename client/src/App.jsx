import { useState } from 'react';
import './App.css';

// Construct API URL - if VITE_API_URL is set, use it (should include full URL with /extract-isin)
// Otherwise default to localhost for development
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    // If it already includes /extract-isin, use as-is, otherwise append it
    return envUrl.endsWith('/extract-isin') ? envUrl : `${envUrl}/extract-isin`;
  }
  return 'http://localhost:4000/extract-isin';
};

const API_URL = getApiUrl();

function App() {
  const [pdfUrl, setPdfUrl] = useState('');
  const [isins, setIsins] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!pdfUrl.trim() || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(false);
    setIsins([]);
    setCount(0);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: pdfUrl.trim() }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const statusText = response.statusText || `HTTP ${response.status}`;
        throw new Error(
          errorPayload.error || `Failed to extract ISINs (${statusText})`
        );
      }

      const data = await response.json();
      setIsins(data.isins || []);
      setCount(data.count || 0);
      setHasSearched(true);
    } catch (err) {
      // Provide more helpful error messages
      let errorMessage = 'Something went wrong. Check the link or try a different PDF.';
      
      if (err?.message) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = 'Cannot connect to the server. Please check if the backend is running and the API URL is correct.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      console.error('ISIN extraction error:', err);
      console.error('API URL used:', API_URL);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Utilities / Finance</p>
        <h1>ISIN Extractor</h1>
        <p className="subtitle">
          Paste any publicly accessible PDF link and we will pull every ISIN
          code we can find.
        </p>
      </header>

      <main className="content">
        <form className="card form-card" onSubmit={handleSubmit}>
          <label htmlFor="pdf-url">PDF URL</label>
          <div className="input-row">
            <input
              id="pdf-url"
              type="url"
              placeholder="https://example.com/prospectus.pdf"
              value={pdfUrl}
              onChange={(event) => setPdfUrl(event.target.value)}
            />
            <button
              type="submit"
              disabled={!pdfUrl.trim() || loading}
            >
              {loading ? 'Extracting...' : 'Extract ISIN'}
            </button>
          </div>
          <p className="helper">
            Tip: Use a direct PDF link (ends in .pdf). Preview pages and protected PDFs won't work. 
            If needed, download the PDF and upload to Google Drive/Dropbox for a public link.
          </p>
        </form>

        {error && (
          <div className="alert error">
            {error || 'Something went wrong. Check the link or try a different PDF.'}
          </div>
        )}

        {hasSearched && !loading && !error && (
          <section className="card results-card">
            <div className="results-head">
              <div>
                <h2>Results</h2>
                <p>{count > 0 ? `Found ${count} ISIN code${count === 1 ? '' : 's'}.` : 'No ISIN codes found in this PDF.'}</p>
              </div>
              {count > 0 && (
                <span className="badge">{count}</span>
              )}
            </div>

            {count > 0 && (
              <ul className="isin-list">
                {isins.map((isin) => (
                  <li key={isin} className="isin-pill">
                    {isin}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
      
    </div>
  );
}

export default App;
