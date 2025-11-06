import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./Navbar";
import AI from "./AI";
import Compiler from "./Compiler";
import HomePage from "./HomePage";
import Quiz from "./Quiz";
import PracticalTest from "./PracticalTest";
import Lessons from "./Lessons";
import LessonLayout from "./LessonLayout";

function App() {
    return (
        <Router>
            <Navbar />
            <AI />
            <div style={{ paddingTop: 70 }} className="bg-white min-h-screen">
                <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/compiler" element={<Compiler />} />
                    <Route path="/quiz" element={<Quiz />} />
                    <Route path="/practical-test" element={<PracticalTest />} />
                    <Route path="/lessons" element={<LessonLayout />}>
                        <Route path=":id" element={<Lessons />} />
                    </Route>
                </Routes>
            </div>
        </Router>
    );
}

export default App;
