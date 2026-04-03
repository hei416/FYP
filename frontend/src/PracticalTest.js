import React, { useState, useEffect, useRef } from "react";
import CodingChallengePlayer from "./CodingChallengePlayer";
import { getTopicGroupsForPath } from "./learningPathUtils";
import { ProgressTracker } from "./ProgressTracker";
import { colors, radii, font, spacing, btn, card, pageContainer, pageHeading } from './theme';

const MAX_TOPICS = 3;

// ─── component ────────────────────────────────────────────────────────────────
export default function PracticalTest() {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

    const [topicGroups, setTopicGroups]           = useState([]);
    const [selectedPath, setSelectedPath]         = useState(null);
    const [screen, setScreen]                     = useState('select');
    const [selectedTopics, setSelectedTopics]     = useState([]);
    const [activeTestTopics, setActiveTestTopics] = useState([]);
    const [generating, setGenerating]             = useState(false);
    const [genError, setGenError]                 = useState('');
    // Normalized challenge passed to CodingChallengePlayer
    const [currentChallenge, setCurrentChallenge] = useState(null);

    // Load topic groups when a path is explicitly selected
    useEffect(() => {
        if (!selectedPath) { setTopicGroups([]); return; }
        getTopicGroupsForPath(selectedPath).then(groups => {
            setTopicGroups(groups);
        }).catch(err => {
            console.error('Failed to load topic groups:', err);
            setTopicGroups([]);
        });
    }, [selectedPath]);

    const tracker = useRef(new ProgressTracker()).current;
    const ALL_TOPICS = topicGroups.map(g => g.label);

    const toggleTopic = (label) => {
        setSelectedTopics(prev => {
            if (prev.includes(label)) return prev.filter(t => t !== label);
            if (prev.length >= MAX_TOPICS) {
                alert(`You can select up to ${MAX_TOPICS} topics per exercise.`);
                return prev;
            }
            return [...prev, label];
        });
    };
    const selectAll       = () => setSelectedTopics([...ALL_TOPICS].slice(0, MAX_TOPICS));
    const clearAll        = () => setSelectedTopics([]);
    const selectCompleted = () => {
        const completed = tracker.getCompletedTopics();
        const completedLabels = topicGroups
            .filter(g => g.subtopics.some(s => completed.includes(s)))
            .map(g => g.label);
        if (completedLabels.length === 0) {
            alert("⚠️ You haven't completed any topics on the Roadmap yet. Select topics manually or complete some lessons first!");
            return;
        }
        const capped = completedLabels.slice(0, MAX_TOPICS);
        if (completedLabels.length > MAX_TOPICS) {
            alert(`You have ${completedLabels.length} completed topics. Only the first ${MAX_TOPICS} have been selected.`);
        }
        setSelectedTopics(capped);
    };

    // ── generate AI question ──────────────────────────────────────────────────
    const generateAiQuestion = async (forceNew = false) => {
        if (selectedTopics.length === 0) { alert("Please select at least one topic first."); return; }
        setGenerating(true);
        setGenError('');
        const topicsForQuestion = [...selectedTopics];
        try {
            const res = await fetch(`${API_BASE}/api/practical-tests/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topicsForQuestion[0],
                    topics: topicsForQuestion,
                    force_new: forceNew,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const payload = await res.json();
            const qd = payload.question_data;
            setCurrentChallenge({
                id:            qd.id            || null,
                question:      qd.question      || {},
                baseCode:      qd.baseCode      || {},
                modelSolution: qd.solution      || null,
            });
            setActiveTestTopics(topicsForQuestion);
            setScreen('active');
        } catch (e) {
            setGenError(`Failed to generate question: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleBackToSelect = () => setScreen('select');

    return (
        <div style={pageContainer(1100)}>
            <h2 style={pageHeading}>🎯 Coding Challenge</h2>

            {screen === 'select' && (
                <>
                    {!selectedPath ? (
                        <>
                            <p style={{ color: colors.textSecondary, fontSize: font.sizeMd, marginBottom: spacing.xl }}>
                                Choose which Java course to generate a coding challenge for.
                            </p>
                            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => { setSelectedPath('basic'); setSelectedTopics([]); }}
                                    style={{
                                        padding: '32px 40px', borderRadius: radii.md,
                                        border: `2px solid ${colors.border}`, background: colors.surface,
                                        cursor: 'pointer', textAlign: 'center', minWidth: 220,
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                    }}
                                >
                                    <div style={{ fontSize: 40, marginBottom: 10 }}>☕</div>
                                    <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.text }}>Basic Java</div>
                                    <div style={{ fontSize: font.sizeSm, color: colors.textSecondary, marginTop: 6 }}>12 topic groups · Beginner to intermediate</div>
                                </button>
                                <button
                                    onClick={() => { setSelectedPath('enhanced'); setSelectedTopics([]); }}
                                    style={{
                                        padding: '32px 40px', borderRadius: radii.md,
                                        border: `2px solid ${colors.border}`, background: colors.surface,
                                        cursor: 'pointer', textAlign: 'center', minWidth: 220,
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                    }}
                                >
                                    <div style={{ fontSize: 40, marginBottom: 10 }}>🚀</div>
                                    <div style={{ fontSize: font.sizeLg, fontWeight: font.weightBold, color: colors.text }}>Enhanced Java</div>
                                    <div style={{ fontSize: font.sizeSm, color: colors.textSecondary, marginTop: 6 }}>8 topic groups · Advanced concepts</div>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: spacing.md }}>
                                <button
                                    onClick={() => { setSelectedPath(null); setSelectedTopics([]); }}
                                    style={{ ...btn.ghost, fontSize: font.sizeSm, padding: '4px 10px' }}
                                >
                                    ← Change Course
                                </button>
                                <span style={{ fontSize: font.sizeSm, color: colors.textSecondary }}>
                                    {selectedPath === 'enhanced' ? '🚀 Enhanced Java' : '☕ Basic Java'}
                                </span>
                            </div>
                            <p style={{ color: colors.textSecondary, fontSize: font.sizeMd, marginBottom: spacing.lg }}>
                                Select one or more topics, then generate an AI coding exercise tailored to those concepts.
                            </p>

                            <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg }}>
                                <button onClick={selectCompleted} style={{ ...btn.primary, fontSize: font.sizeSm }}>✅ My Completed Topics</button>
                                <button onClick={selectAll}       style={{ ...btn.secondary, fontSize: font.sizeSm }}>Select All</button>
                                <button onClick={clearAll}        style={{ ...btn.ghost, fontSize: font.sizeSm }}>Clear</button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: spacing.md, marginBottom: spacing.xl }}>
                                {ALL_TOPICS.map(label => {
                                    const selected = selectedTopics.includes(label);
                                    return (
                                        <button key={label} onClick={() => toggleTopic(label)} style={{
                                            padding: `${spacing.md}px`,
                                            borderRadius: radii.md,
                                            border: `2px solid ${selected ? colors.primary : colors.border}`,
                                            background: selected ? colors.primaryLight : colors.surface,
                                            color: selected ? colors.primary : colors.text,
                                            fontWeight: selected ? font.weightSemibold : font.weightNormal,
                                            fontSize: font.sizeSm,
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.15s',
                                        }}>
                                            {selected ? '✓ ' : ''}{label}
                                        </button>
                                    );
                                })}
                            </div>

                            {genError && (
                                <div style={{ ...card.base, borderLeft: `4px solid ${colors.error}`, marginBottom: spacing.lg, color: colors.error, padding: spacing.md }}>
                                    {genError}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button
                                    onClick={() => generateAiQuestion(false)}
                                    disabled={generating || selectedTopics.length === 0}
                                    style={{ ...btn.success, opacity: (generating || selectedTopics.length === 0) ? 0.5 : 1, cursor: (generating || selectedTopics.length === 0) ? 'not-allowed' : 'pointer', minWidth: 200 }}
                                >
                                    {generating ? '⏳ Loading question...' : '▶ Start Exercise'}
                                </button>
                                <button
                                    onClick={() => generateAiQuestion(true)}
                                    disabled={generating || selectedTopics.length === 0}
                                    style={{ ...btn.secondary, opacity: (generating || selectedTopics.length === 0) ? 0.5 : 1, cursor: (generating || selectedTopics.length === 0) ? 'not-allowed' : 'pointer' }}
                                >
                                    🔄 Generate New Question
                                </button>
                            </div>

                            <p style={{ marginTop: spacing.md, fontSize: font.sizeSm, color: colors.textSecondary }}>
                                Selected: {selectedTopics.length}/{MAX_TOPICS} topics
                                {selectedTopics.length > 0 && ` · ${selectedTopics.join(' · ')}`}
                            </p>
                        </>
                    )}
                </>
            )}

            {screen === 'active' && currentChallenge && (
                <CodingChallengePlayer
                    challenge={currentChallenge}
                    topics={activeTestTopics}
                    label="🤖 AI Generated"
                    onNewQuestion={() => generateAiQuestion(true)}
                    generating={generating}
                    onBack={handleBackToSelect}
                />
            )}
        </div>
    );
}
