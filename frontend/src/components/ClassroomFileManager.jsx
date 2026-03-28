import { useState, useEffect, useRef } from "react";
import {
  listClassroomFiles,
  uploadClassroomFile,
  deleteClassroomFile,
  downloadClassroomFile,
} from "../services/classroomService";

export default function ClassroomFileManager({ classroomId }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef();

  const refresh = () =>
    listClassroomFiles(classroomId)
      .then(setFiles)
      .catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, [classroomId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Unsupported file type. Please use PDF, DOCX, TXT, or MD.");
      fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress("Uploading & indexing...");

    try {
      await uploadClassroomFile(classroomId, file);
      setUploadProgress("Done!");
      await refresh();
      setTimeout(() => setUploadProgress(""), 2000);
    } catch (err) {
      setError(err.message);
      setUploadProgress("");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileId, filename) => {
    if (!window.confirm(`Delete "${filename}" and remove it from the AI index?`)) return;
    setError("");
    try {
      await deleteClassroomFile(classroomId, fileId);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="file-manager">
      <div className="upload-zone">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: "none" }}
          id={`file-upload-${classroomId}`}
        />
        <label
          htmlFor={`file-upload-${classroomId}`}
          className={`btn-upload ${uploading ? "disabled" : ""}`}
        >
          {uploading ? uploadProgress || "Uploading..." : "+ Upload Document"}
        </label>
        <small className="upload-hint">PDF, DOCX, TXT, MD — max 20MB</small>
      </div>

      {error && <p className="error-text">⚠️ {error}</p>}

      {files.length === 0 ? (
        <div className="empty-state">
          <p>No documents uploaded yet.</p>
          <small>Upload a document above to make it available to students and the AI.</small>
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
              <div className="file-actions">
                <button
                  className="btn-sm"
                  onClick={() =>
                    downloadClassroomFile(classroomId, f.id, f.filename)
                  }
                >
                  Download
                </button>
                <button
                  className="btn-sm btn-danger"
                  onClick={() => handleDelete(f.id, f.filename)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
