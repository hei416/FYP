import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import AI from "./AI";
import Compiler from "./Compiler";
import HomePage from "./HomePage";
import Quiz from "./Quiz";
import PracticalTest from "./PracticalTest";
import Lessons from "./Lessons";
import LessonLayout from "./LessonLayout";
import Playground from "./Playground"; 
import { DemoTour } from "./DemoTour";

// Create a wrapper component that has access to useNavigate
function AppContent() {
    const [showChat, setShowChat] = useState(false);
    const [demoTour, setDemoTour] = useState(null);
    const [showDemoButtons, setShowDemoButtons] = useState(true);
    const navigate = useNavigate();  // NOW we can use navigate!

    const toggleChat = () => setShowChat(prev => !prev);


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

    // Keyboard shortcut
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                setShowDemoButtons(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    // Start Guided Tour function - PASS navigate to tour
    const startGuidedTour = () => {
        if (demoTour) {
            demoTour.start();
        } else {
            const tour = new DemoTour(navigate);  // PASS navigate here!
            setDemoTour(tour);
            tour.start();
        }
    };

    return (
        <>
            <Navbar toggleChat={toggleChat} />
            <AI showChat={showChat} setShowChat={setShowChat} />
            
            {/* Demo Control Buttons */}
            {showDemoButtons && (
                <div style={{
                    position: 'fixed',
                    bottom: 20,
                    left: 20,
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <button 
                        onClick={startGuidedTour}
                        style={{
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #128C7E 0%, #0f7566 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '15px',
                            fontWeight: '600',
                            boxShadow: '0 4px 12px rgba(18, 140, 126, 0.4)',
                            transition: 'all 0.3s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(18, 140, 126, 0.5)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(18, 140, 126, 0.4)';
                        }}
                    >
                        <span style={{ fontSize: '18px' }}>🎓</span>
                        <span>Start Tour</span>
                    </button>

                    <button 
                        onClick={() => setShowDemoButtons(false)}
                        style={{
                            padding: '8px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            opacity: 0.7,
                            transition: 'opacity 0.3s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                        onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
                        title="Hide demo buttons (Ctrl+Shift+D to toggle)"
                    >
                        ✕
                    </button>
                </div>
            )}

            {!showDemoButtons && (
                <button 
                    onClick={() => setShowDemoButtons(true)}
                    style={{
                        position: 'fixed',
                        bottom: 20,
                        left: 20,
                        zIndex: 1000,
                        padding: '10px',
                        background: '#128C7E',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '20px',
                        width: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(18, 140, 126, 0.4)'
                    }}
                    title="Show demo buttons"
                >
                    ?
                </button>
            )}

            <div style={{ paddingTop: 70 }} className="bg-white min-h-screen">
                <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/compiler" element={<Navigate to="/playground" replace />} />
                    <Route path="/playground" element={<Playground />} /> 
                    <Route path="/quiz" element={<Quiz />} />
                    <Route path="/practical-test" element={<PracticalTest />} />
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
