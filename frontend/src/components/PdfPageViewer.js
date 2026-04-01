import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

const btnStyle = (disabled) => ({
    backgroundColor: disabled ? '#d1d5db' : '#4f46e5',
    color: disabled ? '#9ca3af' : '#fff',
    border: 'none',
    padding: '6px 14px',
    borderRadius: 6,
    cursor: disabled ? 'default' : 'pointer',
    fontWeight: 600,
    fontSize: 13,
});

export default function PdfPageViewer({ url, initialPage = 1, height = 600 }) {
    const [numPages, setNumPages] = useState(null);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [error, setError] = useState(null);

    const onLoadSuccess = useCallback(({ numPages: total }) => {
        setNumPages(total);
        // Clamp initialPage to valid range
        if (initialPage > total) setCurrentPage(total);
    }, [initialPage]);

    const onLoadError = useCallback((err) => {
        console.error('[PdfPageViewer] Load error:', err);
        setError('Failed to load PDF');
    }, []);

    if (error) {
        return (
            <div style={{ padding: 20, textAlign: 'center', color: '#dc2626' }}>
                {error}
            </div>
        );
    }

    return (
        <div>
            {/* Navigation bar */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', backgroundColor: '#e5e7eb', borderRadius: '6px 6px 0 0',
            }}>
                <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    style={btnStyle(currentPage <= 1)}
                >
                    ◄ Prev
                </button>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
                    Page {currentPage} of {numPages || '…'}
                </span>
                <button
                    disabled={!numPages || currentPage >= numPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    style={btnStyle(!numPages || currentPage >= numPages)}
                >
                    Next ►
                </button>
            </div>

            {/* PDF page */}
            <div style={{
                height, overflowY: 'auto', border: '1px solid #d1d5db',
                borderRadius: '0 0 6px 6px', backgroundColor: '#f9fafb',
                display: 'flex', justifyContent: 'center',
            }}>
                <Document
                    file={url}
                    onLoadSuccess={onLoadSuccess}
                    onLoadError={onLoadError}
                    loading={
                        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                            Loading PDF…
                        </div>
                    }
                >
                    <Page
                        pageNumber={currentPage}
                        width={700}
                        loading={
                            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                                Rendering page…
                            </div>
                        }
                    />
                </Document>
            </div>
        </div>
    );
}
