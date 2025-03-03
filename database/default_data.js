require('dotenv').config();
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'test',
});

db.connect(err => {
    if (err) {
        console.error('❌ Ошибка подключения к базе:', err);
        return;
    }
    console.log('✅ Подключение к базе установлено');
});

const createAdmin = async (username, password) => {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            'INSERT INTO admin_users (username, password) VALUES (?, ?)',
            [username, hashedPassword],
            (err, result) => {
                if (err) {
                    console.error('❌ Ошибка при создании админа:', err);
                    return;
                }
                console.log(`✅ Админ ${username} успешно создан!`);
                db.end();
            }
        );
    } catch (error) {
        console.error('❌ Ошибка при хэшировании пароля:', error);
    }
};

createAdmin('admin1', 'hellouniverse1!');
createAdmin('admin2', 'hellouniverse2!');

createUser('player1', 'helloworld1!');
createUser('player2', 'helloworld2!');
createUser('dev1', 'hellobyte1!');
createUser('dev2', 'hellobyte2!');