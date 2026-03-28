import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  listClassroomFiles,
  downloadClassroomFile,
  askClassroom,
} from "../services/classroomService";

export default function StudentClassroomDetail() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("materials");
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    setLoadingFiles(true);
    listClassroomFiles(classroomId)
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoadingFiles(false));
  }, [classroomId]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const result = await askClassroom(classroomId, question);
      setAnswer(result);
    } catch (err) {
      setAnswer({ answer: "Error: " + err.message, has_context: false, sources_count: 0 });
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="classroom-detail-page">
      <button className="btn-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "materials" ? "active" : ""}`}
          onClick={() => setTab("materials")}
        >
          📄 Materials
        </button>
        <button
          className={`tab-btn ${tab === "ask" ? "active" : ""}`}
          onClick={() => setTab("ask")}
        >
          💬 Ask AI
        </button>
      </div>

      {tab === "materials" && (
        <div className="materials-panel">
          {loadingFiles ? (
            <p className="loading-text">Loading materials...</p>
          ) : files.length === 0 ? (
            <div className="empty-state">
              <p>📂 No materials uploaded yet.</p>
              <small>Your teacher hasn't uploaded any documents for this classroom.</small>
            </div>
          ) : (
            <div className="file-list">
              {files.map((f) => (
                <div key={f.id} className="file-row">
                  <span className="file-icon">
                    {f.mime_type?.includes("pdf") ? "📄" : "📝"}
                  </span>
                  <div className="file-info">
                    <span className="file-name">{f.filename}</span>
                    <span className="file-date">
                      {f.uploaded_at
                        ? new Date(f.uploaded_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <button
                    className="btn-download"
                    onClick={() =>
                      downloadClassroomFile(classroomId, f.id, f.filename)
                    }
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "ask" && (
        <div className="ask-panel">
          <p className="ask-hint">
            Ask a question about the classroom materials. The AI will answer based
            on what your teacher has uploaded.
          </p>
          <form onSubmit={handleAsk} className="ask-form">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What is the difference between an interface and an abstract class in Java?"
              rows={4}
              disabled={asking}
            />
            <button type="submit" className="btn-ask" disabled={asking || !question.trim()}>
              {asking ? "Thinking..." : "Ask"}
            </button>
          </form>

          {answer && (
            <div className="answer-card">
              <p className="answer-text">{answer.answer}</p>
              {answer.has_context ? (
                <small className="context-badge">
                  ✓ Based on {answer.sources_count} classroom document excerpt(s)
                </small>
              ) : (
                <small className="context-badge no-context">
                  ℹ️ No classroom documents available — answered from general knowledge
                </small>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
