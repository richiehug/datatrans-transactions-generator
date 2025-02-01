const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
const logFilePath = path.join(logDir, 'log.txt');

// Ensure the logs folder exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Ensure log file exists
if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, '');
}

const logMessage = (message) => {
    console.log(message);
    fs.appendFileSync(logFilePath, message + '\n\n');
};

module.exports = { logMessage };
