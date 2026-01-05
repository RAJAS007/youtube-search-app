const ADMIN_PASSWORD = 'Rajas';

export default async function handler(req, res) {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { password } = req.body || {};

        if (password === ADMIN_PASSWORD) {
            res.status(200).json({ success: true });
        } else {
            res.status(401).json({ success: false, error: 'Invalid password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
}
