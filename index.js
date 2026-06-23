require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { initSocket } = require('./src/config/socket'); // Import our socket config

const PORT = process.env.PORT || 5000;

connectDB();

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.io to HTTP server
const io = initSocket(server);


// Start listening
server.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
});
