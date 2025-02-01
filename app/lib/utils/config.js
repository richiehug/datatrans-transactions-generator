const fs = require('fs');
const path = require('path');

const loadConfig = () => {
    const configPath = path.join(__dirname, '../../config/config.json');
    const methodsPath = path.join(__dirname, '../../config/payment_methods.json');
    
    return {
        config: JSON.parse(fs.readFileSync(configPath)),
        savedMethods: JSON.parse(fs.readFileSync(methodsPath))
    };
};

module.exports = { loadConfig };