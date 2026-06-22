require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

connectDB();

// Create HTTP server
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});
