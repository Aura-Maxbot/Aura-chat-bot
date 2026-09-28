const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export async function fetchUserRole(maxId) {
    const response = await fetch(`${API_URL}/api/staff/by-max-id/${maxId}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

export async function addStaff(companyId, role, phone, fullName) {
    const response = await fetch(`${API_URL}/api/staff/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            company_id: companyId,
            role,
            phone,
            full_name: fullName,
        }),
    });
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

export async function fetchStaffList(companyId) {
    const response = await fetch(`${API_URL}/api/staff/by-company/${companyId}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}