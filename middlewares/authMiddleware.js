const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY;

const authenticate = async (req, res, next) => {
    let conn;
    try {
        const db = req.db;
        conn = await db.getConnection();

        const token = req.header('Authorization')?.split(' ')[1];
        if (!token) return res.status(401).json({ status: "unauthenticated", message: 'Missing token' });
        const isTokenExist = await conn.execute('SELECT * FROM api_tokens WHERE token = ?', [token]);
        if (!isTokenExist[0][0]) return res.status(401).json({ status: "unauthenticated", message: 'Invalid token' });
    
        jwt.verify(token, SECRET_KEY, (err, user) => {
            if (err) return res.status(401).json({ status: "unauthenticated", message: 'Invalid token' });
            req.user = user;
            next();
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'server error' });
    } finally {
        if (conn) conn.release();
    }

};  

module.exports = authenticate;
