const { loadConfig } = require('./utils/config');
const { logMessage, setLogSizeLimit, initializeLogger } = require('./utils/logger');
const { generateRefNo, getRandomElement, sleep, getRandomNumber } = require('./utils/helpers');
const { transactionOperations } = require('./api/handlers');
const { flowHandlers } = require('./core/flows');
const { handlePaymentPage } = require('./core/paymentPageHandler');
const { v4: uuidv4 } = require('uuid');

const { config, savedMethods } = loadConfig();
setLogSizeLimit(config.logLimit || null);
initializeLogger();

let flowStatistics = {
    totalTests: 0,
    flows: {}
};

const getPaymentMethod = (currency, flowType, merchantConfig, uuid = {}, processedFlows, totalFlows) => {
    const [flowCategory, specificFlow] = flowType.split('-');
    const isCITFlow = flowCategory === 'CIT';
    const isDeclineFlow = specificFlow === 'decline' || specificFlow === 'decline3DS';
    const isTopUpFlow = specificFlow.includes('TopUp');
    const isRefundFlow = flowType.includes('Refund');

    const allowedPaymentMethods = merchantConfig.paymentMethods ?? {};

    let validMethods = savedMethods.filter(method => {
        const currencyValid = !method.currencies || method.currencies.includes(currency);
        const flowValid = !method.transactionFlows ||
            (method.transactionFlows[flowCategory] &&
                method.transactionFlows[flowCategory].includes(specificFlow));

        const aliasValid = flowCategory === 'MIT' ? !!method.alias : true;
        const declineValid = isDeclineFlow ? method.ranges?.decline && Array.isArray(method.ranges.decline) && method.ranges.decline.length === 2 : true;
        const topUpValid = isTopUpFlow ?
            method.type === 'card' && (method.paymentMethod === 'VIS' || method.paymentMethod === 'ECA') :
            true;
        const citValid = !(isCITFlow && method.type === 'TWI');
        const refundValid = !(isRefundFlow && method.type === 'PFC');

        let methodAllowed = false;

        // Handle APM configuration
        if (allowedPaymentMethods.APM) {
            if (allowedPaymentMethods.APM === true && method.type !== 'card') {
                // Allow all non-card methods if APM is true
                methodAllowed = true;
            } else if (Array.isArray(allowedPaymentMethods.APM) && allowedPaymentMethods.APM.includes(method.type)) {
                // Allow only specified APM methods
                methodAllowed = true;
            }
        }

        // Handle cards configuration
        if (allowedPaymentMethods.cards) {
            if (allowedPaymentMethods.cards === true && method.type === 'card') {
                // Allow all card methods if cards is true
                methodAllowed = true;
            } else if (Array.isArray(allowedPaymentMethods.cards) && allowedPaymentMethods.cards.includes(method.type)) {
                // Allow only specified card methods
                methodAllowed = true;
            }
        }

        // If neither cards nor APM is specified, allow all methods
        if (!allowedPaymentMethods.cards && !allowedPaymentMethods.APM) {
            methodAllowed = true;
        }

        return currencyValid && flowValid && aliasValid && declineValid &&
            topUpValid && citValid && refundValid && methodAllowed;
    });

    if (!validMethods.length) {
        logMessage(`[${uuid}] [${processedFlows}/${totalFlows}] No payment method found for ${flowCategory} > ${specificFlow}. Consider removing limits on paymentMethods or add payment methods that support your currency configurations.`);
        return null;
    }

    return getRandomElement(validMethods);
};

const getTransactionAmount = (merchantConfig, paymentMethod, flowType) => {
    const isDeclineFlow = flowType.endsWith('decline') || flowType.endsWith('decline3DS');

    if (isDeclineFlow && paymentMethod.ranges?.decline) {
        const [min, max] = paymentMethod.ranges.decline;
        return getRandomNumber(min, max);
    }

    if (merchantConfig.amounts.specific?.length > 0) {
        return getRandomElement(merchantConfig.amounts.specific);
    }

    return getRandomNumber(...merchantConfig.amounts.range);
};

