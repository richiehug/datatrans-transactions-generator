const { v4: uuidv4 } = require('uuid');

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateRefNo = (config) => {
    if (config.referenceNumber.type === 'random') {
        const refNo = uuidv4().replace(/-/g, '').substring(0, getRandomElement(config.referenceNumber.length));
        return config.referenceNumber.prefix ? config.referenceNumber.prefix + refNo : refNo;
    }
    return config.referenceNumber.refno;
};

module.exports = {
    getRandomElement,
    getRandomNumber,
    sleep,
    generateRefNo
};
