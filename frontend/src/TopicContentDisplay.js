import React from 'react';

/**
 * TopicContentDisplay - Renders custom HTML content for topics
 * Falls back to RAG sources if custom content isn't available
 */
export default function TopicContentDisplay({ topicId, ragSources, fallbackLinks, description, onViewDocument, handleViewDocument }) {
  // This would be imported from topicContent.json
  // For now, we'll show the structure - you can import it once you have it set up

  return (
    <div className="space-y-4">
      {/* Overview Section */}
      <div className="bg-gray-50 border-l-4 border-gray-300 p-4 rounded-r">
        <h3 className="text-md font-semibold text-gray-800 mb-2">Overview</h3>
        <p className="text-base text-gray-700 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Key Concepts Section */}
      <div>
        <h3 className="text-md font-semibold text-gray-800 mb-3">Key Concepts</h3>
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 text-gray-700">
          {/* This will render custom HTML content */}
          {/* Example: dangerouslySetInnerHTML would be used here with sanitized content */}
          <p className="text-sm italic text-gray-500">Custom content will display here</p>
        </div>
      </div>

      {/* Code Examples Section */}
      <div>
        <h3 className="text-md font-semibold text-gray-800 mb-3">Code Examples</h3>
        <div className="space-y-3">
          {/* Code examples will render here */}
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre>{`// Code example will display here`}</pre>
          </div>
        </div>
      </div>

      {/* Key Takeaways Section */}
      <div>
        <h3 className="text-md font-semibold text-gray-800 mb-3">Key Takeaways</h3>
        <ul className="space-y-2">
          <li className="flex items-start text-gray-700">
            <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Key takeaway items will display here</span>
          </li>
        </ul>
      </div>

      {/* Extended Materials - External Resources */}
      {(ragSources?.length > 0 || fallbackLinks?.length > 0) && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Extended Learning Materials
          </h3>
          <p className="text-sm text-gray-600 mb-3">Go deeper with these curated external resources:</p>
          
          {/* Show in a tab or separate section */}
          <div className="space-y-2">
            {/* RAG sources or fallback links will render here */}
            <p className="text-sm text-gray-500 italic">External resources available</p>
          </div>
        </div>
      )}
    </div>
  );
}