const executeFlows = async () => {
    // Initialize statistics
    flowStatistics = {
        totalTests: 0,
        flows: {}
    };

    config.configurations.forEach(merchantConfig => {
        Object.entries(merchantConfig.transactionFlows).forEach(([category, subFlows]) => {
            Object.entries(subFlows).forEach(([flowType, count]) => {
                const fullFlowType = `${category}-${flowType}`;
                flowStatistics.flows[fullFlowType] = {
                    planned: count,
                    executed: 0
                };
            });
        });
    });

    logMessage(`

############# Datatrans Transactions Generator ###########
                    
                    Starting new test...
                    
##########################################################
`);

    // Create flow pool
    let flowPool = [];
    config.configurations.forEach(merchantConfig => {
        Object.entries(merchantConfig.transactionFlows).forEach(([category, subFlows]) => {
            Object.entries(subFlows).forEach(([flowType, count]) => {
                for (let i = 0; i < count; i++) {
                    flowPool.push({
                        merchantConfig,
                        flowType: `${category}-${flowType}`,
                        isCIT: category === 'CIT'
                    });
                }
            });
        });
    });

    const totalFlows = flowPool.length;
    let processedFlows = 0;
    
    // Shuffle flows
    flowPool = flowPool.sort(() => Math.random() - 0.5);
    const failedFlows = [];

    // Track cooldowns for configurations
    const cooldownMap = new Map(); // Maps config ID to the next available timestamp

    while (flowPool.length > 0) {
        let processed = false;

        for (let i = 0; i < flowPool.length; i++) {
            const { merchantConfig, flowType, isCIT } = flowPool[i];
            const configId = merchantConfig.id;
            const cooldownEnd = cooldownMap.get(configId) || 0;

            // Check if the configuration is ready for the next flow
            if (Date.now() >= cooldownEnd) {
                // Remove flow from pool
                const [currentFlow] = flowPool.splice(i, 1);
                processed = true;
                processedFlows++;

                const uuid = uuidv4();
                let transactionDetails = null;

                try {
                    // Setup transaction
                    const currency = getRandomElement(merchantConfig.currencies);
                    const paymentMethod = getPaymentMethod(currency, flowType, merchantConfig, uuid, processedFlows, totalFlows);

                    if (!paymentMethod) {
                        continue;
                    }

                    const amount = getTransactionAmount(merchantConfig, paymentMethod, flowType);
                    const refNo = generateRefNo(merchantConfig);

                    // Update statistics
                    flowStatistics.totalTests++;
                    flowStatistics.flows[flowType].executed++;

                    // Log execution
                    let logMessageText = `[${uuid}] [${processedFlows}/${totalFlows}] Starting ${flowType}

================== Flow Execution ==================
Config ID:          ${merchantConfig.id}
Reference:          ${refNo}
Amount:             ${amount} ${currency}
Payment Method:     ${paymentMethod.type}`;

                    if (paymentMethod.alias) {
                        logMessageText += `
Alias:              ${paymentMethod.alias}`;
                    }

                    if (paymentMethod.type === 'card') {
                        logMessageText += `
Card:               ${paymentMethod.number.toString().slice(0, 6)}****${paymentMethod.number.toString().slice(-4)}
Expiry:             ${paymentMethod.expiryMonth}/${paymentMethod.expiryYear}`;
                    }

                    logMessageText += `
====================================================
`;

                    logMessage(logMessageText);

                    // Initiate transaction
                    let authResult, paymentPageUrl, transactionId;

                    if (isCIT) {
                        const initResult = await transactionOperations.initiateFlow(
                            merchantConfig,
                            flowType,
                            refNo,
                            amount,
                            currency,
                            paymentMethod,
                            uuid
                        );

                        transactionId = initResult.transactionId;
                        paymentPageUrl = initResult.paymentPageUrl;

                        await handlePaymentPage(
                            paymentPageUrl,
                            paymentMethod,
                            flowType.split('-')[1],
                            uuid,
                            initResult.redirectUrls
                        );
                    } else {
                        authResult = await transactionOperations.authorizeMIT(
                            merchantConfig,
                            refNo,
                            amount,
                            currency,
                            paymentMethod,
                            flowType,
                            uuid
                        );

                        if (!authResult) continue;
                        transactionId = authResult.transactionId;
                    }

                    await sleep(getRandomNumber(1000, 2000));

                    // Execute subsequent operations
                    const handler = flowHandlers[flowType.split('-')[1]];
                    if (handler) {
                        await handler(
                            merchantConfig,
                            transactionId,
                            amount,
                            currency,
                            refNo,
                            uuid
                        );
                    }

                    logMessage(`[${uuid}] Flow completed successfully`);

                } catch (error) {
                    const errorInfo = {
                        uuid,
                        flowType,
                        error: error.message,
                        refNo: transactionDetails?.refNo || 'N/A',
                        transactionId: transactionDetails?.transactionId || 'N/A'
                    };

                    logMessage(`[${uuid}] Flow failed: ${error.message}
${error.stack || ''}`);

                    failedFlows.push(errorInfo);
                }

                // Update cooldown for the configuration
                if (merchantConfig.delay !== undefined) {
                    cooldownMap.set(configId, Date.now() + merchantConfig.delay * 1000);
                }

                break;
            }
        }

        // If no flows were processed, wait for 5 seconds before retrying
        if (!processed) {
            await sleep(5000);
        }
    }

    // Generate final report
    logMessage(`

#################### Execution Summary ####################

Total Tests: ${flowStatistics.totalTests}
Successful: ${flowStatistics.totalTests - failedFlows.length}
Failed: ${failedFlows.length}

Flow Breakdown:
${Object.entries(flowStatistics.flows).map(([flow, stats]) =>
        `• ${flow}: ${stats.executed}/${stats.planned} executed`
    ).join('\n')}

${failedFlows.length > 0 ? `
Failed Flows:
${failedFlows.map(f =>
        `• ${f.uuid} - ${f.flowType}: ${f.error}`
    ).join('\n')}` : ''}
##########################################################
`);
};

module.exports = { executeFlows };