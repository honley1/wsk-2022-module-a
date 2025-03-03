const express = require('express');

const router = express.Router();

router.get('/:username', async (req, res) => {
    let conn;
    try {
        const { username } = req.params;
        const db = req.db;

        conn = await db.getConnection();

        const [userResults] = await conn.execute(
            'SELECT id, username, registered_at FROM platform_users WHERE username = ?',
            [username]
        );

        if (userResults.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResults[0];

        const [gameResults] = await conn.execute(
            'SELECT slug, title, description FROM games WHERE author = ?',
            [username]
        );

        const [scoreResults] = await conn.execute(`
            SELECT gs.score, gs.timestamp, g.slug, g.title, g.description 
            FROM game_scores gs
            JOIN game_versions gv ON gs.game_version_id = gv.id
            JOIN games g ON gv.game_id = g.id
            WHERE gs.user_id = ?
            ORDER BY gs.score DESC
        `, [user.id]);

        res.status(200).json({
            username: user.username,
            registeredTimestamp: user.registered_at,
            authoredGames: gameResults,
            highscores: scoreResults.map(score => ({
                game: {
                    slug: score.slug,
                    title: score.title,
                    description: score.description
                },
                score: score.score,
                timestamp: score.timestamp
            }))
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
