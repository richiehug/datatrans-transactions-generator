const axios = require('axios');
const { logMessage } = require('../utils/logger');

const getAuthHeader = (merchantConfig) => {
    return `Basic ${Buffer.from(`${merchantConfig.merchantId}:${merchantConfig.password}`).toString('base64')}`;
};

const transactionOperations = {
    async initiateFlow(merchantConfig, flowType, refNo, amount, currency, paymentMethod, uuid) {
        if (flowType.startsWith('CIT')) {
            return this.initCIT(merchantConfig, refNo, amount, currency, paymentMethod, flowType, uuid);
        }
        return this.authorizeMIT(merchantConfig, refNo, amount, currency, paymentMethod, flowType, uuid);
    },

    async authorizeMIT(merchantConfig, refNo, amount, currency, paymentMethod, flowType, uuid) {
        const payload = {
            refno: refNo,
            amount: amount,
            currency: currency,
            autoSettle: flowType.toLowerCase().includes('autocapture'),
            [paymentMethod.type]: {
                alias: paymentMethod.alias,
                ...(paymentMethod.type === 'card' && {
                    expiryMonth: paymentMethod.expiryMonth,
                    expiryYear: paymentMethod.expiryYear
                })
            }
        };
    
        try {
            const response = await axios.post(
                'https://api.sandbox.datatrans.com/v1/transactions/authorize',
                payload,
                {
                    headers: {
                        'Authorization': getAuthHeader(merchantConfig),
                        'Content-Type': 'application/json'
                    },
                    // Allow 400 status for expected declines
                    validateStatus: (status) => status === 200 || status === 400
                }
            );
    
            if (response.status === 400) {
                logMessage(`[${uuid}] MIT Authorization declined as expected: ${response.data.error.message}`);
                return null; // Indicate expected decline
            }
    
            logMessage(`[${uuid}] MIT Authorization successful: ${response.data.transactionId}`);
            return response.data;
        } catch (error) {
            const errorData = error.response?.data || {};
            logMessage(`[${uuid}] MIT Authorization failed: ${errorData.message || error.message}`);
            throw error;
        }
    },

    async initCIT(merchantConfig, refNo, amount, currency, paymentMethod, flowType, uuid) {
        const redirectUrls = {
            successUrl: `https://richiehug.requestcatcher.com/confirmation/${refNo}?r=success`,
            errorUrl: `https://richiehug.requestcatcher.com/checkout/${refNo}?r=error`,
            cancelUrl: `https://richiehug.requestcatcher.com/checkout/${refNo}?r=cancel`
        };
    
        const webhookUrl = `https://richiehug.requestcatcher.com/webhook/${refNo}`;
    
        const payload = {
            currency: currency,
            refno: refNo,
            paymentMethods: [paymentMethod.paymentMethod],
            redirect: redirectUrls,
            webhook: webhookUrl,
            amount: amount,
            autoSettle: flowType.toLowerCase().includes('autocapture'),
        };
    
        try {
            const response = await axios.post(
                'https://api.sandbox.datatrans.com/v1/transactions',
                payload,
                {
                    headers: {
                        'Authorization': getAuthHeader(merchantConfig),
                        'Content-Type': 'application/json'
                    }
                }
            );
            logMessage(`[${uuid}] CIT Init successful: ${response.data.transactionId}`);
            return {
                transactionId: response.data.transactionId,
                paymentPageUrl: response.headers.location,
                redirectUrls: redirectUrls
            };
        } catch (error) {
            logMessage(`[${uuid}] CIT Init failed: ${error.response?.data?.message || error.message}`);
            throw error;
        }
    },

    async capture(merchantConfig, transactionId, amount, currency, refNo, uuid) {
        return this.callAPI(
            merchantConfig,
            `${transactionId}/settle`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    },

    async cancel(merchantConfig, transactionId, uuid) {
        return this.callAPI(
            merchantConfig,
            `${transactionId}/cancel`,
            {},
            'post',
            uuid
        );
    },

    async credit(merchantConfig, transactionId, amount, currency, refNo, uuid) {
        return this.callAPI(
            merchantConfig,
            `${transactionId}/credit`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    },

    async increase(merchantConfig, transactionId, amount, currency, refNo, uuid) {
        return this.callAPI(
            merchantConfig,
            `${transactionId}/increase`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    },

    async callAPI(merchantConfig, endpoint, payload, method, uuid) {
        try {
            const response = await axios({
                method,
                url: `https://api.sandbox.datatrans.com/v1/transactions/${endpoint}`,
                headers: { 'Authorization': getAuthHeader(merchantConfig) },
                data: payload
            });

            logMessage(`[${uuid}] API ${method.toUpperCase()} ${endpoint} success`);
            return response.data;

        } catch (error) {
            const errorData = error.response?.data || {};
            logMessage(`[${uuid}] API ${method.toUpperCase()} ${endpoint} failed: ${errorData.message || error.message}`);
            throw error;
        }
    }
};

module.exports = { transactionOperations };