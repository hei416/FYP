import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function Lessons() {
    const { id } = useParams();
    const [lesson, setLesson] = useState(null);

    useEffect(() => {
        fetch(`http://localhost:8000/lessons/${id}`)
            .then((res) => res.json())
            .then((data) => {
                console.log("Fetched lesson data:", data); // Debug log
                setLesson(data);
            })
            .catch((err) => console.error("Failed to load lesson:", err));
    }, [id]);

    if (!lesson) return <p className="p-6">Loading...</p>;

    return (
        <div className="grid grid-cols-4 gap-6 p-6">
            {/* Sidebar for navigation (optional, static for now) */}
            <div className="col-span-1 border-r pr-4">
                <h2 className="text-lg font-semibold mb-2">Lesson Navigation</h2>
                <ul className="text-blue-600">
                    {lesson.sections && lesson.sections.map((sec, i) => (
                        <li key={i} className="mb-1">
                            <a href={`#section-${i}`} className="hover:underline">{sec.heading}</a>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Main content */}
            <div className="col-span-3">
                <h1 className="text-3xl font-bold mb-4">{lesson.title}</h1>
                <p className="mb-6 text-gray-700">{lesson.intro}</p>
                {lesson.sections && lesson.sections.map((sec, idx) => (
                    <div key={idx} id={`section-${idx}`} className="mb-8">
                        <h2 className="text-2xl font-semibold mb-2">{sec.heading}</h2>
                        <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap">{sec.content}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Lessons;
