import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import './shepherd-custom.css';

export class DemoTour {
    constructor(navigate) {
        this.navigate = navigate;
        
        this.tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shepherd-theme-custom',
                scrollTo: { behavior: 'smooth', block: 'center' },
                cancelIcon: {
                    enabled: true
                },
                modalOverlayOpeningPadding: 8,
                modalOverlayOpeningRadius: 8
            }
        });

        this.setupSteps();
    }

    navigateTo(path) {
        return new Promise((resolve) => {
            this.navigate(path);
            setTimeout(resolve, 800);
        });
    }

    openSidebar() {
        return new Promise((resolve) => {
            window.dispatchEvent(new CustomEvent('open-sidebar'));
            setTimeout(resolve, 400);
        });
    }

    closeSidebar() {
        return new Promise((resolve) => {
            window.dispatchEvent(new CustomEvent('close-sidebar'));
            setTimeout(resolve, 300);
        });
    }

    closeAI() {
        return new Promise((resolve) => {
            window.dispatchEvent(new CustomEvent('close-ai-chat'));
            setTimeout(resolve, 300);
        });
    }

    _hideTourUI() {
        if (!this._hideStyle) {
            this._hideStyle = document.createElement('style');
            this._hideStyle.id = 'shepherd-hide-override';
            this._hideStyle.textContent = `
                .shepherd-element, .shepherd-modal-overlay-container { display: none !important; }
            `;
        }
        if (!document.getElementById('shepherd-hide-override')) {
            document.head.appendChild(this._hideStyle);
        }
    }

    _showTourUI() {
        const el = document.getElementById('shepherd-hide-override');
        if (el) el.remove();
    }

    setupSteps() {
        // Step 1: Welcome (updated to 12 steps)
        this.tour.addStep({
            id: 'welcome',
            text: `
                <div style="text-align: center;">
                    <h2 style="margin: 0 0 15px 0; color: #128C7E; font-size: 24px;">🎓 Welcome to CodeTutor!</h2>
                    <p style="margin: 0; color: #6b7280; line-height: 1.6;">
                        This is an <strong>automated demo</strong> that will showcase all features.
                        Just sit back and watch, or click through at your own pace!
                    </p>
                    <p style="margin: 15px 0 0 0; font-size: 14px; color: #9ca3af;">
                        <strong>Duration:</strong> ~3 minutes | <strong>Steps:</strong> 13
                    </p>
                </div>
            `,
            buttons: [
                { text: 'Skip Tour', action: () => this.tour.cancel(), secondary: true },
                { text: 'Start Demo →', action: () => this.tour.next() }
            ]
        });

        // STEP 2: Navigate to Roadmap (correct route: /home)
        this.tour.addStep({
            id: 'roadmap-navigate',
            attachTo: { element: '[data-tour="home-link"]', on: 'right' },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">🗺️ Java Learning Roadmap</h3>
                <p style="margin: 0; line-height: 1.6;">
                    Your structured learning path with <strong>12 topics</strong> and 
                    <strong>48 subtopics</strong>! Each node you click opens its learning content.
                </p>
            `,
            beforeShowPromise: async () => {
                await this.closeAI();
                await this.navigateTo('/home');
                await this.openSidebar();
            },
            buttons: [
                {
                    text: 'Next →',
                    action: async () => { await this.closeSidebar(); this.tour.next(); }
                }
            ]
        });

        // STEP 3: Highlight the roadmap itself (no navigation needed, already at /home)
        this.tour.addStep({
            id: 'roadmap-overview',
            attachTo: { element: '[data-tour="roadmap-flow"]', on: 'bottom' },
            text: `
    <h3 style="margin: 0 0 10px 0; color: #128C7E;">📚 Topics & Subtopics</h3>
    <p style="margin: 0 0 8px 0; line-height: 1.6;">
        The roadmap is your <strong>visual learning curriculum</strong> — every topic you need to master Java, laid out as a flow diagram:
    </p>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.9; font-size: 14px;">
        <li>🗂️ <strong>12 Topic Groups</strong> — from Java Syntax basics all the way to Recursion and OOP</li>
        <li>🔗 <strong>48 Subtopics</strong> — each is a focused lesson with its own content page</li>
        <li>👆 <strong>Click any node</strong> to open that subtopic's full learning page instantly</li>
        <li>✅ <strong>Green nodes</strong> = completed | 🟡 <strong>Amber nodes</strong> = prerequisites not yet done</li>
        <li>📊 <strong>Progress bar</strong> at top tracks your overall % completion across all 65 subtopics</li>
    </ul>
`,
            buttons: [ { text: 'Next: Topic Detail →', action: () => this.tour.next() } ]
        });

        // STEP 4: Navigate to a specific topic (correct route: /topic/:id)
        this.tour.addStep({
            id: 'topic-detail',
            text: `
    <h3 style="margin: 0 0 10px 0; color: #128C7E;">📖 Topic Detail Page</h3>
    <p style="margin: 0 0 8px 0; line-height: 1.6;">
        Each subtopic opens a <strong>dedicated learning page</strong> generated specifically for you:
    </p>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.9; font-size: 14px;">
        <li>🤖 <strong>AI-generated explanations</strong> — clear, beginner-friendly prose written by GPT</li>
        <li>💻 <strong>Inline code examples</strong> — syntax-highlighted Java snippets you can study directly</li>
        <li>📄 <strong>RAG-sourced documents</strong> — real reference material retrieved from a knowledge base</li>
        <li>✅ <strong>Mark as Complete</strong> button — records your progress and unlocks dependent topics</li>
        <li>🔁 <strong>Regenerate</strong> — not happy with the explanation? Get a fresh one instantly</li>
    </ul>
`,
            beforeShowPromise: async () => {
                await this.closeAI();
                await this.navigateTo('/topic/python_syntax');
            },
            buttons: [ { text: 'Next: Playground →', action: () => this.tour.next() } ]
        });

        // Playground steps (existing)
        // Step: Highlight Playground Link
        this.tour.addStep({
            id: 'playground-link',
            attachTo: {
                element: '[data-tour="playground-link"]',
                on: 'right'
            },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">💻 Code Playground</h3>
                <p style="margin: 0; line-height: 1.6;">
                    The Playground is where you write and execute Java code in real-time.
                    Let me take you there...
                </p>
            `,
            beforeShowPromise: async () => {
                await this.closeAI();
                await this.openSidebar();
            },
            buttons: [
                {
                    text: 'Take Me There →',
                    action: async () => {
                        await this.closeSidebar();
                        await this.navigateTo('/playground');
                        this.tour.next();
                    }
                }
            ]
        });

        // playground-tips: Overview with layout breakdown
        this.tour.addStep({
            id: 'playground-tips',
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">💡 Playground Overview</h3>
                <p style="margin: 0 0 10px 0; line-height: 1.6;">
                    The Playground is a full <strong>in-browser Java IDE</strong>. Here's what you get:
                </p>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.9; font-size: 14px;">
                    <li>📁 <strong>Multi-file tabs</strong> — create and switch between multiple <code>.java</code> files</li>
                    <li>🎨 <strong>Monaco Editor</strong> — the same engine powering VS Code, with syntax highlighting</li>
                    <li>⚡ <strong>Real-time error squiggles</strong> — catch typos before you even run</li>
                    <li>▶️ <strong>One-click execution</strong> — compiles and runs on the server instantly</li>
                    <li>📤 <strong>Output panel</strong> — see <code>stdout</code>, <code>stderr</code>, and compiler errors side by side</li>
                </ul>
            `,
            buttons: [
                { text: 'Back', action: () => this.tour.back(), secondary: true },
                { text: 'Next: Code Editor →', action: () => this.tour.next() }
            ]
        });

        // code-editor: Editor features + auto-fill demo
        this.tour.addStep({
            id: 'code-editor',
            attachTo: { element: '[data-tour="code-editor"]', on: 'right' },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">✨ Code Editor</h3>
                <p style="margin: 0 0 8px 0; line-height: 1.6;">
                    I've auto-filled a demo Java class so you can see the editor in action:
                </p>
                <div style="background: #f0fdf4; padding: 10px 14px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #128C7E;">
                    <code style="font-size: 12px; color: #065f46; white-space: pre-line;">
public class Demo {
  public static void main(String[] args) {
    System.out.println("Hello from CodeTutor!");
    int number = 67;
    System.out.println("Answer: " + number);
  }
}
                    </code>
                </div>
                <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.8; color: #374151;">
                    <li>✏️ You can <strong>edit freely</strong> — try changing the message or the number</li>
                    <li>💾 Files <strong>auto-save</strong> in your session — no data lost on navigation</li>
                    <li>🔁 <strong>Reset</strong> button restores the original template anytime</li>
                </ul>
            `,
            beforeShowPromise: async () => {
                await new Promise(resolve => setTimeout(resolve, 500));
                const demoCode = `public class Demo {\n    public static void main(String[] args) {\n        // Welcome to CodeTutor!\n        System.out.println("Hello from CodeTutor!");\n        System.out.println("Learning Java is fun and easy!");\n\n        // Try modifying this code\n        int number = 67;\n        System.out.println("The answer is: " + number);\n    }\n}`;
                window.dispatchEvent(new CustomEvent('demo-fill-code', { detail: { code: demoCode } }));
                await new Promise(resolve => setTimeout(resolve, 800));
            },
            buttons: [
                { text: 'Back', action: () => this.tour.back(), secondary: true },
                { text: 'Next: Run Code →', action: () => this.tour.next() }
            ]
        });

        // Step 6: Show Run Button — reset every show
        this.tour.addStep({
            id: 'run-button',
            attachTo: { element: '[data-tour="run-button"]', on: 'top' },
            text: this._runStepText(false),
            when: {
                show: () => {
                    // Clean up stale listener
                    if (this._demoOutputHandler) {
                        window.removeEventListener('demo-code-output', this._demoOutputHandler);
                        this._demoOutputHandler = null;
                    }

                    // Defer DOM reset until Shepherd has rendered the step element
                    setTimeout(() => {
                        const step = this.tour.getById('run-button');
                        if (!step?.el) return;
                        const textEl = step.el.querySelector('.shepherd-text');
                        if (textEl) textEl.innerHTML = this._runStepText(false);
                        // Remove any leftover Next button from previous run
                        step.el.querySelector('.tour-next-btn')?.remove();
                    }, 0);

                    this._demoOutputHandler = () => {
                        const step = this.tour.getById('run-button');
                        if (!step?.el) return;

                        // Update text directly in the DOM
                        const textEl = step.el.querySelector('.shepherd-text');
                        if (textEl) textEl.innerHTML = this._runStepText(true);

                        // Add Next button directly to footer
                        const footer = step.el.querySelector('.shepherd-footer');
                        if (footer && !footer.querySelector('.tour-next-btn')) {
                            const btn = document.createElement('button');
                            btn.className = 'shepherd-button shepherd-button-primary tour-next-btn';
                            btn.textContent = 'Next: Quiz →';
                            btn.onclick = () => this.tour.next();
                            footer.appendChild(btn);
                        }

                        window.removeEventListener('demo-code-output', this._demoOutputHandler);
                        this._demoOutputHandler = null;
                    };

                    window.addEventListener('demo-code-output', this._demoOutputHandler);
                },
                hide: () => {
                    if (this._demoOutputHandler) {
                        window.removeEventListener('demo-code-output', this._demoOutputHandler);
                        this._demoOutputHandler = null;
                    }
                }
            },
            buttons: [{ text: '← Back', action: () => this.tour.back(), secondary: true }]
        });

        // Step 7: Navigate to Quiz
        this.tour.addStep({
            id: 'quiz-navigate',
            attachTo: { element: '[data-tour="quiz-link"]', on: 'right' },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">📝 Knowledge Quiz</h3>
                <p style="margin: 0; line-height: 1.6;">Time to test what you've learned! The quiz section provides multiple-choice questions to reinforce your Java knowledge.</p>
            `,
            beforeShowPromise: async () => { await this.navigateTo('/home'); await this.openSidebar(); },
            buttons: [ { text: 'Go to Quiz →', action: async () => { await this.closeSidebar(); await this.navigateTo('/quiz'); this.tour.next(); } } ]
        });

        // Step 8: Show Quiz Features
        this.tour.addStep({
            id: 'quiz-features',
            text: `
    <h3 style="margin: 0 0 10px 0; color: #128C7E;">✨ Quiz Features</h3>
    <p style="margin: 0 0 8px 0; line-height: 1.6;">
        Quizzes are <strong>AI-generated</strong> based on the topics you've studied. Here's how they work:
    </p>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.9; font-size: 14px;">
        <li>☑️ <strong>Select topics</strong> — choose which completed topics to be quizzed on</li>
        <li>🔢 <strong>Multiple Choice</strong> — 4 options per question, one correct answer</li>
        <li>⚡ <strong>Instant Feedback</strong> — correct/wrong shown immediately after each answer</li>
        <li>📝 <strong>Explanations</strong> — every question explains <em>why</em> the answer is right</li>
        <li>📊 <strong>Live Score</strong> — your score updates in real-time as you progress</li>
        <li>🔁 <strong>Retake anytime</strong> — questions are regenerated each time for fresh practice</li>
    </ul>
`,
            buttons: [ { text: 'Back', action: () => this.tour.back(), secondary: true }, { text: 'Next: Tests →', action: () => this.tour.next() } ]
        });

        // Step 9: Navigate to Practical Test
        this.tour.addStep({
            id: 'test-navigate',
            attachTo: { element: '[data-tour="test-link"]', on: 'right' },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">🎯 Practical Tests</h3>
                <p style="margin: 0; line-height: 1.6;">Ready for a real challenge? Practical tests require you to write complete Java programs to solve specific problems.</p>
            `,
            beforeShowPromise: async () => { await this.closeAI(); await this.navigateTo('/home'); await this.openSidebar(); },
            buttons: [ { text: 'Go to Tests →', action: async () => { await this.closeSidebar(); await this.navigateTo('/practical-test'); this.tour.next(); } } ]
        });

        // Step 10: Show Test Features
        this.tour.addStep({
            id: 'test-features',
            text: `
    <h3 style="margin: 0 0 10px 0; color: #128C7E;">✨ Practical Testing System</h3>
    <p style="margin: 0 0 8px 0; line-height: 1.6;">
        Practical tests go beyond multiple choice — you <strong>write real Java code</strong> to solve problems:
    </p>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.9; font-size: 14px;">
        <li>📋 <strong>Problem Statement</strong> — a clear description of what your program must do</li>
        <li>✏️ <strong>In-browser editor</strong> — write your solution in the Monaco editor, same as the Playground</li>
        <li>🧪 <strong>Hidden Test Cases</strong> — your code is run against multiple inputs to verify correctness</li>
        <li>⚙️ <strong>Auto-Grading</strong> — instant pass/fail for each test case with output comparison</li>
        <li>💡 <strong>Hints system</strong> — stuck? Request a hint without revealing the full answer</li>
        <li>🏆 <strong>Completion recorded</strong> — passing marks the subtopic as done on your roadmap</li>
    </ul>
`,
            buttons: [ { text: 'Back', action: () => this.tour.back(), secondary: true }, { text: 'Next: AI Tutor →', action: () => this.tour.next() } ]
        });

        // Step 11: Show AI Tutor
        this.tour.addStep({
            id: 'ai-tutor',
            attachTo: { element: '[data-tour="ai-button"]', on: 'left' },
            text: `
    <h3 style="margin: 0 0 10px 0; color: #128C7E;">🤖 AI Tutor Assistant</h3>
    <p style="margin: 0 0 8px 0; line-height: 1.6;">
        Your <strong>personal Java tutor</strong>, available 24/7 on every page of the app:
    </p>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.9; font-size: 14px;">
        <li>💬 <strong>Ask anything</strong> — "What is polymorphism?", "Why does this code not compile?", etc.</li>
        <li>🐛 <strong>Debug help</strong> — paste your broken code and get a step-by-step diagnosis</li>
        <li>💡 <strong>Concept hints</strong> — get nudged in the right direction without spoiling the answer</li>
        <li>📚 <strong>RAG-powered</strong> — answers are grounded in real Java documentation, not just guesses</li>
        <li>🕘 <strong>Chat history</strong> — all your conversations are saved so you can review them later</li>
    </ul>
`,
            beforeShowPromise: async () => { await this.closeAI(); await this.navigateTo('/home'); await this.closeSidebar(); },
            buttons: [ { text: 'Back', action: () => this.tour.back(), secondary: true }, { text: 'Try AI Chat', action: () => { const aiButton = document.querySelector('[data-tour="ai-button"]'); if (aiButton) aiButton.click(); setTimeout(() => this.tour.next(), 500); } } ]
        });

        // NEW Step 12: Progress Tracker
        this.tour.addStep({
            id: 'progress-tracker',
            attachTo: { element: '[data-tour="progress-display"]', on: 'bottom' },
            text: `
    <h3 style="margin: 0 0 10px 0; color: #128C7E;">📊 Progress Tracking</h3>
    <p style="margin: 0 0 8px 0; line-height: 1.6;">
        This widget in the top bar gives you a <strong>live overview</strong> of your learning journey:
    </p>
    <ul style="margin: 0; padding-left: 20px; line-height: 1.9; font-size: 14px;">
        <li>🔢 <strong>X / 65</strong> — number of subtopics you've marked as complete out of 65 total</li>
        <li>🔵 <strong>Ring chart</strong> — visual percentage fill so you can see progress at a glance</li>
        <li>⚡ <strong>Updates instantly</strong> — completing a quiz, test, or lesson updates the count live</li>
        <li>🗺️ <strong>Linked to Roadmap</strong> — each completed item turns green on the flow diagram</li>
        <li>🎯 <strong>Goal: 100%</strong> — complete all 65 subtopics to fully master the Java curriculum</li>
    </ul>
`,
            beforeShowPromise: async () => { await this.closeAI(); await this.navigateTo('/home'); },
            buttons: [ { text: 'Back', action: () => this.tour.back(), secondary: true }, { text: 'Next: Complete →', action: () => this.tour.next() } ]
        });

        // Step 13: My Work
        this.tour.addStep({
            id: 'my-work',
            attachTo: { element: '[data-tour="my-work-link"]', on: 'right' },
            text: `
<h3 style="margin: 0 0 10px 0; color: #128C7E;">📁 My Work Space</h3>
<p style="margin: 0 0 8px 0; line-height: 1.6;">
    All your learning activity is <strong>automatically saved</strong> to your personal workspace:
</p>
<ul style="margin: 0; padding-left: 20px; line-height: 1.9; font-size: 14px;">
    <li>📝 <strong>Quiz results</strong> — every quiz you complete is saved with your full Q&amp;A review</li>
    <li>🧪 <strong>Test submissions</strong> — your code, score, grade and AI feedback are all stored</li>
    <li>💻 <strong>Playground snippets</strong> — save any code you write with one click</li>
    <li>🔍 <strong>Review anytime</strong> — expand any saved item to revisit questions and your answers</li>
    <li>🗑️ <strong>Delete</strong> — clean up old work you no longer need</li>
</ul>
`,
            beforeShowPromise: async () => {
                await this.closeAI();
                await this.navigateTo('/home');
                await this.openSidebar();
            },
            buttons: [
                { text: 'Back', action: () => this.tour.back(), secondary: true },
                {
                    text: 'See My Work →',
                    action: async () => {
                        await this.closeSidebar();
                        await this.navigateTo('/my-work');
                        this.tour.next();
                    }
                }
            ]
        });

        // Updated Completion step
        this.tour.addStep({
            id: 'complete',
            text: `
                <div style="text-align: center;">
                    <h2 style="margin: 0 0 15px 0; color: #128C7E; font-size: 24px;">🎉 Demo Complete!</h2>
                    <p style="margin: 0 0 15px 0; line-height: 1.6;">You've seen all major CodeTutor features!</p>
                    <div style="background: #f0fdf4; border-left: 4px solid #128C7E; padding: 15px; margin: 15px 0; border-radius: 6px; text-align: left;">
                        Hope you all the best on your Java learning journey. Remember, the key to mastery is consistent practice and curiosity. Dive in, explore the content, ask the AI tutor questions, and most importantly — have fun coding! 🚀
                    </div>
                </div>
            `,
            buttons: [
                { text: 'Restart Demo', action: () => { this.tour.cancel(); setTimeout(() => this.start(), 300); }, secondary: true },
                { text: 'Start Learning! 🚀', action: () => this.tour.complete() }
            ]
        });
    }

    async start() {
        // Rebuild tour each time to reset all mutated step state
        // Close AI chat panel if open before starting tour
        await this.closeAI();
        this.tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shepherd-theme-custom',
                scrollTo: { behavior: 'smooth', block: 'center' },
                cancelIcon: { enabled: true },
                modalOverlayOpeningPadding: 8,
                modalOverlayOpeningRadius: 8
            }
        });
        this.setupSteps();
        this.tour.start();
    }

    cancel() {
        this.tour.cancel();
    }

    _runStepText(done) {
        if (done) {
            return `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">▶️ Run Your Code</h3>
                <p style="margin: 0; line-height: 1.6;">
                    ✅ Output received! Click <strong>Next</strong> to continue.
                </p>
            `;
        }
        return `
            <h3 style="margin: 0 0 10px 0; color: #128C7E;">▶️ Run Your Code</h3>
            <p style="margin: 0; line-height: 1.6;">
                Click the <strong>Run Code</strong> button to compile and execute the demo code.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #f59e0b; font-weight: 600;">
                ⚠️ You must click <strong>Run Code</strong> to proceed.
            </p>
        `;
    }
}
