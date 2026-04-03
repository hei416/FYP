import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { JAVA_SUBTOPIC_COUNT } from './BasicJavaPage';
import { ENHANCED_SUBTOPIC_COUNT } from './EnhancedJavaPage';
import { BASIC_ROADMAP_KEY, ENHANCED_ROADMAP_KEY, pullProgressFromBackend } from './progressService';
import { getPublicClassrooms, joinClassroom } from './classroomService';

export default function CourseCatalogPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [basicCompleted, setBasicCompleted] = useState([]);
  const [enhancedCompleted, setEnhancedCompleted] = useState([]);
  const [publicClasses, setPublicClasses] = useState([]);
  const [publicSearch, setPublicSearch] = useState('');
  const [classTab, setClassTab] = useState('latest');
  const [joiningId, setJoiningId] = useState(null);
  const [joinMsg, setJoinMsg] = useState('');

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

  useEffect(() => {
    getPublicClassrooms().then(setPublicClasses).catch(() => {});
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
      route: '/basic-java',
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Header - Modern Design */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 text-white py-20 px-4">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/5 blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-blue-400/5 blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto text-center">
          <div className="inline-block mb-4 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
            <span className="text-sm font-semibold text-blue-100">🎓 Master Java Development</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight leading-tight">
            Your Java Learning<br />Journey Starts Here
          </h1>
          <p className="text-lg md:text-xl text-indigo-100 max-w-2xl mx-auto leading-relaxed">
            Choose your path and start mastering Java. From foundations to advanced techniques, we've got everything you need to become a professional developer.
          </p>
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col lg:flex-row gap-12 items-start">

        {/* LEFT: Courses + Progress */}
        <div className="w-full lg:w-[56%] flex-shrink-0">
          {/* Section label */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-3">Learning Paths</h2>
            <h3 className="text-3xl font-black text-white">Choose Your Course</h3>
          </div>

        {/* Course Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {courses.map(course => (
            <div
              key={course.id}
              className={`group relative bg-gradient-to-br backdrop-blur-xl border transition-all duration-300 overflow-hidden cursor-pointer rounded-2xl hover:shadow-2xl hover:-translate-y-2 ${course.id === 'basic' 
                ? 'from-amber-500/10 to-yellow-600/10 border-amber-400/30 hover:border-amber-400/60' 
                : 'from-emerald-500/10 to-green-600/10 border-emerald-400/30 hover:border-emerald-400/60'
              }`}
              onClick={() => navigate(course.route)}
            >
              {/* Animated gradient overlay on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className={`absolute inset-0 bg-gradient-to-br ${course.headerGradient} opacity-5`}></div>
              </div>

              {/* Card Header */}
              <div className={`relative bg-gradient-to-br ${course.headerGradient} p-8 text-white`}>
                <div className="flex items-start justify-between mb-4">
                  <span className="text-5xl drop-shadow-lg">{course.emoji}</span>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${course.badgeColor} backdrop-blur-md`}>
                    {course.badge}
                  </span>
                </div>
                <h2 className="text-3xl font-black mb-1">{course.title}</h2>
                <p className="text-white/75 text-sm font-medium">{course.topics} subtopics across multiple chapters</p>
              </div>

              {/* Card Body */}
              <div className="relative p-7 flex flex-col">
                <p className="text-gray-300 text-sm leading-relaxed mb-5">{course.description}</p>

                {/* Highlights */}
                <ul className="space-y-2.5 mb-6">
                  {course.highlights.map((h, i) => (
                    <li key={i} className="flex items-center text-xs text-gray-400 font-medium">
                      <div className="w-1.5 h-1.5 rounded-full mr-2.5 flex-shrink-0" style={{backgroundColor: course.id === 'basic' ? '#fbbf24' : '#4ade80'}}></div>
                      {h}
                    </li>
                  ))}
                </ul>

                {/* Progress Bar - Enhanced */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="font-semibold text-gray-300 text-sm">Progress</span>
                    <span className="font-bold text-gray-200 text-sm">{course.completed} / {course.topics}</span>
                  </div>
                  <div className="relative w-full bg-gray-700/50 rounded-full h-3 overflow-hidden border border-gray-600/50">
                    <div
                      className={`bg-gradient-to-r ${course.progressColor} h-full rounded-full transition-all duration-700 ease-out shadow-lg`}
                      style={{ width: `${course.pct}%` }}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-400 font-medium mt-1.5">{course.pct}% complete</div>
                </div>

                {/* CTA Button */}
                <button
                  className={`w-full ${course.btnColor} text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-lg hover:scale-105 active:scale-95`}
                  onClick={(e) => { e.stopPropagation(); navigate(course.route); }}
                >
                  {course.pct === 0 ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
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
        <div className="mt-10 w-full bg-gradient-to-br from-indigo-500/10 to-purple-600/10 backdrop-blur-xl rounded-2xl border border-indigo-400/20 p-7">
          <h3 className="text-lg font-black text-gray-100 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            Overall Progress
          </h3>
          <div className="grid grid-cols-2 gap-6">
            {courses.map(course => (
              <div key={course.id} className="text-center">
                <div className="text-4xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  {course.pct}<span className="text-sm font-bold text-gray-400">%</span>
                </div>
                <div className="text-sm font-bold text-gray-300">{course.title}</div>
                <div className="text-xs text-gray-500 mt-1">{course.completed} of {course.topics} subtopics</div>
              </div>
            ))}
          </div>
        </div>

        </div>{/* end LEFT column */}

        {/* RIGHT: Public Classrooms */}
        <div className="w-full lg:flex-1 min-w-0">
          {/* Section label */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-3">Collaboration</h2>
            <h3 className="text-3xl font-black text-white">🌐 Public Classrooms</h3>
          </div>

        <div className="">{/* Public Classrooms */}
          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <p className="text-gray-400 text-sm">Join study groups and collaborate with peers.</p>
            {/* Tab pills */}
            <div className="flex gap-2 bg-gray-800/50 backdrop-blur-md p-1.5 rounded-xl self-start sm:self-auto border border-gray-700/50">
              <button
                onClick={() => setClassTab('latest')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${classTab === 'latest' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
              >
                🕐 Latest
              </button>
              <button
                onClick={() => setClassTab('popular')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${classTab === 'popular' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
              >
                🔥 Popular
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
            <input
              value={publicSearch}
              onChange={e => setPublicSearch(e.target.value)}
              placeholder="Search classrooms..."
              className="w-full bg-gray-800/50 backdrop-blur-md border border-gray-700/50 rounded-xl pl-12 pr-4 py-3 text-sm text-gray-100 outline-none focus:border-indigo-400/50 transition-all placeholder-gray-500"
            />
          </div>

          {joinMsg && (
            <p className={`text-sm mb-5 px-5 py-3.5 rounded-xl font-medium backdrop-blur-md border transition-all ${joinMsg.startsWith('✓') ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>{joinMsg}</p>
          )}

          {(() => {
            const searched = publicClasses.filter(c =>
              (c.name + ' ' + (c.description || '')).toLowerCase().includes(publicSearch.toLowerCase())
            );
            const latest = [...searched].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
            const popular = [...searched].sort((a, b) => (b.member_count || 0) - (a.member_count || 0)).slice(0, 6);
            const displayList = classTab === 'popular' ? popular : latest;

            if (displayList.length === 0) return (
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-12 text-center">
                <div className="text-6xl mb-3 opacity-50">🏫</div>
                <p className="text-gray-400 text-sm font-medium">No public classrooms found.</p>
              </div>
            );

            const gradients = [
              'from-indigo-500 to-blue-600',
              'from-violet-500 to-purple-600',
              'from-rose-500 to-pink-600',
              'from-emerald-500 to-teal-600',
              'from-amber-500 to-orange-600',
              'from-sky-500 to-cyan-600',
            ];

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayList.map((cls, idx) => {
                  const grad = gradients[idx % gradients.length];
                  const initial = cls.name.trim()[0]?.toUpperCase() || '?';
                  const dateStr = new Date(cls.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                  return (
                    <div key={cls.id} className="group bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 overflow-hidden hover:border-gray-600/50 transition-all duration-300 hover:shadow-2xl flex flex-col">
                      {/* Header */}
                      <div className={`relative bg-gradient-to-br ${grad} p-6 text-white overflow-hidden`}>
                        {/* Decorative circles */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-3xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-white/10 blur-2xl"></div>
                        <div className="relative flex items-start justify-between mb-4">
                          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-md">
                            {cls.category || 'Classroom'}
                          </span>
                          {classTab === 'latest' && idx === 0 && (
                            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-yellow-300/90 text-yellow-900">✨ New</span>
                          )}
                          {classTab === 'popular' && idx === 0 && (
                            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/30 text-white">🏆 Top</span>
                          )}
                        </div>
                        <div className="relative flex items-center gap-3">
                          {/* Letter avatar */}
                          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg font-black shadow-lg flex-shrink-0 border border-white/30">
                            {initial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-black text-base leading-snug truncate">{cls.name}</h3>
                            <div className="flex gap-1 flex-wrap mt-2">
                              {(cls.enrolled_courses || ['basic']).slice(0, 2).map(c => (
                                <span key={c} className="text-xs px-2 py-1 rounded-md bg-white/20 font-bold backdrop-blur-sm">
                                  {c === 'basic' ? '☕' : '🚀'}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Body */}
                      <div className="p-5 flex flex-col gap-4 flex-1">
                        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 min-h-[2.5rem] font-medium">
                          {cls.description || <span className="italic text-gray-500">No description provided.</span>}
                        </p>
                        {/* Stat badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1 text-xs font-bold text-gray-300 bg-gray-700/50 border border-gray-600/50 rounded-full px-3 py-1.5">
                            👥 {cls.member_count || 0}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-bold text-gray-300 bg-gray-700/50 border border-gray-600/50 rounded-full px-3 py-1.5">
                            📅 {dateStr}
                          </span>
                        </div>
                        <button
                          disabled={joiningId === cls.id}
                          onClick={async () => {
                            if (!isAuthenticated) { navigate('/login'); return; }
                            setJoiningId(cls.id);
                            setJoinMsg('');
                            try {
                              await joinClassroom(cls.class_code);
                              setJoinMsg(`✓ Joined "${cls.name}"! Visit My Classrooms to access it.`);
                              setPublicClasses(prev => prev.filter(c => c.id !== cls.id));
                            } catch (e) {
                              setJoinMsg(e.message);
                            } finally {
                              setJoiningId(null);
                            }
                          }}
                          className={`w-full font-bold py-3 px-4 rounded-xl text-sm transition-all duration-200 disabled:opacity-60 text-white ${
                            !isAuthenticated
                              ? 'bg-gray-600/50 hover:bg-gray-600 cursor-pointer border border-gray-600/50'
                              : `bg-gradient-to-r ${grad} hover:shadow-lg hover:scale-105 active:scale-95 border border-${grad.split('-')[1]}-400/50`
                          }`}
                        >
                          {!isAuthenticated ? '🔒 Log in' : joiningId === cls.id ? 'Joining...' : 'Join →'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Footer note */}
          {publicClasses.length > 6 && (
            <p className="text-center text-xs text-gray-500 mt-6 font-medium">Showing top 6. Use search to find more classrooms.</p>
          )}
        </div>
        </div>{/* end RIGHT column */}

      </div>{/* end two-column layout */}
    </div>
  );
}
