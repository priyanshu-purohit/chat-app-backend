const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/working', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

module.exports = app;