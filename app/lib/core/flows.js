const { transactionOperations } = require('../api/handlers');
const { getRandomNumber } = require('../utils/helpers');

const flowHandlers = {
    decline: async () => {},
    authorizeAutoCapture: async () => {},
    authorizeNoCapture: async () => {},
    
    authorizeCancel: async (merchantConfig, transactionId) => {
        await transactionOperations.cancel(merchantConfig, transactionId);
    },
    
    authorizeCapture: async (merchantConfig, transactionId, amount, currency, refNo) => {
        await transactionOperations.capture(merchantConfig, transactionId, amount, currency, refNo);
    },
    
    authorizeCaptureRefund: async (merchantConfig, transactionId, amount, currency, refNo) => {
        await transactionOperations.capture(merchantConfig, transactionId, amount, currency, refNo);
        await transactionOperations.credit(merchantConfig, transactionId, amount, currency, refNo + '-ref');
    },
    
    authorizeCaptureRefundPartial: async (merchantConfig, transactionId, amount, currency, refNo) => {
        const refundAmount = Math.min(amount * merchantConfig.limits.refund / 100, amount);
        await transactionOperations.capture(merchantConfig, transactionId, amount, currency, refNo);
        await transactionOperations.credit(merchantConfig, transactionId, refundAmount, currency, refNo + '-ref');
    },
    
    authorizeTopUp: async (merchantConfig, transactionId, amount, currency, refNo) => {
        const topUpAmount = Math.min(amount * merchantConfig.limits.topUp / 100, amount);
        await transactionOperations.increase(merchantConfig, transactionId, topUpAmount, currency, refNo + '-inc');
    },
    
    authorizeTopUpCapture: async (merchantConfig, transactionId, amount, currency, refNo) => {
        const topUpAmount = Math.min(amount * merchantConfig.limits.topUp / 100, amount);
        await transactionOperations.increase(merchantConfig, transactionId, topUpAmount, currency, refNo + '-inc');
        await transactionOperations.capture(merchantConfig, transactionId, amount + topUpAmount, currency, refNo);
    },
    
    authorizeTopUpCaptureRefund: async (merchantConfig, transactionId, amount, currency, refNo) => {
        const topUpAmount = Math.min(amount * merchantConfig.limits.topUp / 100, amount);
        await transactionOperations.increase(merchantConfig, transactionId, topUpAmount, currency, refNo + '-inc');
        await transactionOperations.capture(merchantConfig, transactionId, amount + topUpAmount, currency, refNo);
        await transactionOperations.credit(merchantConfig, transactionId, amount + topUpAmount, currency, refNo + '-ref');
    },
    
    authorizeAutoCaptureRefundMany: async (merchantConfig, transactionId, amount, currency, refNo) => {
        await transactionOperations.capture(merchantConfig, transactionId, amount, currency, refNo);
        
        const numberOfRefunds = getRandomNumber(2, 4);
        let remainingAmount = amount;
        
        for (let i = 1; i <= numberOfRefunds; i++) {
            const maxRefund = remainingAmount - (numberOfRefunds - i);
            const refundAmount = i === numberOfRefunds
                ? remainingAmount
                : getRandomNumber(1, Math.floor(maxRefund));
            
            await transactionOperations.credit(merchantConfig, transactionId, refundAmount, currency, `${refNo}-ref${i}`);
            remainingAmount -= refundAmount;
        }
    },
    
    authorizeTopUpManyCapture: async (merchantConfig, transactionId, amount, currency, refNo) => {
        let totalAmount = amount;
        const numberOfTopups = getRandomNumber(2, 4);
        
        for (let i = 1; i <= numberOfTopups; i++) {
            const topupAmount = getRandomNumber(
                Math.floor(amount * 0.1),
                Math.floor(amount * merchantConfig.limits.topUp / 100)
            );
            
            await transactionOperations.increase(merchantConfig, transactionId, topupAmount, currency, `${refNo}-inc${i}`);
            totalAmount += topupAmount;
        }
        
        await transactionOperations.capture(merchantConfig, transactionId, totalAmount, currency, refNo);
    },
    
    authorizeCapturePartialRefund: async (merchantConfig, transactionId, amount, currency, refNo) => {
        const captureAmount = getRandomNumber(
            Math.floor(amount * 0.5),
            Math.floor(amount * 0.9)
        );
        await transactionOperations.capture(merchantConfig, transactionId, captureAmount, currency, refNo);
        await transactionOperations.credit(merchantConfig, transactionId, captureAmount, currency, `${refNo}-ref`);
    }
};

module.exports = { flowHandlers };