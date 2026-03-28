// ── Classroom File & RAG functions ──────────────────────────────────────────

// Helper: get stored token (adjust if your app stores it differently)
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";

export const uploadClassroomFile = async (classroomId, file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/classrooms/${classroomId}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
    // No Content-Type header — browser sets multipart boundary automatically
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const listClassroomFiles = async (classroomId) => {
  const res = await fetch(`/classrooms/${classroomId}/files`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const downloadClassroomFile = (classroomId, fileId, filename) => {
  const a = document.createElement("a");
  a.href = `/classrooms/${classroomId}/files/${fileId}/download`;
  a.download = filename;
  // Include auth header via a hidden form if needed, or rely on cookie auth
  // For Bearer token auth, open in new tab so the browser sends the request with a fresh token header
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const deleteClassroomFile = async (classroomId, fileId) => {
  const res = await fetch(`/classrooms/${classroomId}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const askClassroom = async (classroomId, question) => {
  const res = await fetch(`/classrooms/${classroomId}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ question, mode: "classroom" }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
