const express = require('express');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
    let conn;
    try {
        const db = req.db;

        conn = await db.getConnection();

        const [users] = await conn.execute('SELECT * FROM platform_users');
        const [games] = await conn.execute('SELECT * FROM games');
        const [game_scores] = await conn.execute('SELECT * FROM game_scores');
        const [game_versions] = await conn.execute('SELECT * FROM game_versions');

        const users_count = users.length;
        const games_count = games.length;
        const scores_count = game_scores.length;
        const game_versions_count = game_versions.length;

        res.render('pages/dashboard', 
            { 
                admin: req.session.admin, 
                users_count: users_count, 
                games_count: games_count, 
                game_versions_count: game_versions_count, 
                scores_count: scores_count 
            });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'server error' });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/users', async (req, res) => {
    let conn;
    try {
        const db = req.db;

        conn = await db.getConnection();

        const [users] = await conn.query('SELECT * FROM platform_users');

        res.render('pages/users', { users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'server error' });
    } finally {
        if (conn) conn.release();
    }

});

router.get('/users/:username', async (req, res) => {
    let conn;
    try {
        const { username } = req.params;

        const db = req.db;

        conn = await db.getConnection();
    
        const [isUserExist] = await conn.execute('SELECT * FROM platform_users WHERE username = ?', [username]);
        if (isUserExist.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = isUserExist[0];

        res.render('pages/user', { user });
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'server error'});
    } finally {
        if (conn) conn.release();
    }
});

router.get('/users/:username/block', (req, res) => {
    const { username } = req.params;
    res.render('pages/blockUser', { username: username });
});

router.get('/users/:username/unblock', (req, res) => {
    const { username } = req.params;
    res.render('pages/unblockUser', { username: username });
});

router.post('/users/:username/block', async (req, res) => {
    let conn;
    try {        
        const { username } = req.params;
        const { reason } = req.body;
    
        const db = req.db;

        conn = await db.getConnection();
    
        await conn.execute('UPDATE platform_users SET is_blocked = TRUE, block_reason = ? WHERE username = ?', [reason, username]);

        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'server error' });
    } finally {
        if (conn) conn.release();
    }
});

router.post('/users/:username/unblock', async (req, res) => {
    let conn;
    try {        
        const { username } = req.params;
        const { reason } = req.body;
    
        const db = req.db;

        conn = await db.getConnection();
    
        await conn.execute('UPDATE platform_users SET is_blocked = FALSE, block_reason = NULL WHERE username = ?', [username]);

        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'server error' });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/logout', async (req, res) => {
    req.session.destroy(() => {
        res.render('pages/login')
    })
});

module.exports = router;