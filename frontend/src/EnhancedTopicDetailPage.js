import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ENHANCED_TOPIC_GROUPS } from './EnhancedJavaPage';
import { enhancedRagDocMapping } from './enhancedRagDocMapping';
import { getSourceColor, formatSourceName } from './ragDocMapping';
import DocumentViewer from './DocumentViewer';

const GROUP_QUIZ_TOPICS = [
    "Advanced OOP",
    "Collections Framework",
    "Streams & Functional",
    "Exception & I/O",
    "Concurrency",
    "Data Structures",
    "Algorithms",
    "Advanced Patterns",
];

export default function EnhancedTopicDetailPage() {
    const { topicId } = useParams();
    const navigate = useNavigate();
    const [viewingDocument, setViewingDocument] = useState(null);
    const [showMilestoneModal, setShowMilestoneModal] = useState(false);
    const [milestoneTopics, setMilestoneTopics] = useState([]);
    const [topicContent, setTopicContent] = useState(null);
    const [contentLoading, setContentLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setContentLoading(true);
        import('./enhancedTopicContent.json').then(mod => {
            if (!cancelled) {
                setTopicContent(mod.default || mod);
                setContentLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, []);

    const [completedTopics, setCompletedTopics] = useState(() => {
        const saved = localStorage.getItem('enhanced-roadmap-completed');
        return saved ? JSON.parse(saved) : [];
    });

    const orderedTopicIds = ENHANCED_TOPIC_GROUPS.flatMap(group => group.subtopics);
    const currentIndex = orderedTopicIds.indexOf(topicId);
    const previousTopicId = currentIndex > 0 ? orderedTopicIds[currentIndex - 1] : null;
    const nextTopicId = currentIndex < orderedTopicIds.length - 1 ? orderedTopicIds[currentIndex + 1] : null;

    const currentGroupIndex = ENHANCED_TOPIC_GROUPS.findIndex(g => g.subtopics.includes(topicId));
    const currentGroup = ENHANCED_TOPIC_GROUPS[currentGroupIndex];
    const isLastTopicOfGroup = currentGroup &&
        currentGroup.subtopics[currentGroup.subtopics.length - 1] === topicId;
    const isMilestoneGroup = currentGroupIndex >= 1 && (currentGroupIndex + 1) % 2 === 0;

    const isCompleted = completedTopics.includes(topicId);
    const content = topicContent ? topicContent[topicId] : null;
    const ragContent = enhancedRagDocMapping[topicId];

    if (contentLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>🚀</div>
                    <p className="text-gray-500">Loading topic…</p>
                </div>
            </div>
        );
    }

    const handleViewDocument = (file, source) => setViewingDocument({ file, source });
    const closeDocumentViewer = () => setViewingDocument(null);

    const toggleCompletion = () => {
        setCompletedTopics((prev) => {
            let updated;
            const markingComplete = !prev.includes(topicId);
            if (prev.includes(topicId)) {
                updated = prev.filter((id) => id !== topicId);
            } else {
                updated = [...prev, topicId];
            }
            localStorage.setItem('enhanced-roadmap-completed', JSON.stringify(updated));

            if (markingComplete && isLastTopicOfGroup && isMilestoneGroup) {
                const topics = [
                    GROUP_QUIZ_TOPICS[currentGroupIndex - 1],
                    GROUP_QUIZ_TOPICS[currentGroupIndex],
                ];
                setMilestoneTopics(topics);
                setShowMilestoneModal(true);
            }
            return updated;
        });
    };

    const navigateToPrevious = () => {
        if (previousTopicId) {
            navigate(`/enhanced-topic/${previousTopicId}`);
            window.scrollTo(0, 0);
        }
    };

    const navigateToNext = () => {
        if (nextTopicId) {
            navigate(`/enhanced-topic/${nextTopicId}`);
            window.scrollTo(0, 0);
        }
    };

    if (!content) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="text-center">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Topic Not Found</h1>
                    <p className="text-gray-600 mb-6">The learning material for this topic is not available yet.</p>
                    <button
                        onClick={() => navigate('/enhanced-java')}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors inline-flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Enhanced Roadmap
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => navigate('/enhanced-java')}
                            className="flex items-center text-green-600 hover:text-green-700 font-medium transition-colors"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Enhanced Roadmap
                        </button>

                        {currentGroup && (
                            <div className="text-center text-sm">
                                <span className="text-gray-600">Topic {currentIndex + 1} of {orderedTopicIds.length}</span>
                                <p className="text-gray-800 font-semibold text-xs">{currentGroup.label}</p>
                            </div>
                        )}

                        <button
                            onClick={toggleCompletion}
                            className={`font-medium py-2 px-4 rounded-lg transition-colors flex items-center text-sm ${
                                isCompleted
                                    ? 'bg-green-100 hover:bg-green-200 text-green-800'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                            {isCompleted ? (
                                <>
                                    <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Completed
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Mark Complete
                                </>
                            )}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded">🚀 Enhanced Java</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">{content.title}</h1>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Overview */}
                <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-r-lg mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Overview</h2>
                    <p className="text-gray-700 leading-relaxed text-lg">{content.overview}</p>
                </div>

                {/* Key Concepts */}
                <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Key Concepts</h2>
                    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6 text-gray-700">
                        <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: content.keyConceptsHtml }}
                        />
                    </div>
                </div>

                {/* Code Examples */}
                {content.codeExamples && content.codeExamples.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Code Examples</h2>
                        <div className="space-y-6">
                            {content.codeExamples.map((example, idx) => (
                                <div key={idx}>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">{example.title}</h3>
                                    {example.code && (
                                        <div>
                                            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-gray-700">
                                                <pre className="whitespace-pre-wrap break-words">{example.code}</pre>
                                            </div>
                                            <button
                                                onClick={() => navigate('/playground', { state: { code: example.code, fromTopic: topicId } })}
                                                className="mt-3 inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                                            >
                                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Try in Playground
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Key Takeaways */}
                {content.keyTakeaways && content.keyTakeaways.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Key Takeaways</h2>
                        <ul className="space-y-3">
                            {content.keyTakeaways.map((takeaway, idx) => (
                                <li key={idx} className="flex items-start text-gray-700">
                                    <svg className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-lg">{takeaway}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* External Resources */}
                {content.externalResources && content.externalResources.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Learning Resources
                        </h2>
                        <div className="space-y-3">
                            {content.externalResources.map((resource, idx) => (
                                <a
                                    key={idx}
                                    href={resource.url || resource.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start p-4 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-left"
                                >
                                    <div className="flex-shrink-0 mr-3 mt-0.5">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-base font-medium text-green-600 hover:text-green-700 break-words">{resource.title}</div>
                                        <p className="text-xs text-gray-500 mt-1 truncate">{resource.url || resource.href}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* RAG Document Resources */}
                {ragContent?.sources?.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            Supporting Materials
                        </h2>
                        <div className="space-y-3">
                            {ragContent.sources.map((source, idx) => {
                                const colors = getSourceColor(source.source);
                                const sourceName = formatSourceName(source.source);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleViewDocument(source.file, source.source)}
                                        className="w-full flex items-start p-4 rounded-lg border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all text-left"
                                    >
                                        <div className="flex-shrink-0 mr-3 mt-0.5">
                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-base font-medium text-gray-900 hover:text-green-700 break-words">{source.file}</div>
                                            <span
                                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium mt-1"
                                                style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                                            >
                                                {sourceName}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Footer */}
            <div className="bg-white border-t border-gray-200 sticky bottom-0">
                <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between gap-4">
                        {previousTopicId ? (
                            <button
                                onClick={navigateToPrevious}
                                className="flex items-center px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium transition-colors"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Previous
                            </button>
                        ) : <div />}

                        <button
                            onClick={toggleCompletion}
                            className={`font-medium py-2 px-6 rounded-lg transition-colors flex items-center ${
                                isCompleted
                                    ? 'bg-green-100 hover:bg-green-200 text-green-800'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                            {isCompleted ? (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    ✓ Completed
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Mark Complete
                                </>
                            )}
                        </button>

                        {nextTopicId ? (
                            <button
                                onClick={navigateToNext}
                                className="flex items-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                            >
                                Next
                                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        ) : (
                            <div className="text-center">
                                <span className="text-green-700 font-medium text-sm">🎓 All Enhanced Java topics completed!</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <DocumentViewer
                isOpen={viewingDocument !== null}
                onClose={closeDocumentViewer}
                documentFile={viewingDocument?.file}
                documentSource={viewingDocument?.source}
            />

            {showMilestoneModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
                        <div className="text-5xl mb-4">🎉</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Great Progress!</h2>
                        <p className="text-gray-600 mb-2">You've completed two chapters:</p>
                        <div className="flex flex-col gap-2 mb-6">
                            {milestoneTopics.map((t, i) => (
                                <span key={i} className="inline-flex items-center justify-center gap-2 bg-green-50 text-green-700 font-semibold py-2 px-4 rounded-lg text-sm">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    {t}
                                </span>
                            ))}
                        </div>
                        <p className="text-gray-600 mb-6 text-sm">Now's a great time to test your understanding!</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => { setShowMilestoneModal(false); navigate('/exercises', { state: { preSelectedTopics: milestoneTopics } }); }}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                            >
                                Take Quiz
                            </button>
                            <button
                                onClick={() => { setShowMilestoneModal(false); navigate('/coding-challenges'); }}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                            >
                                Take Practical Test
                            </button>
                            <button
                                onClick={() => setShowMilestoneModal(false)}
                                className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 px-6 rounded-xl transition-colors text-sm"
                            >
                                Continue Learning
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
