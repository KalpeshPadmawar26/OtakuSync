const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'test',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('tidb') ? { rejectUnauthorized: false } : undefined
});

async function initDb() {
    try {
        const connection = await pool.getConnection();
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255),
                password VARCHAR(255) NOT NULL,
                preferences JSON DEFAULT NULL,
                notify_mentions BOOLEAN DEFAULT TRUE
            )
        `);

        // Migration for existing tables
        try {
            await connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSON DEFAULT NULL");
            await connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_mentions BOOLEAN DEFAULT TRUE");
        } catch (err) {
            // IF NOT EXISTS might not be supported in older MySQL, ignore if it fails due to column existence
        }

        await connection.query(`
            CREATE TABLE IF NOT EXISTS watchlist (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                anime_id INT NOT NULL,
                anime_data JSON,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_anime (user_id, anime_id)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS watched (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                anime_id INT NOT NULL,
                anime_data JSON,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_anime_watched (user_id, anime_id)
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                room VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Database tables initialized successfully.");
        connection.release();
    } catch (error) {
        console.error("Database initialization failed. Error:", error.message);
    }
}

initDb();

module.exports = pool;
