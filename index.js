require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const mysql = require('mysql2/promise');

const cors = require('cors');

const authMiddleware = require('./middlewares/authMiddleware');
const adminAuthMiddleware = require('./middlewares/adminAuthMiddleware');

const authRouter = require('./routes/authRouter');
const gameRouter = require('./routes/gameRouter');
const userRouter = require('./routes/userRouter');

const adminRouter = require('./routes/adminRouter');
const adminAuthRouter = require('./routes/adminAuthRouter');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test',
});
const sessionStore = new MySQLStore({}, db);

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false, httpOnly: false, maxAge: 3600000 }
}));

app.use((req, res, next) => {
    req.db = db;
    next();
});

app.use('/', adminAuthRouter);
app.use('/admin', adminAuthMiddleware, adminRouter);

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', authMiddleware, userRouter);
app.use('/api/v1/games', authMiddleware, gameRouter);

app.use((req, res) => {
    res.status(404).json({ status: "not-found", message: "Not found"});
});

app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});