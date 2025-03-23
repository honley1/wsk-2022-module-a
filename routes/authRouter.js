const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/signup', async (req, res) => {
    let conn;
    try {
        const { username, password } = req.body;
        if (!username || !password || username.length < 4 || username.length > 60 || password.length < 6) {
            return res.status(401).json({ status: "invalid", message: "Wrong username or password" });
        }

        const db = req.db;
        conn = await db.getConnection();

        const hashedPassword = await bcrypt.hash(password, 10);

        const [existingUsers] = await conn.execute('SELECT * FROM platform_users WHERE username = ?', [username]);
        if (existingUsers.length >= 1) {
            return res.status(409).json({ status: "invalid", message: "User already exists" });
        }

        const [result] = await conn.execute(
            'INSERT INTO platform_users (username, password) VALUES(?, ?)',
            [username, hashedPassword]
        );

        const token = jwt.sign({ id: result.insertId, username: username, is_blocked: false }, process.env.SECRET_KEY, { expiresIn: '1h' });

        await conn.execute('INSERT INTO api_tokens (token, user_id) VALUES (?, ?)', [token, result.insertId]);

        res.status(201).json({ status: 'success', token: token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'User already exists' });
    } finally {
        if (conn) conn.release();
    }
});

router.post('/signin', async (req, res) => {
    let conn;
    try {
        const { username, password } = req.body;
        if (!username || !password || username.length   < 4 || username.length > 60 || password.length < 6) {
            return res.status(401).json({ status: "invalid", message: "Wrong username or password" });
        }

        const db = req.db;
        conn = await db.getConnection();

        const [users] = await conn.execute('SELECT * FROM platform_users WHERE username = ?', [username]);

        const user = users[0];

        if (!user) {
            return res.status(401).json({ status: "invalid", message: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ status: "invalid", message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, is_blocked: user.is_blocked }, process.env.SECRET_KEY, { expiresIn: '1h' });

        const [existingTokens] = await conn.execute('SELECT * FROM api_tokens WHERE user_id = ?', [user.id]);

        if (existingTokens.length > 0) {
            await conn.execute('DELETE FROM api_tokens WHERE user_id = ?', [user.id]);
        }

        await conn.execute('INSERT INTO api_tokens (token, user_id) VALUES (?, ?)', [token, user.id]);
        await conn.execute('UPDATE platform_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

        res.status(200).json({ success: true, token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
});

router.post('/signout', async (req, res) => {
    let conn;
    try {
        const db = req.db;
        conn = await db.getConnection();

        await conn.execute('DELETE FROM api_tokens WHERE token = ?', [req.body.token]);

        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
