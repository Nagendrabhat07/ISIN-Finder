import { useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/extract-isin';

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
        throw new Error(errorPayload.error || 'Failed to extract ISINs');
      }

      const data = await response.json();
      setIsins(data.isins || []);
      setCount(data.count || 0);
      setHasSearched(true);
    } catch (err) {
      setError(
        err?.message ||
          'Something went wrong. Check the link or try a different PDF.'
      );
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
            Tip: Make sure the link is publicly accessible so the server can
            download the PDF.
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
