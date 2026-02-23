import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProgressDisplay from './ProgressDisplay';

export default function Navbar({ toggleChat }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    // Allow the demo tour to open/close the sidebar via custom events
    useEffect(() => {
        const handleOpen = () => setIsSidebarOpen(true);
        const handleClose = () => setIsSidebarOpen(false);
        window.addEventListener('open-sidebar', handleOpen);
        window.addEventListener('close-sidebar', handleClose);
        return () => {
            window.removeEventListener('open-sidebar', handleOpen);
            window.removeEventListener('close-sidebar', handleClose);
        };
    }, []);

    return (
        <>
            {/* Top Bar with Hamburger Menu */}
            <nav 
                data-tour="navbar"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 70,
                    background: 'white',
                    borderBottom: '2px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 24px',
                    zIndex: 100,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
            >
                {/* Left: Hamburger Menu + Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Hamburger Button */}
                    <button
                        onClick={toggleSidebar}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transition: 'all 0.3s'
                        }}
                    >
                        <div style={{
                            width: '24px',
                            height: '3px',
                            background: '#2196F3',
                            borderRadius: '2px',
                            transition: 'all 0.3s',
                            transform: isSidebarOpen ? 'rotate(45deg) translateY(7px)' : 'none'
                        }}></div>
                        <div style={{
                            width: '24px',
                            height: '3px',
                            background: '#2196F3',
                            borderRadius: '2px',
                            transition: 'all 0.3s',
                            opacity: isSidebarOpen ? 0 : 1
                        }}></div>
                        <div style={{
                            width: '24px',
                            height: '3px',
                            background: '#2196F3',
                            borderRadius: '2px',
                            transition: 'all 0.3s',
                            transform: isSidebarOpen ? 'rotate(-45deg) translateY(-7px)' : 'none'
                        }}></div>
                    </button>

                    <h1 style={{ 
                        margin: 0, 
                        fontSize: '24px', 
                        color: '#2196F3',
                        fontWeight: 'bold'
                    }}>
                        ☕ CodeTutor
                    </h1>
                </div>

                {/* Right: Progress + AI Button */}
                <div style={{ 
                    display: 'flex', 
                    gap: '16px', 
                    alignItems: 'center' 
                }}>
                    <ProgressDisplay />
                    
                    <button
                        data-tour="ai-button"
                        onClick={toggleChat}
                        style={{
                            padding: '10px 20px',
                            background: 'linear-gradient(135deg, #128C7E 0%, #0f7566 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s',
                            boxShadow: '0 2px 8px rgba(18, 140, 126, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(18, 140, 126, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(18, 140, 126, 0.3)';
                        }}
                    >
                        <span>🤖</span>
                        <span>Ask AI</span>
                    </button>
                </div>
            </nav>

            {/* Overlay (Dark Background) */}
            {isSidebarOpen && (
                <div
                    onClick={toggleSidebar}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 998,
                        animation: 'fadeIn 0.3s ease'
                    }}
                />
            )}

            {/* Sidebar */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: isSidebarOpen ? 0 : '-300px',
                    width: '280px',
                    height: '100vh',
                    background: 'white',
                    boxShadow: '4px 0 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 999,
                    transition: 'left 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '20px'
                }}
            >
                {/* Sidebar Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '30px',
                    paddingBottom: '20px',
                    borderBottom: '2px solid #e5e7eb'
                }}>
                    <h2 style={{ 
                        margin: 0, 
                        fontSize: '20px', 
                        color: '#2196F3',
                        fontWeight: 'bold'
                    }}>
                        Java Learning Hub
                    </h2>
                    <button
                        onClick={toggleSidebar}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: '#9ca3af',
                            padding: '4px'
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Navigation Links */}
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '8px',
                    flex: 1
                }}>
                    <Link 
                        to="/home" 
                        onClick={toggleSidebar}
                        style={{ 
                            textDecoration: 'none', 
                            color: '#374151',
                            fontWeight: '500',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '15px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f0f9ff';
                            e.currentTarget.style.color = '#2196F3';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#374151';
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>🏠</span>
                        <span>Home</span>
                    </Link>

                    <Link 
                        to="/playground" 
                        data-tour="playground-link"
                        onClick={toggleSidebar}
                        style={{ 
                            textDecoration: 'none', 
                            color: '#374151',
                            fontWeight: '500',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '15px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f0f9ff';
                            e.currentTarget.style.color = '#2196F3';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#374151';
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>💻</span>
                        <span>Playground</span>
                    </Link>

                    <Link 
                        to="/quiz" 
                        data-tour="quiz-link"
                        onClick={toggleSidebar}
                        style={{ 
                            textDecoration: 'none', 
                            color: '#374151',
                            fontWeight: '500',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '15px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f0f9ff';
                            e.currentTarget.style.color = '#2196F3';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#374151';
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>📝</span>
                        <span>Quiz</span>
                    </Link>

                    <Link 
                        to="/practical-test" 
                        data-tour="test-link"
                        onClick={toggleSidebar}
                        style={{ 
                            textDecoration: 'none', 
                            color: '#374151',
                            fontWeight: '500',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '15px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f0f9ff';
                            e.currentTarget.style.color = '#2196F3';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#374151';
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>🎯</span>
                        <span>Tests</span>
                    </Link>
                </div>

                {/* Sidebar Footer */}
                <div style={{
                    marginTop: 'auto',
                    paddingTop: '20px',
                    borderTop: '2px solid #e5e7eb'
                }}>
                    <p style={{
                        margin: '0 0 10px 0',
                        fontSize: '12px',
                        color: '#9ca3af',
                        textAlign: 'center'
                    }}>
                    </p>
                </div>
            </div>

            {/* Add fadeIn animation */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    );
}
