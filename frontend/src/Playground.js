import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Compiler from "./Compiler";
import { ProgressTracker } from "./ProgressTracker";
import { saveWork } from './myWorkService';
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

    const tracker = useRef(new ProgressTracker()).current;
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        if (!localStorage.getItem('token')) {
            alert('Please log in to save your work.');
            return;
        }
        setSaving(true);
        try {
            await saveWork({
                work_type: 'playground',
                title: `Playground — ${new Date().toLocaleString()}`,
                topic_id: fromTopic || null,
                content: code,
                result_data: null,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.error('saveWork failed:', e);
        }
        setSaving(false);
    };


    // Listen for code run completions (Compiler fires 'demo-code-output' after every run)
    useEffect(() => {
        const handleRunComplete = () => {
            tracker.markPlaygroundUsed();
            window.dispatchEvent(new Event('progress-updated'));
        };
        window.addEventListener('demo-code-output', handleRunComplete);
        return () => window.removeEventListener('demo-code-output', handleRunComplete);
    }, [tracker]);

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
                    // No onRun prop — let Compiler use its internal run logic
                />

                <div style={{ marginTop: 12 }}>
                    <button onClick={handleSave} disabled={saving} style={{
                        background: saved ? '#10b981' : '#4f46e5',
                        color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer'
                    }}>{saved ? '💾 Saved' : '💾 Save'}</button>
                </div>
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
