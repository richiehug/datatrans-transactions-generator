const { transactionOperations } = require('../api/handlers');
const { getRandomNumber } = require('../utils/helpers');

const flowHandlers = {
    // Shared Base Operations
    _capture: async (m, id, amt, curr, ref, uid) => {
        await transactionOperations.capture(m, id, amt, curr, ref, uid);
    },
    _cancel: async (m, id, amt, curr, ref, uid) => {
        await transactionOperations.cancel(m, id, amt, curr, ref, uid);
    },
    _credit: async (m, id, amt, curr, ref, uid) => {
        await transactionOperations.credit(m, id, amt, curr, ref, uid);
    },

    'CIT-decline3DS': async () => {},
    'authorizeAutoCapture': async () => {},
    'authorizeNoCapture': async () => {},
    'decline': async () => {},
    
    'authorizeCancel': async (m, id, amt, curr, ref, uid) => {
        await flowHandlers._cancel(m, id, amt, curr, ref, uid);
    },
    
    'authorizeCapture': async (m, id, amt, curr, ref, uid) => {
        await flowHandlers._capture(m, id, amt, curr, ref, uid);
    },
    
    'authorizeCaptureRefund': async (m, id, amt, curr, ref, uid) => {
        await flowHandlers._capture(m, id, amt, curr, ref, uid);
        await flowHandlers._credit(m, id, amt, curr, ref + '-ref', uid);
    },
    
    'authorizeCaptureRefundPartial': async (m, id, amt, curr, ref, uid) => {
        const refundAmount = Math.floor(amt * 0.7);
        await flowHandlers._capture(m, id, amt, curr, ref, uid);
        await flowHandlers._credit(m, id, refundAmount, curr, ref + '-ref', uid);
    },

    'authorizeCapturePartialRefund': async (m, id, amt, curr, ref, uid) => {
        const captureAmount = Math.floor(amt * 0.7);
        await flowHandlers._capture(m, id, captureAmount, curr, ref, uid);
        await flowHandlers._credit(m, id, captureAmount, curr, ref + '-ref', uid);
    },

    'authorizeAutoCaptureRefundMany': async (m, id, amt, curr, ref, uid) => {
        const numRefunds = getRandomNumber(2, 4);
        let remaining = amt;
        for (let i = 1; i <= numRefunds; i++) {
            const refundAmt = i === numRefunds ? remaining : Math.floor(remaining * 0.3);
            await flowHandlers._credit(m, id, refundAmt, curr, `${ref}-ref${i}`, uid);
            remaining -= refundAmt;
        }
    },
    
    'authorizeTopUp': async (m, id, amt, curr, ref, uid) => {
        const topUp = Math.min(amt * m.limits.topUp / 100, amt);
        await transactionOperations.increase(m, id, topUp, curr, ref + '-inc', uid);
    },
    
    'authorizeTopUpCapture': async (m, id, amt, curr, ref, uid) => {
        const topUp = Math.min(amt * m.limits.topUp / 100, amt);
        await transactionOperations.increase(m, id, topUp, curr, ref + '-inc', uid);
        await flowHandlers._capture(m, id, amt + topUp, curr, ref, uid);
    },
    
    'authorizeTopUpCaptureRefund': async (m, id, amt, curr, ref, uid) => {
        const topUp = Math.min(amt * m.limits.topUp / 100, amt);
        await transactionOperations.increase(m, id, topUp, curr, ref + '-inc', uid);
        await flowHandlers._capture(m, id, amt + topUp, curr, ref, uid);
        await flowHandlers._credit(m, id, amt + topUp, curr, ref + '-ref', uid);
    },
    
    'authorizeTopUpManyCapture': async (m, id, amt, curr, ref, uid) => {
        const numTopUps = getRandomNumber(2, 4);
        let total = amt;
        for (let i = 1; i <= numTopUps; i++) {
            const topUp = getRandomNumber(50, Math.floor(amt * 0.2));
            await transactionOperations.increase(m, id, topUp, curr, `${ref}-inc${i}`, uid);
            total += topUp;
        }
        await flowHandlers._capture(m, id, total, curr, ref, uid);
    }
};

module.exports = { flowHandlers };