const fs = require('fs');
const path = require('path');
const { flowHandlers } = require('../core/flows');

const validateConfigStructure = (config) => {
    if (!Array.isArray(config.configurations)) {
        throw new Error('Configurations must be an array');
    }

    config.configurations.forEach(merchantConfig => {
        // Mandatory fields check
        const mandatoryFields = ['id', 'merchantId', 'password', 'referenceNumber',
            'currencies', 'amounts', 'transactionFlows', 'limits'];
        mandatoryFields.forEach(field => {
            if (!(field in merchantConfig)) {
                throw new Error(`Missing ${field} in merchant configuration`);
            }
        });

        // Reference number validation
        const refNoConfig = merchantConfig.referenceNumber;
        if (refNoConfig.type === 'random') {
            if (!Array.isArray(refNoConfig.length) || refNoConfig.length.length !== 2 ||
                !Number.isInteger(refNoConfig.length[0]) || !Number.isInteger(refNoConfig.length[1])) {
                throw new Error('Invalid random referenceNumber length configuration');
            }
        } else if (refNoConfig.type === 'static') {
            if (typeof refNoConfig.refno !== 'string') {
                throw new Error('Invalid static referenceNumber configuration');
            }
        } else {
            throw new Error('Invalid referenceNumber type - must be "random" or "static"');
        }

        // Amounts validation
        const amounts = merchantConfig.amounts;
        if ((!amounts.range || !Array.isArray(amounts.range) || amounts.range.length !== 2) &&
            (!amounts.specific || !Array.isArray(amounts.specific))) {
            throw new Error('Invalid amounts configuration - must have range or specific amounts');
        }

        // Transaction flows validation
        const flows = merchantConfig.transactionFlows;
        const flowMappings = {
            MIT: {
                authorizeAutoCapture: 'authorizeAutoCapture',
                authorizeNoCapture: 'authorizeNoCapture',
                decline: 'decline',
                authorizeCancel: 'authorizeCancel',
                authorizeCapture: 'authorizeCapture',
                authorizeCaptureRefund: 'authorizeCaptureRefund',
                authorizeCapturePartialRefund: 'authorizeCapturePartialRefund',
                authorizeCaptureRefundPartial: 'authorizeCaptureRefundPartial',
                authorizeAutoCaptureRefundMany: 'authorizeAutoCaptureRefundMany',
                authorizeTopUp: 'authorizeTopUp',
                authorizeTopUpCapture: 'authorizeTopUpCapture',
                authorizeTopUpCaptureRefund: 'authorizeTopUpCaptureRefund',
                authorizeTopUpManyCapture: 'authorizeTopUpManyCapture'
            },
            CIT: {
                decline3DS: 'CIT-decline3DS',
                authorizeAutoCapture: 'authorizeAutoCapture',
                authorizeNoCapture: 'authorizeNoCapture',
                decline: 'decline',
                authorizeCancel: 'authorizeCancel',
                authorizeCapture: 'authorizeCapture',
                authorizeCaptureRefund: 'authorizeCaptureRefund',
                authorizeCapturePartialRefund: 'authorizeCapturePartialRefund',
                authorizeCaptureRefundPartial: 'authorizeCaptureRefundPartial',
                authorizeAutoCaptureRefundMany: 'authorizeAutoCaptureRefundMany',
                authorizeTopUp: 'authorizeTopUp',
                authorizeTopUpCapture: 'authorizeTopUpCapture',
                authorizeTopUpCaptureRefund: 'authorizeTopUpCaptureRefund',
                authorizeTopUpManyCapture: 'authorizeTopUpManyCapture'
            }
        };

        Object.entries(flows).forEach(([flowCategory, subFlows]) => {
            if (!['MIT', 'CIT'].includes(flowCategory)) {
                throw new Error(`Invalid flow category: ${flowCategory}`);
            }

            Object.entries(subFlows).forEach(([flowType, count]) => {
                const handlerName = flowMappings[flowCategory]?.[flowType];

                if (!handlerName || !flowHandlers[handlerName]) {
                    throw new Error(`No handler found for ${flowCategory}-${flowType}`);
                }

                if (flowType === 'decline3DS' && flowCategory !== 'CIT') {
                    throw new Error('decline3DS flow is only allowed for CIT category');
                }
            });
        });

    });
};

const validatePaymentMethods = (methods) => {
    if (!Array.isArray(methods)) {
        throw new Error('Payment methods must be an array');
    }

    methods.forEach(method => {
        if (!method.type) throw new Error('Payment method missing type');
        if (!method.alias) throw new Error('Payment method missing alias');

        if (method.type === 'card') {
            const requiredFields = ['number', 'expiryMonth', 'expiryYear'];
            requiredFields.forEach(field => {
                if (!(field in method)) throw new Error(`Card payment method missing ${field}`);
            });

            if (method.expiryMonth.toString().length !== 2 ||
                method.expiryYear.toString().length !== 2) {
                throw new Error('Invalid card expiry format - use MM for month and MM for year');
            }

            if (method['3DS']) {
                if (typeof method['3DS'].successCode !== 'number' ||
                    typeof method['3DS'].errorCode !== 'number') {
                    throw new Error('Invalid 3DS code format - must be numbers');
                }
            }
        }

        if (method.maxAttempts && !Number.isInteger(method.maxAttempts)) {
            throw new Error('maxAttempts must be an integer');
        }

        if (method.ranges) {
            const validRanges = ['success', 'decline'];
            Object.entries(method.ranges).forEach(([rangeType, range]) => {
                if (!validRanges.includes(rangeType)) {
                    throw new Error(`Invalid range type: ${rangeType}`);
                }
                if (!Array.isArray(range) || range.length !== 2 ||
                    !range.every(Number.isInteger)) {
                    throw new Error(`${rangeType} range must be an array of two integers`);
                }
            });
        }

        if (method.currencies) {
            if (!Array.isArray(method.currencies) ||
                method.currencies.some(c => typeof c !== 'string' || c.length !== 3)) {
                throw new Error('Currencies must be an array of 3-letter currency codes');
            }
        }
    });
};

const loadConfig = () => {
    const configPath = path.join(__dirname, '../../config/config.json');
    const methodsPath = path.join(__dirname, '../../config/payment_methods.json');

    const config = JSON.parse(fs.readFileSync(configPath));
    const savedMethods = JSON.parse(fs.readFileSync(methodsPath));

    validateConfigStructure(config);
    validatePaymentMethods(savedMethods);

    return { config, savedMethods };
};

module.exports = { loadConfig };