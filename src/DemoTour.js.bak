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
        // Step 1: Welcome
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
                        <strong>Duration:</strong> ~2 minutes | <strong>Steps:</strong> 8
                    </p>
                </div>
            `,
            buttons: [
                {
                    text: 'Skip Tour',
                    action: () => this.tour.cancel(),
                    secondary: true
                },
                {
                    text: 'Start Demo →',
                    action: () => this.tour.next()
                }
            ]
        });

        // Step 2: Highlight Playground Link
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

        // Step 4: Show Playground Overview (floating — no fixed element)
        this.tour.addStep({
            id: 'playground-tips',
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">💡 Playground Overview</h3>
                <p style="margin: 0; line-height: 1.6;">
                    The playground supports <strong>multiple Java files</strong> side by side.
                    The Monaco editor provides syntax highlighting and real-time error detection!
                </p>
            `,
            buttons: [
                {
                    text: 'Back',
                    action: () => this.tour.back(),
                    secondary: true
                },
                {
                    text: 'Next: Code Editor →',
                    action: () => this.tour.next()
                }
            ]
        });

        // Step 5: Show Code Editor & Auto-fill
        this.tour.addStep({
            id: 'code-editor',
            attachTo: {
                element: '[data-tour="code-editor"]',
                on: 'right'
            },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">✨ Code Editor</h3>
                <p style="margin: 0 0 10px 0; line-height: 1.6;">
                    Watch as I automatically fill in some demo Java code for you...
                </p>
                <div style="background: #f0fdf4; padding: 10px; border-radius: 6px; margin-top: 10px;">
                    <code style="font-size: 12px; color: #128C7E;">
                        System.out.println("Hello from CodeTutor!");
                    </code>
                </div>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">
                    ⌨️ Code auto-filled!
                </p>
            `,
            beforeShowPromise: async () => {
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const demoCode = `public class Demo {
    public static void main(String[] args) {
        // Welcome to CodeTutor!
        System.out.println("Hello from CodeTutor!");
        System.out.println("Learning Java is fun and easy!");
        
        // Try modifying this code
        int number = 67;
        System.out.println("The answer is: " + number);
    }
}`;
                
                const event = new CustomEvent('demo-fill-code', {
                    detail: { code: demoCode }
                });
                window.dispatchEvent(event);
                
                await new Promise(resolve => setTimeout(resolve, 800));
            },
            buttons: [
                {
                    text: 'Back',
                    action: () => this.tour.back(),
                    secondary: true
                },
                {
                    text: 'Next: Run Code →',
                    action: () => this.tour.next()
                }
            ]
        });

        // Step 6: Show Run Button — user must click Run, Next appears after output
        this.tour.addStep({
            id: 'run-button',
            attachTo: {
                element: '[data-tour="run-button"]',
                on: 'top'
            },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">▶️ Run Your Code</h3>
                <p style="margin: 0; line-height: 1.6;" id="run-step-desc">
                    Click the <strong>Run Code</strong> button below to compile and execute the demo code.
                </p>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #f59e0b; font-weight: 600;" id="run-step-hint">
                    ⚠️ You must click <strong>Run Code</strong> to proceed.
                </p>
            `,
            when: {
                show: () => {
                    if (this._runPollTimer) return;

                    // Poll the DOM for the output <pre> element to appear
                    // This avoids all event listener / overlay click issues
                    this._runPollTimer = setInterval(() => {
                        const outputEl = document.querySelector('[data-tour="code-editor"] pre');
                        if (outputEl && outputEl.textContent && !outputEl.textContent.includes('Running code...')) {
                            clearInterval(this._runPollTimer);
                            this._runPollTimer = null;

                            // Wait a moment so user can read the output
                            setTimeout(() => {
                                const desc = document.getElementById('run-step-desc');
                                const hint = document.getElementById('run-step-hint');
                                if (desc) desc.innerHTML = '✅ Output received! Click <strong>Next</strong> to continue.';
                                if (hint) hint.style.display = 'none';

                                const footer = document.querySelector('.shepherd-footer');
                                if (footer && !footer.querySelector('.demo-next-btn')) {
                                    const nextBtn = document.createElement('button');
                                    nextBtn.textContent = 'Next: Quiz →';
                                    nextBtn.className = 'shepherd-button demo-next-btn';
                                    nextBtn.addEventListener('click', () => this.tour.next());
                                    footer.appendChild(nextBtn);
                                }
                            }, 500);
                        }
                    }, 500);
                },
                hide: () => {
                    if (this._runPollTimer) {
                        clearInterval(this._runPollTimer);
                        this._runPollTimer = null;
                    }
                }
            },
            buttons: [
                {
                    text: '← Back',
                    action: () => this.tour.back(),
                    secondary: true
                }
            ]
        });

        // Step 7: Navigate to Quiz
        this.tour.addStep({
            id: 'quiz-navigate',
            attachTo: {
                element: '[data-tour="quiz-link"]',
                on: 'right'
            },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">📝 Knowledge Quiz</h3>
                <p style="margin: 0; line-height: 1.6;">
                    Time to test what you've learned! The quiz section provides
                    multiple-choice questions to reinforce your Java knowledge.
                </p>
            `,
            beforeShowPromise: async () => {
                await this.navigateTo('/home');
                await this.openSidebar();
            },
            buttons: [
                {
                    text: 'Go to Quiz →',
                    action: async () => {
                        await this.closeSidebar();
                        await this.navigateTo('/quiz');
                        this.tour.next();
                    }
                }
            ]
        });

        // Step 8: Show Quiz Features
        this.tour.addStep({
            id: 'quiz-features',
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">✨ Quiz Features</h3>
                <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Multiple Choice:</strong> Select the correct answer</li>
                    <li><strong>Instant Feedback:</strong> Know immediately if you're right</li>
                    <li><strong>Explanations:</strong> Learn from every question</li>
                    <li><strong>Progress Tracking:</strong> See your score in real-time</li>
                </ul>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">
                    🎯 Quizzes adapt to your learning level
                </p>
            `,
            buttons: [
                {
                    text: 'Back',
                    action: () => this.tour.back(),
                    secondary: true
                },
                {
                    text: 'Next: Tests →',
                    action: () => this.tour.next()
                }
            ]
        });

        // Step 9: Navigate to Practical Test
        this.tour.addStep({
            id: 'test-navigate',
            attachTo: {
                element: '[data-tour="test-link"]',
                on: 'right'
            },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">🎯 Practical Tests</h3>
                <p style="margin: 0; line-height: 1.6;">
                    Ready for a real challenge? Practical tests require you to write
                    complete Java programs to solve specific problems.
                </p>
            `,
            beforeShowPromise: async () => {
                await this.navigateTo('/home');
                await this.openSidebar();
            },
            buttons: [
                {
                    text: 'Go to Tests →',
                    action: async () => {
                        await this.closeSidebar();
                        await this.navigateTo('/practical-test');
                        this.tour.next();
                    }
                }
            ]
        });

        // Step 10: Show Test Features
        this.tour.addStep({
            id: 'test-features',
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">✨ Testing System</h3>
                <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Real Problems:</strong> Solve actual coding challenges</li>
                    <li><strong>Auto-Grading:</strong> Instant validation of your solution</li>
                    <li><strong>Test Cases:</strong> Pass multiple test scenarios</li>
                    <li><strong>Hints Available:</strong> Get help when you're stuck</li>
                </ul>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">
                    ⚡ Your code runs against hidden test cases for thorough validation
                </p>
            `,
            buttons: [
                {
                    text: 'Back',
                    action: () => this.tour.back(),
                    secondary: true
                },
                {
                    text: 'Next: AI Tutor →',
                    action: () => this.tour.next()
                }
            ]
        });

        // Step 11: Show AI Tutor
        this.tour.addStep({
            id: 'ai-tutor',
            attachTo: {
                element: '[data-tour="ai-button"]',
                on: 'left'
            },
            text: `
                <h3 style="margin: 0 0 10px 0; color: #128C7E;">🤖 AI Tutor Assistant</h3>
                <p style="margin: 0 0 10px 0; line-height: 1.6;">
                    Your 24/7 personal Java tutor powered by AI! Click here anytime to:
                </p>
                <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                    <li>Ask questions about Java concepts</li>
                    <li>Get explanations for code snippets</li>
                    <li>Debug your errors</li>
                    <li>Receive personalized hints</li>
                </ul>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">
                    💬 Try asking: "What are Java loops?" or "Explain inheritance"
                </p>
            `,
            beforeShowPromise: async () => {
                await this.navigateTo('/home');
                await this.closeSidebar();
            },
            buttons: [
                {
                    text: 'Back',
                    action: () => this.tour.back(),
                    secondary: true
                },
                {
                    text: 'Try AI Chat',
                    action: () => {
                        const aiButton = document.querySelector('[data-tour="ai-button"]');
                        if (aiButton) aiButton.click();
                        setTimeout(() => this.tour.next(), 500);
                    }
                }
            ]
        });

        // Step 12: Completion
        this.tour.addStep({
            id: 'complete',
            text: `
                <div style="text-align: center;">
                    <h2 style="margin: 0 0 15px 0; color: #128C7E; font-size: 24px;">🎉 Demo Complete!</h2>
                    <p style="margin: 0 0 15px 0; line-height: 1.6;">
                        You've seen all the major features of CodeTutor in action!
                    </p>
                    <div style="background: #f0fdf4; border-left: 4px solid #128C7E; padding: 15px; margin: 15px 0; text-align: left; border-radius: 6px;">
                        <strong style="color: #128C7E; font-size: 16px;">🚀 Your Learning Journey:</strong>
                        <ol style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.8;">
                            <li>Start with <strong>Playground</strong> to practice coding</li>
                            <li>Take <strong>Quizzes</strong> to test your knowledge</li>
                            <li>Solve <strong>Tests</strong> to apply your skills</li>
                            <li>Ask <strong>AI Tutor</strong> whenever you need help!</li>
                        </ol>
                    </div>
                </div>
            `,
            buttons: [
                {
                    text: 'Restart Demo',
                    action: () => {
                        this.tour.cancel();
                        setTimeout(() => this.start(), 300);
                    },
                    secondary: true
                },
                {
                    text: 'Start Learning! 🚀',
                    action: () => this.tour.complete()
                }
            ]
        });
    }

    start() {
        this.tour.start();
    }

    cancel() {
        this.tour.cancel();
    }
}
