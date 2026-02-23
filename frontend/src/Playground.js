import React, { useState, useEffect } from "react";
import Compiler from "./Compiler";
import { ProgressTracker } from "./ProgressTracker";

export default function Playground() {
    const [code, setCode] = useState(`public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java Playground!");
        
        // Write your code here
        
    }
}`);

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
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* ... your existing JSX ... */}
            
            <div data-tour="code-editor">
                <Compiler 
                    code={code} 
                    setCode={setCode}
                    hideRunButton={false}
                    onCodeRun={handleCodeRun}  // Pass this callback
                />
            </div>

            <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#fff9e6',
                borderRadius: '8px',
                border: '1px solid #ffc107'
            }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#f57c00' }}>📚 More Learning Resources:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                    <a href="https://www.w3schools.com/java/" target="_blank" rel="noopener noreferrer" 
                       style={{ color: '#1976D2', textDecoration: 'none' }}>
                        → W3Schools Java Tutorial
                    </a>
                    <a href="https://www.geeksforgeeks.org/java/" target="_blank" rel="noopener noreferrer"
                       style={{ color: '#1976D2', textDecoration: 'none' }}>
                        → GeeksforGeeks Java
                    </a>
                </div>
            </div>
        </div>
    );
}
