import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import AI from "./AI";
import Compiler from "./Compiler";
import BasicJavaPage from "./BasicJavaPage";
import EnhancedJavaPage from "./EnhancedJavaPage";
import CourseCatalogPage from "./CourseCatalogPage";
import TopicDetailPage from "./TopicDetailPage";
import EnhancedTopicDetailPage from "./EnhancedTopicDetailPage";
import Quiz from "./Quiz";
import PracticalTest from "./PracticalTest";
import Playground from "./Playground";
import MyWorkPage from './MyWorkPage';
import ConversationHistoryPage from "./ConversationHistoryPage";
import TeacherDashboard from "./TeacherDashboard";
import TeacherClassroomDetail from "./TeacherClassroomDetail";
import AdminDashboard from "./AdminDashboard";
import StudentClassrooms from "./StudentClassrooms";
import StudentClassroomDetail from "./StudentClassroomDetail";
import { DemoTour } from "./DemoTour";
import TextHighlightButton from "./components/TextHighlightButton";
import { colors, radii, font, spacing, btn, shadows, navbar, transition } from './theme';
import { useAuth } from './AuthContext';
import Auth from './Auth';
import { loadProgressFromBackend, mergeProgressWithLocal, syncProgressToBackend } from './progressService';

const resizeObserverErrHandler = (e) => {
    if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
        if (resizeObserverErr) resizeObserverErr.style.display = 'none';
    }
};
window.addEventListener('error', resizeObserverErrHandler);

function AppContent() {
    const [showChat, setShowChat] = useState(false);
    const [demoTour, setDemoTour] = useState(null);
    const [showDemoButtons, setShowDemoButtons] = useState(true);
    const navigate = useNavigate();
    const { isAuthenticated, isTeacher, user } = useAuth();
    const aiInputRef = useRef(null);

    const toggleChat = () => setShowChat(prev => !prev);

    const handleAskAI = (text) => {
        if (aiInputRef.current) {
            // Open chat and submit query automatically
            aiInputRef.current.setShowChat(true);
            // Small delay to ensure chat is open before submitting
            setTimeout(() => {
                aiInputRef.current.submitQuery(`Explain this: "${text}"`);
            }, 100);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            const localProgress = JSON.parse(localStorage.getItem('codetutor_learning_progress') || '{}');
            const roadmapCompleted = JSON.parse(localStorage.getItem('java-roadmap-completed') || '[]');
            syncProgressToBackend(localProgress, roadmapCompleted).then(() => {
                loadProgressFromBackend().then((backendProgress) => {
                    if (backendProgress) {
                        mergeProgressWithLocal(backendProgress, 'codetutor_learning_progress', 'java-roadmap-completed');
                    }
                });
            });
        }
    }, [isAuthenticated]);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenDemoTour');
        if (!hasSeenTour) {
            const timer = setTimeout(() => {
                startGuidedTour();
                localStorage.setItem('hasSeenDemoTour', 'true');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') setShowDemoButtons(prev => !prev);
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    const startGuidedTour = () => {
        if (demoTour) {
            demoTour.start();
        } else {
            const tour = new DemoTour(navigate);
            setDemoTour(tour);
            tour.start();
        }
    };

    return (
        <>
            <Navbar toggleChat={toggleChat} />
            <AI showChat={showChat} setShowChat={setShowChat} externalInputRef={aiInputRef} />
            <TextHighlightButton onAskAI={handleAskAI} />

            {showDemoButtons && (
                <div style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    <button onClick={startGuidedTour} style={{ ...btn.accent }}
                        onMouseOver={(e) => { Object.assign(e.currentTarget.style, btn.accentHover); }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = colors.accent; e.currentTarget.style.boxShadow = btn.accent.boxShadow; }}
                    >
                        <span style={{ fontSize: '18px' }}>🎓</span>
                        <span>Start Tour</span>
                    </button>
                    <button onClick={() => setShowDemoButtons(false)}
                        style={{ padding: spacing.sm, background: colors.textMuted, color: colors.surface, border: 'none', borderRadius: radii.sm, cursor: 'pointer', fontSize: font.sizeXs, opacity: 0.7, transition }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                        onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                        title="Hide demo buttons (Ctrl+Shift+D to toggle)"
                    >✕</button>
                </div>
            )}

            {!showDemoButtons && (
                <button onClick={() => setShowDemoButtons(true)}
                    style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 1000, padding: spacing.sm, background: colors.accent, color: colors.surface, border: 'none', borderRadius: radii.full, cursor: 'pointer', fontSize: font.sizeXl, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadows.md }}
                    title="Show demo buttons"
                >?</button>
            )}

            <div style={{ paddingTop: navbar.height }} className="bg-white min-h-screen">
                <Routes>
                    <Route path="/login"              element={<Auth />} />
                    <Route path="/"                   element={<CourseCatalogPage />} />
                    <Route path="/basic-java"         element={<BasicJavaPage />} />
                    <Route path="/enhanced-java"      element={<EnhancedJavaPage />} />
                    <Route path="/topic/:topicId"     element={<TopicDetailPage />} />
                    <Route path="/enhanced-topic/:topicId" element={<EnhancedTopicDetailPage />} />
                    <Route path="/playground"         element={<Playground />} />
                    <Route path="/exercises"          element={<Quiz />} />
                    <Route path="/coding-challenges"  element={<PracticalTest />} />
                    <Route path="/my-work"            element={<MyWorkPage />} />
                    <Route path="/chat-history"       element={<ConversationHistoryPage />} />
                    <Route path="/quiz"               element={<Navigate to="/exercises" replace />} />
                    <Route path="/practical-test"     element={<Navigate to="/coding-challenges" replace />} />
                    <Route path="/history"            element={<Navigate to="/chat-history" replace />} />
                    <Route path="/teacher-dashboard"  element={<TeacherDashboard />} />
                    <Route path="/teacher-classroom/:classroomId" element={<TeacherClassroomDetail />} />
                    <Route path="/my-classrooms"      element={<StudentClassrooms />} />
                    <Route path="/classrooms/:classroomId" element={<StudentClassroomDetail />} />
                    <Route path="/admin"              element={<AdminDashboard />} />
                    <Route path="/compiler"           element={<Navigate to="/playground" replace />} />
                </Routes>
            </div>
        </>
    );
}

function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;
