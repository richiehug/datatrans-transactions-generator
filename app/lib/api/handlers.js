const axios = require('axios');
const { logMessage } = require('../utils/logger');

const getAuthHeader = (merchantConfig) => {
    return `Basic ${Buffer.from(`${merchantConfig.merchantId}:${merchantConfig.password}`).toString('base64')}`;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const callAPIWithRetry = async (merchantConfig, endpoint, payload, method, uuid, retries = 5, backoff = 1000) => {
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
        if (retries === 0) {
            logMessage(`[${uuid}] API ${method.toUpperCase()} ${endpoint} failed after retries: ${error.response?.data?.message || error.message}`);
            throw error;
        }

        logMessage(`[${uuid}] API ${method.toUpperCase()} ${endpoint} failed, retrying in ${backoff}ms: ${error.response?.data?.message || error.message}`);
        await delay(backoff);
        return callAPIWithRetry(merchantConfig, endpoint, payload, method, uuid, retries - 1, backoff * 2);
    }
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
            autoSettle: flowType.toLowerCase().includes('autocapture') && paymentMethod.type === 'card',
            [paymentMethod.type]: {
                alias: paymentMethod.alias,
                ...(paymentMethod.type === 'card' && {
                    expiryMonth: paymentMethod.expiryMonth,
                    expiryYear: paymentMethod.expiryYear
                }),
                ...(paymentMethod.payload && { payload: paymentMethod.payload })
            }
        };

        try {
            const response = await callAPIWithRetry(
                merchantConfig,
                'authorize',
                payload,
                'post',
                uuid
            );

            if (response.status === 400) {
                logMessage(`[${uuid}] MIT Authorization declined as expected: ${response.data.error.message}`);
                return null;
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
            successUrl: merchantConfig.urls.success.replace(':refNo', refNo),
            errorUrl: merchantConfig.urls.error.replace(':refNo', refNo),
            cancelUrl: merchantConfig.urls.cancel.replace(':refNo', refNo)
        };

        const webhookUrl = merchantConfig.urls.webhook.replace(':refNo', refNo);

        if (paymentMethod.payload && paymentMethod.payload.order) {
            paymentMethod.payload.order.articles.forEach(article => {
                article.price = amount;
            });
        }

        const payload = {
            currency: currency,
            refno: refNo,
            paymentMethods: [paymentMethod.type === 'card' ? paymentMethod.paymentMethod : paymentMethod.type],
            redirect: redirectUrls,
            webhook: webhookUrl,
            amount: amount,
            autoSettle: flowType.toLowerCase().includes('autocapture'),
            ...(paymentMethod.payload ? {
                ...Object.fromEntries(
                    Object.entries(paymentMethod.payload)
                )
            } : {})
        };

        try {
            const response = await callAPIWithRetry(
                merchantConfig,
                'transactions',
                payload,
                'post',
                uuid
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
        return callAPIWithRetry(
            merchantConfig,
            `${transactionId}/settle`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    },

    async cancel(merchantConfig, transactionId, uuid) {
        return callAPIWithRetry(
            merchantConfig,
            `${transactionId}/cancel`,
            {},
            'post',
            uuid
        );
    },

    async credit(merchantConfig, transactionId, amount, currency, refNo, uuid) {
        return callAPIWithRetry(
            merchantConfig,
            `${transactionId}/credit`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    },

    async increase(merchantConfig, transactionId, amount, currency, refNo, uuid) {
        return callAPIWithRetry(
            merchantConfig,
            `${transactionId}/increase`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    }
};

module.exports = { transactionOperations };