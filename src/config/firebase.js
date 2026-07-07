const admin = require("firebase-admin");

const { initializeApp, cert } = require("firebase-admin");
const serviceAccount = require("../../chat-app-8970a-firebase-adminsdk-fbsvc-3e65f3ebfc.json");

initializeApp({
    credential: cert(serviceAccount),
});

module.exports = admin;