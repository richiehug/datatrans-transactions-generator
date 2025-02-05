const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

let maxLogSizeMB = null;
let logFilePath;

const setLogSizeLimit = (sizeMB) => {
    if (sizeMB !== undefined && sizeMB !== null) {
        if (!Number.isFinite(sizeMB) || sizeMB <= 0) {
            throw new Error('Invalid log size limit - must be a positive number');
        }
        maxLogSizeMB = sizeMB;
    }
};

const getUTCDateString = () => {
  const now = new Date();
  return format(now, "yyyy-MM-dd'T'HH-mm-ss'Z'");
};

const initializeLogger = () => {
    const logFileName = `log-${getUTCDateString()}.txt`;
    logFilePath = path.join(logDir, logFileName);
    fs.writeFileSync(logFilePath, '');
    enforceLogSizeLimit();
};

const getFolderSize = () => {
    const files = fs.readdirSync(logDir);
    return files.reduce((total, file) => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        return total + stats.size;
    }, 0);
};

const enforceLogSizeLimit = () => {
    if (maxLogSizeMB === null) return;

    const maxBytes = maxLogSizeMB * 1024 * 1024; // Convert MB to bytes

    while (getFolderSize() > maxBytes) {
        const files = fs.readdirSync(logDir)
            .map(file => ({
                file,
                time: fs.statSync(path.join(logDir, file)).mtimeMs
            }))
            .sort((a, b) => a.time - b.time); // Sort by oldest first

        if (files.length > 0) {
            const oldestFile = path.join(logDir, files[0].file);
            fs.unlinkSync(oldestFile); // Delete the oldest log file
        } else {
            break; // No more files to delete
        }
    }
};

const logMessage = (message) => {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;
    console.log(formattedMessage);
    
    fs.appendFileSync(logFilePath, formattedMessage + '\n');
    
    enforceLogSizeLimit(); // Check and enforce size limit after logging
};

module.exports = { logMessage, setLogSizeLimit, initializeLogger };
