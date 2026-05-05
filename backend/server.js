const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins for the vanilla frontend
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Root Route & Health Check
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: "OtakuSync API is running!", 
        status: "healthy",
        endpoints: ["/api/auth", "/api/user", "/api/anime", "/api/recommendations"]
    });
});

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const animeRoutes = require('./routes/anime');
const recommendationRoutes = require('./routes/recommendation');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/anime', animeRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Socket.io integration
io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('identify', (username) => {
        socket.join(username);
        console.log(`User ${username} joined their own room.`);
    });

    socket.on('joinRoom', async (genre) => {
        if(currentRoom) socket.leave(currentRoom);
        currentRoom = genre;
        socket.join(currentRoom);

        // Fetch last 50 messages
        try {
            const [rows] = await db.query(
                'SELECT username as user, message, created_at as time FROM chat_messages WHERE room = ? ORDER BY created_at ASC LIMIT 50',
                [currentRoom]
            );
            socket.emit('history', rows);
        } catch(e) {
            console.error("Error fetching chat history", e);
        }
    });

    socket.on('sendMessage', async (data) => {
        if(!currentRoom) return;
        const msgObject = {
            user: data.username,
            message: data.message,
            time: new Date()
        };

        // Broadcast to room
        io.to(currentRoom).emit('newMessage', msgObject);

        // Extract Mentions
        const mentionRegex = /@(\w+)/g;
        const mentions = [...data.message.matchAll(mentionRegex)].map(m => m[1]);
        
        if (mentions.length > 0) {
            for (const mention of mentions) {
                if (mention === data.username) continue; // Don't notify self

                try {
                    const [users] = await db.query('SELECT notify_mentions FROM users WHERE username = ?', [mention]);
                    if (users[0] && users[0].notify_mentions) {
                        io.to(mention).emit('mention', {
                            from: data.username,
                            message: data.message
                        });
                    }
                } catch (e) {
                    console.error("Mention delivery failed", e);
                }
            }
        }

        // Store message
        try {
            await db.query(
                'INSERT INTO chat_messages (room, username, message) VALUES (?, ?, ?)',
                [currentRoom, data.username, data.message]
            );
        } catch(e) {
            console.error("Failed to insert message:", e);
        }
    });

    socket.on('disconnect', () => {
        // Automatically handled
    });
});

// Housekeeping: Auto-delete messages older than 24 hours every hour
setInterval(async () => {
    try {
        await db.query('DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL 1 DAY');
        console.log("Cleaned up old chat messages.");
    } catch(e) {
        console.error("Cleanup error:", e);
    }
}, 3600000);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
