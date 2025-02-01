const { loadConfig } = require('./utils/config');
const { logMessage } = require('./utils/logger');
const { generateRefNo, getRandomElement, sleep, getRandomNumber } = require('./utils/helpers');
const { transactionOperations } = require('./api/handlers');
const { flowHandlers } = require('./core/flows');

const { config, savedMethods } = loadConfig();

const flowStatistics = {
    totalTests: 0,
    flows: {}
};

const getPaymentMethod = (currency, flowType) => {
    let validMethods = savedMethods.filter(method =>
        !method.currencies || method.currencies.includes(currency)
    );

    if (flowType === 'decline') {
        validMethods = validMethods.filter(method => method.ranges?.decline);
    }

    if (flowType.includes('TopUp')) {
        validMethods = validMethods.filter(method => method.type === 'card');
    }

    return getRandomElement(validMethods);
};

const getTransactionAmount = (merchantConfig, paymentMethod, flowType) => {
    if (flowType === 'decline' && paymentMethod.ranges?.decline) {
        const [min, max] = paymentMethod.ranges.decline;
        return getRandomNumber(min, max);
    }

    if (merchantConfig.amounts.specific?.length > 0) {
        return getRandomElement(merchantConfig.amounts.specific);
    }

    if (merchantConfig.amounts.range?.length === 2) {
        const [min, max] = merchantConfig.amounts.range;
        return getRandomNumber(min, max);
    }

    throw new Error('Invalid or missing amounts configuration');
};

const adjustAmountForSuccess = (paymentMethod, amount) => {
    if (paymentMethod.ranges?.success) {
        const [min, max] = paymentMethod.ranges.success;
        return getRandomNumber(min, max);
    }
    return amount;
};

const executeFlows = async () => {
    // Initialize statistics
    config.configurations.forEach(merchantConfig => {
        Object.keys(merchantConfig.transactionFlows).forEach(flowType => {
            flowStatistics.flows[flowType] = {
                planned: merchantConfig.transactionFlows[flowType],
                executed: 0
            };
        });
    });

    // Create flow pool
    let flowPool = [];
    config.configurations.forEach(merchantConfig => {
        Object.entries(merchantConfig.transactionFlows).forEach(([flowType, count]) => {
            for (let i = 0; i < count; i++) {
                flowPool.push({ merchantConfig, flowType });
            }
        });
    });

    // Shuffle and execute flows
    flowPool = flowPool.sort(() => Math.random() - 0.5);

    const failedFlows = []; // Initialize failed flows collection

    // Within the loop over flowPool:
    for (const { merchantConfig, flowType } of flowPool) {
        let refNo, transactionId, amount, currency, paymentMethod;
        try {
            currency = getRandomElement(merchantConfig.currencies);
            paymentMethod = getPaymentMethod(currency, flowType);

            if (!paymentMethod) {
                logMessage(`No valid payment method for ${currency}/${flowType}`);
                continue;
            }

            amount = getTransactionAmount(merchantConfig, paymentMethod, flowType);
            // Only adjust amount for non-decline flows
            if (flowType !== 'decline') {
                amount = adjustAmountForSuccess(paymentMethod, amount);
            }
            refNo = generateRefNo(merchantConfig);

            // Update statistics
            flowStatistics.totalTests++;
            flowStatistics.flows[flowType].executed++;

            // Log execution
            logMessage(`
================== Flow Execution ==================
Date (UTC): ${new Date().toISOString()}
Config ID: ${merchantConfig.id}
Flow Type: ${flowType}
Flow Instance: ${flowStatistics.flows[flowType].executed} of ${flowStatistics.flows[flowType].planned}
Amount: ${amount} ${currency}
Payment Method: ${paymentMethod.alias}
Reference Number: ${refNo}
====================================================
        `);

            // Authorization
            const authResult = await transactionOperations.authorize(
                merchantConfig, refNo, amount, currency, paymentMethod, flowType
            );

            if (flowType === "decline") {
                logMessage("Transaction declined as expected");
                await sleep(getRandomNumber(2000, 5000));
                continue;
            }

            if (!authResult) continue;

            transactionId = authResult.transactionId;
            await sleep(getRandomNumber(2000, 5000));

            // Execute flow handler
            if (flowHandlers[flowType]) {
                await flowHandlers[flowType](merchantConfig, transactionId, amount, currency, refNo);
            }

            logMessage(`
================== End of Flow ====================
        `);
        } catch (error) {
            // Capture transaction ID from error response if available
            let errorTransactionId = 'N/A';
            if (error.response && error.response.data && error.response.data.transactionId) {
                errorTransactionId = error.response.data.transactionId;
            }
            logMessage(`Flow execution failed: ${error.message}`);
            failedFlows.push({
                flowType,
                refNo: refNo || 'N/A',
                transactionId: errorTransactionId,
                error: error.message
            });
        }
        await sleep(getRandomNumber(2000, 5000));
    }

    // Final summary
    logMessage(`
#################### Execution Summary ####################

Total Tests Executed: ${flowStatistics.totalTests}
Successful: ${flowStatistics.totalTests - failedFlows.length}
Failed: ${failedFlows.length}

Flow Breakdown:
${Object.entries(flowStatistics.flows).map(([flow, stats]) =>
        `• ${flow}: ${stats.executed}/${stats.planned} executed`
    ).join('\n')}

${failedFlows.length > 0 ? `
Failed Flows:
${failedFlows.map(f =>
        `• ${f.flowType} (Ref: ${f.refNo}, Transaction ID: ${f.transactionId}): ${f.error}`
    ).join('\n')}` : ''}
##########################################################`);
};

module.exports = { executeFlows };