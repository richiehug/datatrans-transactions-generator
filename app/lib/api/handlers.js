const axios = require('axios');
const { logMessage } = require('../utils/logger');
const { getRandomNumber } = require('../utils/helpers');

const getAuthHeader = (merchantConfig) => {
    const authString = `${merchantConfig.merchantId}:${merchantConfig.password}`;
    return `Basic ${Buffer.from(authString).toString('base64')}`;
};

const makeApiCall = async (merchantConfig, endpoint, payload, method = 'post', allowedStatuses = [200, 201, 204]) => {
    const url = `https://api.sandbox.datatrans.com/v1/transactions/${endpoint}`;
    const headers = {
        'Authorization': getAuthHeader(merchantConfig),
        'Content-Type': 'application/json'
    };

    logMessage(`Calling ${method.toUpperCase()} ${url}, Payload: ${JSON.stringify(payload)}`);

    try {
        const response = await axios({ method, url, data: payload, headers });
        if (allowedStatuses.includes(response.status)) {
            logMessage(`API call succeeded (${response.status})`);
            return response.data;
        }
        throw new Error(`Unexpected status code: ${response.status}`);
    } catch (error) {
        if (error.response && allowedStatuses.includes(error.response.status)) {
            logMessage(`API call returned expected status (${error.response.status})`);
            return error.response.data;
        }
        logMessage(`API call failed: ${error.message}`);
        throw error;
    }
};

const transactionOperations = {
    authorize: async (merchantConfig, refNo, amount, currency, paymentMethod, flowType) => {
        const payload = {
            refno: refNo,
            amount: amount,
            currency: currency,
            autoSettle: flowType.includes("autoCapture"),
            [paymentMethod.type]: {
                alias: paymentMethod.alias,
                ...(paymentMethod.type === "card" ? {
                    expiryMonth: paymentMethod.expiryMonth,
                    expiryYear: paymentMethod.expiryYear
                } : {})
            }
        };

        const allowedStatuses = flowType === "decline" ? [400] : [200, 201];
        const response = await makeApiCall(merchantConfig, 'authorize', payload, 'post', allowedStatuses);
        return flowType === "decline" ? null : response;
    },

    capture: async (merchantConfig, transactionId, amount, currency, refno) => {
        return makeApiCall(merchantConfig, `${transactionId}/settle`, { amount, currency, refno });
    },

    cancel: async (merchantConfig, transactionId) => {
        return makeApiCall(merchantConfig, `${transactionId}/cancel`, {});
    },

    increase: async (merchantConfig, transactionId, amount, currency, refno) => {
        return makeApiCall(merchantConfig, `${transactionId}/increase`, { amount, currency, refno });
    },

    credit: async (merchantConfig, transactionId, amount, currency, refno) => {
        return makeApiCall(merchantConfig, `${transactionId}/credit`, { amount, currency, refno });
    }
};

module.exports = { transactionOperations, makeApiCall };