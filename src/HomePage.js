import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function HomePage() {
    const [lessons, setLessons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch("http://localhost:8000/lessons")
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                // Sort lessons alphabetically or numerically if they have a consistent naming convention
                const sortedLessons = data.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                setLessons(sortedLessons);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to load lessons:", err);
                setError(err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-6 text-center">Loading Java Learning Roadmap...</div>;
    }

    if (error) {
        return <div className="p-6 text-center text-red-500">Error loading roadmap: {error.message}</div>;
    }

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-4xl font-bold text-center mb-10 text-indigo-800">Java Learning Roadmap</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lessons.map((lessonId) => (
                    <div key={lessonId} className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out overflow-hidden">
                        <Link to={`/lessons/${lessonId}`} className="block p-6">
                            <h2 className="text-xl font-semibold mb-2 text-gray-800 hover:text-indigo-600">
                                {lessonId.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                            </h2>
                            <p className="text-gray-600 text-sm">Explore this lesson to deepen your Java knowledge.</p>
                            <div className="mt-4 text-indigo-500 hover:text-indigo-700 font-medium">
                                Start Learning &rarr;
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
            {lessons.length === 0 && (
                <p className="text-center text-gray-600 mt-8">No lessons available yet. Please check back later!</p>
            )}
        </div>
    );
}

export default HomePage;
