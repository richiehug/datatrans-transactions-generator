const { loadConfig } = require('./utils/config');
const { logMessage } = require('./utils/logger');
const { generateRefNo, getRandomElement, sleep, getRandomNumber } = require('./utils/helpers');
const { transactionOperations } = require('./api/handlers');
const { flowHandlers } = require('./core/flows');
const { handlePaymentPage } = require('./core/paymentPageHandler');
const { v4: uuidv4 } = require('uuid');

const { config, savedMethods } = loadConfig();

const flowStatistics = {
    totalTests: 0,
    flows: {}
};

const getPaymentMethod = (currency, flowType) => {
    const [flowCategory, specificFlow] = flowType.split('-');
    const isDeclineFlow = specificFlow === 'decline' || specificFlow === 'decline3DS';

    let validMethods = savedMethods.filter(method => {
        const currencyValid = !method.currencies || method.currencies.includes(currency);
        const isCard = method.type === 'card';
        
        if (flowCategory === 'CIT') {
            return isCard && currencyValid && (isDeclineFlow ? method.ranges?.decline : true);
        }
        
        return currencyValid && (isDeclineFlow ? method.ranges?.decline : true);
    });

    if (isDeclineFlow) {
        validMethods = validMethods.filter(m => 
            m.ranges?.decline &&
            Array.isArray(m.ranges.decline) &&
            m.ranges.decline.length === 2
        );
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

    // Shuffle flows
    flowPool = flowPool.sort(() => Math.random() - 0.5);
    const failedFlows = [];

    for (const { merchantConfig, flowType, isCIT } of flowPool) {
        const uuid = uuidv4();
        let transactionDetails = null;

        try {
            // Setup transaction
            const currency = getRandomElement(merchantConfig.currencies);
            const paymentMethod = getPaymentMethod(currency, flowType);
            
            if (!paymentMethod) {
                logMessage(`[${uuid}] No valid payment method for ${flowType}`);
                continue;
            }

            const amount = getTransactionAmount(merchantConfig, paymentMethod, flowType);
            const refNo = generateRefNo(merchantConfig);

            // Update statistics
            flowStatistics.totalTests++;
            flowStatistics.flows[flowType].executed++;

            // Log execution
            logMessage(`[${uuid}] Starting ${flowType}
================== Flow Execution ==================
Config ID:    ${merchantConfig.id}
Reference:    ${refNo}
Amount:       ${amount} ${currency}
Payment Method:
  Type:       ${paymentMethod.type}
  Alias:      ${paymentMethod.alias}
  ${paymentMethod.type === 'card' ? `Card:       ${paymentMethod.number.toString().slice(0, 6)}****${paymentMethod.number.toString().slice(-4)}` : ''}
  ${paymentMethod.type === 'card' ? `Expiry:     ${paymentMethod.expiryMonth}/${paymentMethod.expiryYear}` : ''}
====================================================`);

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
                    refNo,
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

                // Handle expected declines
                if (flowType === 'MIT-decline') {
                    if (authResult === null) {
                        logMessage(`[${uuid}] Transaction declined as expected`);
                        await sleep(getRandomNumber(1000, 2000));
                        continue;
                    }
                    throw new Error(`[${uuid}] Expected decline but got successful authorization`);
                }

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
        await sleep(getRandomNumber(1000, 2000));
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
##########################################################`);
};

module.exports = { executeFlows };