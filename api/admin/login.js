import { redis } from '../user/state.js';

const ADMIN_PASSWORD = 'Rajas';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
        res.status(200).json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
}
