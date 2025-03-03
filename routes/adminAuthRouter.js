const express = require('express');
const bcrypt = require('bcryptjs');

const router = express.Router();

router.get('/admin/login', async (req, res) => {
    res.render('pages/login');
});

router.post('/admin/login', async (req, res) => {
    let conn;
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    
        const db = req.db;
    
        conn = await db.getConnection();
        
        const [isAdminExist] = await conn.execute('SELECT * FROM admin_users WHERE username = ?', [username]);

        if (!isAdminExist) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const admin = isAdminExist[0];

        const passwordMatch = await bcrypt.compare(password, admin.password);
            
        if (!passwordMatch) return res.redirect('/');
        
        await conn.execute('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [admin.id]);
        
        req.session.admin = { id: admin.id, username: admin.username };

        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'server error' });
    } finally {
        if (conn) conn.release();
    }
});

router.post('/admin/logout', async (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

module.exports = router;