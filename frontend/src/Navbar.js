import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProgressDisplay from './ProgressDisplay';
import { colors, radii, shadows, font, spacing, btn, navbar, sidebar, transition } from './theme';
import { useAuth } from './AuthContext';

export default function Navbar({ toggleChat }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { user, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

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
            <nav
                data-tour="navbar"
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0,
                    height: navbar.height,
                    background: navbar.bg,
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 24px', zIndex: 100, boxShadow: navbar.shadow
                }}
            >
                {/* Left: Hamburger + Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                        onClick={toggleSidebar}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', transition: 'all 0.3s' }}
                    >
                        <div style={{ width: '24px', height: '3px', background: colors.primary, borderRadius: '2px', transition, transform: isSidebarOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
                        <div style={{ width: '24px', height: '3px', background: colors.primary, borderRadius: '2px', transition, opacity: isSidebarOpen ? 0 : 1 }} />
                        <div style={{ width: '24px', height: '3px', background: colors.primary, borderRadius: '2px', transition, transform: isSidebarOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
                    </button>
                    <h1 data-tour="brand" style={{ margin: 0, fontSize: font.sizeXxl, color: colors.primary, fontWeight: font.weightBold }}>
                        ☕ CodeTutor
                    </h1>
                </div>

                {/* Right: Progress + AI + User */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <ProgressDisplay />
                    <button
                        data-tour="ai-button"
                        onClick={toggleChat}
                        style={{ ...btn.accent, ...btn.small }}
                        onMouseEnter={(e) => Object.assign(e.currentTarget.style, btn.accentHover)}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.accent; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = btn.accent.boxShadow; }}
                    >
                        <span>🤖</span>
                        <span>Ask AI</span>
                    </button>

                    {isAuthenticated ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: font.sizeSm, color: colors.textSecondary, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                👤 {user?.email}
                            </span>
                            <button
                                onClick={() => { logout(); navigate('/home'); }}
                                style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: radii.sm, color: colors.textSecondary, fontSize: font.sizeSm, cursor: 'pointer', transition }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.error || '#ef4444'; e.currentTarget.style.color = colors.error || '#ef4444'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textSecondary; }}
                            >Logout</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            style={{ padding: '6px 18px', background: 'transparent', border: `1px solid ${colors.primary}`, borderRadius: radii.sm, color: colors.primary, fontSize: font.sizeSm, fontWeight: font.weightMedium, cursor: 'pointer', transition }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = colors.primary; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.primary; }}
                        >Login / Register</button>
                    )}
                </div>
            </nav>

            {/* Overlay */}
            {isSidebarOpen && (
                <div onClick={toggleSidebar} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: colors.backdrop, zIndex: 998, animation: 'fadeIn 0.3s ease' }} />
            )}

            {/* Sidebar */}
            <div style={{
                position: 'fixed', top: 0,
                left: isSidebarOpen ? 0 : `-${sidebar.width + 20}px`,
                width: sidebar.width, height: '100vh',
                background: sidebar.bg, boxShadow: sidebar.shadow,
                zIndex: 999, transition: 'left 0.3s ease',
                display: 'flex', flexDirection: 'column', padding: spacing.xl
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, paddingBottom: spacing.xl, borderBottom: `2px solid ${colors.border}` }}>
                    <h2 style={{ margin: 0, fontSize: font.sizeXl, color: colors.primary, fontWeight: font.weightBold }}>Java Learning Hub</h2>
                    <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: colors.textMuted, padding: 4 }}>×</button>
                </div>

                {/* Nav Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    {[
                        { to: '/home', icon: '🗺️', label: 'Roadmap', 'data-tour': 'home-link' },
                        { to: '/playground', icon: '💻', label: 'Playground', 'data-tour': 'playground-link' },
                        { to: '/quiz', icon: '📝', label: 'Quiz', 'data-tour': 'quiz-link' },
                        { to: '/practical-test', icon: '🎯', label: 'Tests', 'data-tour': 'test-link' },
                        { to: '/my-work', icon: '📁', label: 'My Work' },
                        { to: '/history', icon: '🕘', label: 'Chat History' },
                    ].map(({ to, icon, label, ...rest }) => (
                        <Link
                            key={to}
                            to={to}
                            onClick={toggleSidebar}
                            {...rest}
                            style={{ textDecoration: 'none', color: colors.textSecondary, fontWeight: font.weightMedium, padding: '12px 16px', borderRadius: radii.sm, transition, display: 'flex', alignItems: 'center', gap: 12, fontSize: font.sizeMd }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = colors.primaryLight; e.currentTarget.style.color = colors.primary; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.textSecondary; }}
                        >
                            <span style={{ fontSize: 20 }}>{icon}</span>
                            <span>{label}</span>
                        </Link>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ marginTop: 'auto', paddingTop: spacing.xl, borderTop: `2px solid ${colors.border}` }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }} />
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </>
    );
}
