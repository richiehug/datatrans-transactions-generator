const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const getUTCDateString = () => {
  const now = new Date();
  return format(now, "yyyy-MM-dd'T'HH-mm-ss'Z'");
};

let logFilePath;

const initializeLogger = () => {
  const logFileName = `log-${getUTCDateString()}.txt`;
  logFilePath = path.join(logDir, logFileName);
  fs.writeFileSync(logFilePath, '');
};

initializeLogger();

const logMessage = (message) => {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync(logFilePath, formattedMessage + '\n');
};

module.exports = { logMessage };