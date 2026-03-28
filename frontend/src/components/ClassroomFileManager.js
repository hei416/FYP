import React, { useState, useEffect, useRef } from 'react';
import {
  listClassroomFiles,
  uploadClassroomFile,
  deleteClassroomFile,
  downloadClassroomFile,
} from '../classroomService';

/**
 * Teacher-facing file manager for a single classroom.
 * Drop this component inside the teacher dashboard wherever you show classroom details.
 *
 * Usage:  <ClassroomFileManager classroomId={classroom.id} />
 */
export default function ClassroomFileManager({ classroomId }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef();

  const refresh = () =>
    listClassroomFiles(classroomId).then(setFiles).catch(console.error);

  useEffect(() => {
    refresh();
  }, [classroomId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setUploadProgress(`Uploading ${file.name}…`);
    try {
      await uploadClassroomFile(classroomId, file);
      setUploadProgress('');
      await refresh();
    } catch (err) {
      setError(err.message);
      setUploadProgress('');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId, filename) => {
    if (!window.confirm(`Delete "${filename}" and its AI index?`)) return;
    try {
      await deleteClassroomFile(classroomId, fileId);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('pdf')) return '\uD83D\uDCC4';
    if (mimeType?.includes('word') || mimeType?.includes('docx')) return '\uD83D\uDCDD';
    return '\uD83D\uDCCB';
  };

  const styles = {
    wrapper: { fontFamily: 'inherit' },
    uploadZone: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      border: '2px dashed #D1D5DB',
      borderRadius: 10,
      marginBottom: 16,
      background: '#F9FAFB',
    },
    uploadLabel: {
      display: 'inline-block',
      padding: '8px 18px',
      background: uploading ? '#93C5FD' : '#2563EB',
      color: '#fff',
      borderRadius: 7,
      cursor: uploading ? 'not-allowed' : 'pointer',
      fontWeight: 600,
      fontSize: 14,
      transition: 'background 0.15s',
      userSelect: 'none',
    },
    uploadHint: { fontSize: 12, color: '#9CA3AF' },
    progressText: { fontSize: 13, color: '#2563EB', fontStyle: 'italic' },
    errorText: {
      padding: '8px 12px',
      background: '#FEF2F2',
      border: '1px solid #FECACA',
      borderRadius: 6,
      color: '#DC2626',
      fontSize: 13,
      marginBottom: 12,
    },
    fileRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      border: '1px solid #E5E7EB',
      borderRadius: 8,
      marginBottom: 8,
      background: '#fff',
    },
    fileName: { flex: 1, fontWeight: 500, fontSize: 13, wordBreak: 'break-all' },
    fileDate: { color: '#9CA3AF', fontSize: 12, whiteSpace: 'nowrap' },
    btnSm: {
      padding: '5px 12px',
      border: '1px solid #D1D5DB',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 12,
      background: '#fff',
      color: '#374151',
    },
    btnDanger: {
      padding: '5px 12px',
      border: '1px solid #FECACA',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 12,
      background: '#FFF5F5',
      color: '#DC2626',
    },
    empty: { textAlign: 'center', color: '#9CA3AF', padding: '32px 0', fontSize: 14 },
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.uploadZone}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: 'none' }}
          id={`file-upload-${classroomId}`}
        />
        <label
          htmlFor={`file-upload-${classroomId}`}
          style={styles.uploadLabel}
          title="Upload a PDF, DOCX, TXT, or MD file (max 20 MB)"
        >
          {uploading ? 'Indexing…' : '+ Upload Document'}
        </label>
        {uploadProgress ? (
          <span style={styles.progressText}>{uploadProgress}</span>
        ) : (
          <span style={styles.uploadHint}>PDF, DOCX, TXT, MD — max 20 MB</span>
        )}
      </div>

      {error && <div style={styles.errorText}>{error}</div>}

      <div>
        {files.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
            <p>No documents uploaded yet.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Uploaded files will be indexed for student AI queries.</p>
          </div>
        ) : (
          files.map((f) => (
            <div key={f.id} style={styles.fileRow}>
              <span style={{ fontSize: 20 }}>{getFileIcon(f.mime_type)}</span>
              <span style={styles.fileName}>{f.filename}</span>
              <span style={styles.fileDate}>
                {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : ''}
              </span>
              <button
                style={styles.btnSm}
                onClick={() => downloadClassroomFile(classroomId, f.id, f.filename)}
              >
                Download
              </button>
              <button
                style={styles.btnDanger}
                onClick={() => handleDelete(f.id, f.filename)}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
