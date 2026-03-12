import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";

function LessonLayout() {
    const [files, setFiles] = useState([]);
    const location = useLocation();
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

    useEffect(() => {
        fetch(`${API_BASE}/lessons`)
            .then((res) => res.json())
            .then((data) => setFiles(data));
    }, []);

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-1/4 bg-gray-100 p-4 border-r overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Lesson List</h2>
                <ul className="space-y-2">
                    {files.map((file, i) => (
                        <li key={i}>
                            <Link
                                className={`block px-3 py-2 rounded hover:bg-gray-200 transition ${
                                    location.pathname.includes(encodeURIComponent(file)) ? "bg-gray-300" : ""
                                }`}
                                to={`/lessons/${encodeURIComponent(file)}`}
                            >
                                {file}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Main content */}
            <div className="flex-1 p-6 overflow-y-auto">
                <Outlet />
            </div>
        </div>
    );
}

export default LessonLayout;
