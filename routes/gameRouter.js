const express = require('express');
const fileUpload = require("express-fileupload");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");

const router = express.Router();
router.use(fileUpload());

router.get('/', async (req, res) => {
    let conn;
    try {
        const db = req.db;
        
        let page = parseInt(req.query.page) || 0;
        let size = parseInt(req.query.size) || 10;
        let sortBy = req.query.sortBy || 'title';
        let sortDir = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';

        if (page < 0) page = 0;
        if (size < 1) size = 10;
        if (!['title', 'popular', 'uploaddate'].includes(sortBy)) sortBy = 'title';

        conn = await db.getConnection();

        let orderByField;
        switch (sortBy) {
            case 'title':
                orderByField = 'g.title';
                break;
            case 'popular':
                orderByField = 'score_count';
                break;
            case 'uploaddate':
                orderByField = 'latest_upload';
                break;
        }

        const [[{ totalElements }]] = await conn.execute(`
            SELECT COUNT(DISTINCT g.id) AS totalElements
            FROM games g
            JOIN game_versions gv ON g.id = gv.game_id
        `);

        const [games] = await conn.execute(`
            SELECT 
                g.slug,
                g.title,
                g.description,
                g.author_id,
                u.username AS author,
                (SELECT path_to_files FROM game_versions WHERE game_id = g.id ORDER BY created_at DESC LIMIT 1) AS thumbnail,
                (SELECT MAX(created_at) FROM game_versions WHERE game_id = g.id) AS latest_upload,
                (SELECT COUNT(*) FROM game_scores gs JOIN game_versions gv ON gs.game_version_id = gv.id WHERE gv.game_id = g.id) AS score_count
            FROM games g
            JOIN platform_users u ON g.author_id = u.id
            JOIN game_versions gv ON g.id = gv.game_id
            GROUP BY g.id
            ORDER BY ${orderByField} ${sortDir}
            LIMIT ? OFFSET ?
        `, [size, page * size]);

        res.status(200).json({
            page,
            size: games.length,
            totalElements,
            content: games.map(game => ({
                slug: game.slug,
                title: game.title,
                description: game.description,
                thumbnail: game.thumbnail ? `/games/${game.slug}/latest/thumbnail.png` : null,
                uploadTimestamp: game.latest_upload,
                author: game.author,
                scoreCount: game.score_count
            }))
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
});

router.post('/', async (req, res) => {
    let conn;
    try {
        const { title, description } = req.body;

        const user = req.user;

        if (title.length < 3 || title.length > 60) return res.status(400).json({ status: 'invalid', message: 'invalid title length' });
        if (description.length < 0 || description.length > 200) return res.status(400).json({ status: 'invalid', message: 'invalid description length' });

        const db = req.db;

        conn = await db.getConnection();

        const slug = String(title).toLowerCase().replace(' ', '-');

        const isSlugExists = await conn.execute('SELECT slug FROM games WHERE slug = ?', [slug])[0];

        if (isSlugExists) return res.status(400).json({ status: 'invalid', slug: 'Game title already exists' });

        await conn.execute('INSERT INTO games (title, description, slug, author_id) VALUES (?, ?, ?, ?)', [title, description, slug, user.id]);

        return res.status(201).json({ status: 'success', slug });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/:slug', async (req, res) => {
    let conn;
    try {
        const { slug } = req.params;

        const db = req.db;

        conn = await db.getConnection();

        const [games] = await conn.execute('SELECT * FROM games WHERE slug = ? LIMIT 1', [slug]);

        if (games.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const game = games[0];

        return res.status(200).json(game);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        if (conn) conn.release();
    }
});

router.post('/:slug/upload', async (req, res) => {
    let conn;
    try {
        const { slug } = req.params;
        const zipFile = req.files?.zipfile;
        const user = req.user;
        const db = req.db;

        conn = await db.getConnection();

        if (!zipFile) return res.status(400).send("No file uploaded");

        const [games] = await conn.execute('SELECT * FROM games WHERE slug = ?', [slug]);
        if (games.length === 0) return res.status(404).send("Game not found");

        const game = games[0];
        
        if (game.author !== user.username) return res.status(403).send("You are not the game author");

        const newVersion = game.versions.length + 1;
        const gamePath = path.join(__dirname, "public/games", slug, String(newVersion));

        fs.mkdirSync(gamePath, { recursive: true });
        await zipFile.mv(`${gamePath}/game.zip`);
        fs.createReadStream(`${gamePath}/game.zip`).pipe(unzipper.Extract({ path: gamePath }));
        fs.unlinkSync(`${gamePath}/game.zip`);

        let thumbnailPath = null;
        if (fs.existsSync(path.join(gamePath, "thumbnail.png"))) {
            thumbnailPath = `/games/${slug}/${newVersion}/thumbnail.png`;
        }

        await conn.execute('INSERT INTO game_versions (game_id, versions, path_to_files, thumbnail_path) VALUES (?, ?, ?, ?)', [game.id, newVersion, `/games/${slug}/${newVersion}/`, thumbnailPath]);

        res.status(201).send("Game version uploaded successfully");
    } catch (error) {
        console.error(error);
        res.status(500).send("Unspecified IO error");
    } finally {
        if (conn) conn.release();
    }
});

router.put('/:slug', async (req, res) => {
    let conn;
    try {
        const { slug } = req.params;
        const { title, description } = req.body;
        const db = req.db;
        const user = req.user;

        conn = await db.getConnection();

        const [games] = await conn.execute('SELECT * FROM games WHERE slug = ?', [slug]);
        if (games.length === 0) return res.status(404).send("Game not found");

        const game = games[0];
        
        if (game.author !== user.username) {
            return res.status(403).json({ status: "forbidden", message: "You are not the game author" });
        }

        await conn.execute('UPDATE games SET title = ?, description = ? WHERE slug = ?', [title, description, slug]);
        res.status(200).json({ status: "success" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    } finally {
        if (conn) conn.release();
    }
});

router.delete('/:slug', async (req, res) => {
    let conn;
    try {
        const { slug } = req.params;
        const db = req.db;
        const user = req.user;

        conn = await db.getConnection();

        const [games] = await conn.execute('SELECT * FROM games WHERE slug = ?', [slug]);
        if (games.length === 0) return res.status(404).send("Game not found");

        const game = games[0];
        
        if (game.author !== user.username) {
            return res.status(403).json({ status: "forbidden", message: "You are not the game author" });
        }

        await conn.execute('DELETE FROM games WHERE slug = ?', [slug]);
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/:slug/scores', async (req, res) => {
    let conn;
    try {
        const { slug } = req.params;

        const db = req.db;

        conn = await db.getConnection();

        const [games] = await conn.execute('SELECT * FROM games WHERE slug = ?', [slug]);

        if (games.length === 0) {
            return res.status(400).json({ message: "game not found" });
        }

        const game = games[0];

        const [game_versions] = await conn.execute('SELECT * FROM game_versions WHERE game_id = ?', [game.id]);

        let scoreResult = [];

        for (const game_version of game_versions) {
            const [scores] = await conn.execute('SELECT * FROM game_scores WHERE game_version_id = ?', [game_version.id]);
            scoreResult = scoreResult.concat(scores);
        }

        return res.status(200).json({ scores: scoreResult });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    } finally {
        if (conn) conn.release();
    }
});

router.use('/:slug/:version/', (req, res, next) => {
    const { slug, version } = req.params;
    const gamePath = path.join(__dirname, "..", "public/games", slug, version);

    express.static(gamePath)(req, res, next);
});

router.get('/:slug/:version/', (req, res) => {
    const { slug, version } = req.params;
    const indexPath = path.join(__dirname, "..", "public/games", slug, version, "index.html");

    res.sendFile(indexPath, (err) => {
        if (err) res.status(404).send("Game not found");
    });
});

module.exports = router;
