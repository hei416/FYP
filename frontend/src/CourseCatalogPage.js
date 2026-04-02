import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { JAVA_SUBTOPIC_COUNT } from './HomePage';
import { ENHANCED_SUBTOPIC_COUNT } from './EnhancedHomePage';
import { BASIC_ROADMAP_KEY, ENHANCED_ROADMAP_KEY, pullProgressFromBackend } from './progressService';

export default function CourseCatalogPage() {
  const navigate = useNavigate();

  const [basicCompleted, setBasicCompleted] = useState([]);
  const [enhancedCompleted, setEnhancedCompleted] = useState([]);

  // Load progress from localStorage (sync from backend if logged in)
  useEffect(() => {
    const load = () => {
      const b = JSON.parse(localStorage.getItem(BASIC_ROADMAP_KEY) || '[]');
      const e = JSON.parse(localStorage.getItem(ENHANCED_ROADMAP_KEY) || '[]');
      setBasicCompleted(b);
      setEnhancedCompleted(e);
    };

    load();

    // Attempt to refresh from backend (non-blocking)
    pullProgressFromBackend('basic').then(() => {
      load();
    }).catch(() => {});
    pullProgressFromBackend('enhanced').then(() => {
      load();
    }).catch(() => {});
  }, []);

  const basicPct = Math.round((basicCompleted.length / JAVA_SUBTOPIC_COUNT) * 100);
  const enhancedPct = Math.round((enhancedCompleted.length / ENHANCED_SUBTOPIC_COUNT) * 100);

  const courses = [
    {
      id: 'basic',
      title: 'Basic Java',
      emoji: '☕',
      badge: 'Foundation',
      badgeColor: 'bg-yellow-100 text-yellow-800',
      description: 'Start your Java journey from the ground up. Covers syntax, OOP fundamentals, collections, exception handling, and more — building a solid foundation for every Java developer.',
      topics: JAVA_SUBTOPIC_COUNT,
      completed: basicCompleted.length,
      pct: basicPct,
      progressColor: 'from-yellow-400 to-amber-500',
      borderColor: 'border-amber-300',
      hoverBorder: 'hover:border-amber-500',
      headerGradient: 'from-amber-500 to-yellow-600',
      btnColor: 'bg-amber-500 hover:bg-amber-600',
      route: '/home',
      highlights: [
        '12 topic groups → 52 subtopics',
        'Bridging Python → Java',
        'OOP: Classes, Inheritance, Polymorphism',
        'Interfaces, Lambda, Recursion',
      ],
    },
    {
      id: 'enhanced',
      title: 'Enhanced Java',
      emoji: '🚀',
      badge: 'Advanced',
      badgeColor: 'bg-green-100 text-green-800',
      description: 'Level up with advanced Java topics. Covers Generics, Collections, Streams, Concurrency, Data Structures, Algorithms, and design robustness — everything needed for professional Java development.',
      topics: ENHANCED_SUBTOPIC_COUNT,
      completed: enhancedCompleted.length,
      pct: enhancedPct,
      progressColor: 'from-emerald-400 to-green-600',
      borderColor: 'border-green-300',
      hoverBorder: 'hover:border-green-500',
      headerGradient: 'from-green-600 to-emerald-700',
      btnColor: 'bg-green-600 hover:bg-green-700',
      route: '/enhanced-java',
      highlights: [
        '8 topic groups → 26 subtopics',
        'Advanced OOP & Generics',
        'Collections, Streams & Concurrency',
        'Data Structures & Algorithms',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-600 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold mb-3 tracking-tight">
            Java Learning Courses
          </h1>
          <p className="text-indigo-100 text-lg max-w-xl mx-auto">
            Choose your learning path. Start with the foundations or dive straight into advanced topics.
          </p>
        </div>
      </div>

      {/* Course Cards */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {courses.map(course => (
            <div
              key={course.id}
              className={`bg-white rounded-2xl shadow-md border-2 ${course.borderColor} ${course.hoverBorder} transition-all duration-200 overflow-hidden cursor-pointer group`}
              onClick={() => navigate(course.route)}
            >
              {/* Card Header */}
              <div className={`bg-gradient-to-r ${course.headerGradient} p-6 text-white`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-4xl">{course.emoji}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${course.badgeColor}`}>
                    {course.badge}
                  </span>
                </div>
                <h2 className="text-2xl font-bold">{course.title}</h2>
                <p className="text-white/80 text-sm mt-1">{course.topics} subtopics across multiple chapters</p>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{course.description}</p>

                {/* Highlights */}
                <ul className="space-y-1 mb-5">
                  {course.highlights.map((h, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-700">
                      <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {h}
                    </li>
                  ))}
                </ul>

                {/* Progress Bar */}
                <div className="mb-5">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">Progress</span>
                    <span className="font-bold text-gray-800">{course.completed} / {course.topics}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`bg-gradient-to-r ${course.progressColor} h-2.5 rounded-full transition-all duration-700`}
                      style={{ width: `${course.pct}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-500 mt-0.5">{course.pct}% complete</div>
                </div>

                {/* CTA Button */}
                <button
                  className={`w-full ${course.btnColor} text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 group-hover:shadow-md`}
                  onClick={(e) => { e.stopPropagation(); navigate(course.route); }}
                >
                  {course.pct === 0 ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Start Course
                    </>
                  ) : course.pct === 100 ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Review Course
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Continue Learning
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Overall Progress Summary */}
        <div className="mt-10 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Overall Learning Progress</h3>
          <div className="grid grid-cols-2 gap-6">
            {courses.map(course => (
              <div key={course.id} className="text-center">
                <div className="text-3xl font-extrabold text-gray-800 mb-1">
                  {course.pct}<span className="text-lg font-semibold text-gray-500">%</span>
                </div>
                <div className="text-sm text-gray-600">{course.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{course.completed} of {course.topics} subtopics</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
