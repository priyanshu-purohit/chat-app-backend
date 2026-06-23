const express = require('express');
const cors = require('cors');

const app = express();

const authRoutes = require('./routes/authRoutes');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);


app.get('/working', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

module.exports = app;