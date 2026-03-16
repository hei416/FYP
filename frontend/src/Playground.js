import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Compiler from "./Compiler";
import { ProgressTracker } from "./ProgressTracker";
import { colors, radii, font, spacing, card, pageContainer } from './theme';

export default function Playground() {
    const location = useLocation();
    const navigate = useNavigate();
    const [code, setCode] = useState(() => {
        // Check if code was passed from TopicDetailPage
        if (location.state?.code) {
            return location.state.code;
        }
        return `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java Playground!");
        
        // Write your code here
        
    }
}`;
    });

    const fromTopic = location.state?.fromTopic;

    const tracker = new ProgressTracker();

    // Track when code is executed
    const handleCodeRun = () => {
        tracker.markPlaygroundUsed();
        window.dispatchEvent(new Event('progress-updated'));
    };

    // Listen for demo tour code fill events
    useEffect(() => {
        const handleDemoFill = (event) => {
            if (event.detail && event.detail.code) {
                setCode(event.detail.code);
            }
        };

        window.addEventListener('demo-fill-code', handleDemoFill);
        
        return () => {
            window.removeEventListener('demo-fill-code', handleDemoFill);
        };
    }, []);

    return (
        <div style={pageContainer(1200)}>
            {/* Header with Back to Learning button */}
            {fromTopic && (
                <div style={{ marginBottom: spacing.md, paddingBottom: spacing.md, borderBottom: `1px solid #e5e7eb` }}>
                    <button
                        onClick={() => navigate(`/topic/${fromTopic}`)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: `${spacing.sm}px ${spacing.md}px`,
                            backgroundColor: '#4f46e5',
                            color: 'white',
                            border: 'none',
                            borderRadius: radii.md,
                            cursor: 'pointer',
                            fontSize: font.sizeMd,
                            fontWeight: '500',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#4338ca'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = '#4f46e5'}
                    >
                        <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Learning Material
                    </button>
                </div>
            )}

            {/* ... your existing JSX ... */}
            
            <div data-tour="code-editor">
                <Compiler 
                    code={code} 
                    setCode={setCode}
                    hideRunButton={false}
                    onRun={handleCodeRun}  // Pass this callback
                />
            </div>

            <div style={{
                ...card.warning,
                marginTop: spacing.xl,
            }}>
                <h4 style={{ margin: `0 0 ${spacing.sm}px 0`, color: colors.warning, fontSize: font.sizeMd }}>📚 More Learning Resources:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing.sm }}>
                    <a href="https://www.w3schools.com/java/" target="_blank" rel="noopener noreferrer" 
                       style={{ color: colors.primary, textDecoration: 'none', fontSize: font.sizeMd }}>
                        → W3Schools Java Tutorial
                    </a>
                    <a href="https://www.geeksforgeeks.org/java/" target="_blank" rel="noopener noreferrer"
                       style={{ color: colors.primary, textDecoration: 'none', fontSize: font.sizeMd }}>
                        → GeeksforGeeks Java
                    </a>
                </div>
            </div>
        </div>
    );
}
