const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function fetchUserRole(maxId) {
    const response = await fetch(`${API_URL}/api/staff/by-max-id/${maxId}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}