const express = require('express');
const cors = require('cors');

const app = express();

const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
const userRoutes = require('./routes/userRoutes');

const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(apiLimiter);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/users', userRoutes);


app.get('/working', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

module.exports = app;