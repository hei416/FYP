import React, { useState, useEffect, useCallback } from 'react';
import { colors, radii, font, spacing, btn, shadows, transition } from '../theme';

export default function TextHighlightButton({ onAskAI }) {
    const [position, setPosition] = useState(null);
    const [selectedText, setSelectedText] = useState('');

    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text.length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            // Position the button above the selected text
            setPosition({
                top: rect.top + window.scrollY - 45,
                left: rect.left + window.scrollX + (rect.width / 2) - 75, // Center the button
            });
            setSelectedText(text);
        } else {
            setPosition(null);
            setSelectedText('');
        }
    }, []);

    const handleAskAI = () => {
        if (selectedText && onAskAI) {
            onAskAI(selectedText);
            // Clear selection and hide button
            window.getSelection().removeAllRanges();
            setPosition(null);
            setSelectedText('');
        }
    };

    useEffect(() => {
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('selectionchange', handleTextSelection);
        
        // Hide button when clicking elsewhere
        const handleClickOutside = (e) => {
            if (position && !e.target.closest('.highlight-ai-button')) {
                setPosition(null);
                setSelectedText('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mouseup', handleTextSelection);
            document.removeEventListener('selectionchange', handleTextSelection);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [handleTextSelection, position]);

    if (!position) return null;

    return (
        <div
            className="highlight-ai-button"
            style={{
                position: 'absolute',
                top: position.top,
                left: position.left,
                zIndex: 10000,
                animation: 'fadeInScale 0.2s ease-out',
            }}
        >
            <button
                onClick={handleAskAI}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs,
                    padding: `${spacing.xs} ${spacing.sm}`,
                    background: `linear-gradient(135deg, ${colors.accent} 0%, #7c3aed 100%)`,
                    color: colors.surface,
                    border: 'none',
                    borderRadius: radii.md,
                    fontSize: font.sizeSm,
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: shadows.lg,
                    transition: transition,
                    whiteSpace: 'nowrap',
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(147, 51, 234, 0.4)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = shadows.lg;
                }}
            >
                <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <circle cx="9" cy="10" r="1" fill="currentColor" />
                    <circle cx="15" cy="10" r="1" fill="currentColor" />
                    <path d="M9 14a3 3 0 0 0 6 0" />
                </svg>
                Ask AI about this
            </button>
            <style>{`
                @keyframes fadeInScale {
                    from {
                        opacity: 0;
                        transform: translateY(-5px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}
