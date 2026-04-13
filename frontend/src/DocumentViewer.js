import React, { useState, useEffect, useCallback } from 'react';

export default function DocumentViewer({ isOpen, onClose, documentFile, documentSource }) {
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('text'); // 'text' or 'web'
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

  const fetchDocumentContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    setContent('');
    setMetadata(null);

    try {
      const response = await fetch(`${API_BASE}/api/document/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: documentFile,
          source: documentSource
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch document');
      }

      setContent(data.content);
      setMetadata(data.metadata);
    } catch (err) {
      console.error('Error fetching document:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [documentFile, documentSource]);

  useEffect(() => {
    if (isOpen && documentFile) {
      fetchDocumentContent();
    }
  }, [isOpen, documentFile, fetchDocumentContent]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={onClose}
    >
        <div 
          className="bg-white rounded-lg shadow-2xl w-[90vw] h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '1600px' }} 
        >

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {metadata?.title || documentFile}
            </h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
              <span className="flex items-center">
                📁 <span className="ml-1 font-semibold">{documentSource}</span>
              </span>
              {metadata?.source_name && (
                <span className="flex items-center">
                  📚 <span className="ml-1">{metadata.source_name}</span>
                </span>
              )}
            </div>
            
            {/* View Mode Toggle */}
            {metadata?.url && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setViewMode('text')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === 'text' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📄 Text View
                </button>
                <button
                  onClick={() => setViewMode('web')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    viewMode === 'web' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  🌐 Web View
                </button>
                <a 
                  href={metadata.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center"
                >
                  🔗 Open in New Tab
                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-md p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <span className="text-gray-600 mt-4">Loading document...</span>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm text-red-700 font-semibold">Error loading document</p>
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}


{!loading && !error && viewMode === 'web' && metadata?.url && (
            <div className="h-full overflow-hidden">
                <iframe
                src={`${API_BASE}/api/proxy/webpage?url=${encodeURIComponent(metadata.url)}`}
                className="w-full h-full border-0"
                title={metadata.title || documentFile}
                sandbox="allow-same-origin allow-scripts allow-popups"
                />
            </div>
)}


          {!loading && !error && viewMode === 'text' && content && (
            <div className="h-full overflow-y-auto p-6">
              <div className="prose max-w-none">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border-2 border-gray-200 overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-r from-indigo-100 to-purple-100 px-4 py-3 border-b-2 border-indigo-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-indigo-800 bg-white px-2 py-1 rounded">
                          📄 Text Content
                        </span>
                        <span className="text-xs text-indigo-700">
                          {content.length.toLocaleString()} characters
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(content);
                          alert('Content copied to clipboard!');
                        }}
                        className="text-xs bg-white hover:bg-indigo-50 text-indigo-700 px-3 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-white">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                      {content}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            {!loading && !error && (
              <span>
                {viewMode === 'web' ? '🌐 Live website view' : '📄 Text content view'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
