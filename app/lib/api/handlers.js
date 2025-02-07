const axios = require('axios');
const { logMessage } = require('../utils/logger');

const getAuthHeader = (merchantConfig) => {
    return `Basic ${Buffer.from(`${merchantConfig.merchantId}:${merchantConfig.password}`).toString('base64')}`;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const callAPI = async (merchantConfig, endpoint, payload, method, uuid, retries = 5, backoff = 1000) => {

    const url = `https://api.sandbox.datatrans.com/v1/transactions${endpoint ? '/' + endpoint : ''}`;
    // logMessage(`[${uuid}] API Request - Method: ${method.toUpperCase()}, URL: ${url}, Payload: ${JSON.stringify(payload, null, 2)}`);

    try {
        const response = await axios({
            method,
            url: url,
            headers: { 'Authorization': getAuthHeader(merchantConfig) },
            data: payload
        });

        logMessage(`[${uuid}] API ${method.toUpperCase()}${endpoint ? ' ' + endpoint : ''} success`);
        return response;

    } catch (error) {
        if (error.response?.status === 400 && endpoint === 'authorize') {
            return error.response;
        }

        if (retries === 0) {
            logMessage(`[${uuid}] API ${method.toUpperCase()}${endpoint ? ' ' + endpoint : ''}  failed after retries: ${error.response?.data?.message || error.message}`);
            throw error;
        }

        logMessage(`[${uuid}] API ${method.toUpperCase()}${endpoint ? ' ' + endpoint : ''}  failed, retrying in ${backoff}ms: ${error.response?.data?.message || error.message}`);
        await delay(backoff);
        return callAPI(merchantConfig, endpoint, payload, method, uuid, retries - 1, backoff * 2);
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
            const response = await callAPI(
                merchantConfig,
                'authorize',
                payload,
                'post',
                uuid
            );
            if (response.status === 400) {
                logMessage(`[${uuid}] Authorization declined as expected: ${response.data.transactionId}`);
            } else {
                logMessage(`[${uuid}] Authorization successful: ${response.data.transactionId}`);
            }
            return response.data;

        } catch (error) {
            const errorData = error.response?.data || {};

            // If the status is 400, handle it as an expected decline
            if (error.response?.status === 400) {
                return null;
            }

            logMessage(`[${uuid}] Authorization failed: ${errorData.message || error.message}`);
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
            const response = await callAPI(
                merchantConfig,
                '',
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
        return callAPI(
            merchantConfig,
            `${transactionId}/settle`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    },

    async cancel(merchantConfig, transactionId, amount, currency, refNo, uuid) {
        return callAPI(
            merchantConfig,
            `${transactionId}/cancel`,
            {},
            'post',
            uuid
        );
    },

    async credit(merchantConfig, transactionId, amount, currency, refNo, uuid) {
        return callAPI(
            merchantConfig,
            `${transactionId}/credit`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    },

    async increase(merchantConfig, transactionId, amount, currency, refNo, uuid) {
        return callAPI(
            merchantConfig,
            `${transactionId}/increase`,
            { amount, currency, refno: refNo },
            'post',
            uuid
        );
    }
};

module.exports = { transactionOperations };