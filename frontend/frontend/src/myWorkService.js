const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('authToken')}`,
});

export const saveWork = async ({ work_type, title, topic_id, content, result_data }) => {
  try {
    const res = await fetch(`${API_BASE}/my-work/save`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ work_type, title, topic_id, content, result_data }),
    });
    return res.json();
  } catch (e) {
    console.error('saveWork failed:', e);
  }
};

export const listWork = async () => {
  try {
    const res = await fetch(`${API_BASE}/my-work/list`, { headers: getHeaders() });
    return res.json();
  } catch (e) {
    console.error('listWork failed:', e);
    return [];
  }
};

export const deleteWork = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/my-work/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  } catch (e) {
    console.error('deleteWork failed:', e);
  }
};
