const puppeteer = require('puppeteer');
const { logMessage } = require('../utils/logger');

const handlePaymentPage = async (url, paymentMethod, flowType, uuid, redirectUrls) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        await page.setCacheEnabled(false);
        await page.setDefaultNavigationTimeout(60000);
        await page.setDefaultTimeout(30000);

        // Execute payment flow
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        switch (paymentMethod.type.toUpperCase()) {
            case 'CARD':
                await handleCards(page, paymentMethod, flowType, uuid);
                break;
            case 'KLN':
                await handleKlarna(page, uuid);
                break;
            case 'PAP':
                await handlePayPal(page, paymentMethod.account, uuid);
                break;
            case 'PFC':
                await handlePostFinanceCard(page, uuid);
                break;
            default:
                throw new Error(`Unsupported payment method: ${paymentMethod.type}`);
        }

        return await finalRedirect(page, redirectUrls, uuid);
    } catch (error) {
        throw new Error(`Error during browser session: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
};

// Card handlers

const handleCards = async (page, paymentMethod, flowType, uuid) => {
    try {
        logMessage(`[${uuid}] Handling Cards flow with ${paymentMethod.paymentMethod}`);
        let dcc = false, threeDSecure = false;

        // Card details entry
        await page.waitForSelector('#cardNumber', { visible: true, timeout: 10000 });
        await page.focus('#cardNumber');
        await page.type('#cardNumber', paymentMethod.number.toString(), { delay: 100 });
        await page.waitForSelector('#expiry', { visible: true, timeout: 10000 });
        await page.type('#expiry', `${paymentMethod.expiryMonth}${paymentMethod.expiryYear}`, { delay: 20 });
        if (paymentMethod.paymentMethod !== 'CUP') {
            await page.waitForSelector('#cvv', { visible: true, timeout: 10000 });
            await page.type('#cvv', paymentMethod.cvv.toString());
        }

        await page.waitForSelector('#paymentButtons .form--submit', { visible: true, timeout: 10000 });
        page.click('#paymentButtons .form--submit');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // DCC
        if (await page.$('#dccPay')) {
            await handleDCC(page, uuid);
            dcc = true;
        }

        // 3DS
        if (await page.url().includes('/acs/challenge')) {
            await handle3DS(page, paymentMethod, flowType, uuid);
            threeDSecure = true;
        } else {
            logMessage(`[${uuid}] No 3DS challenge detected`);
        }

        logMessage(`[${uuid}] Card flow with ${paymentMethod.paymentMethod}${dcc ? ' DCC' : ''}${threeDSecure ? ' 3D Secure' : ''} completed`);
    } catch (error) {
        throw new Error(`Card payment failed: ${error.message}`);
    }
};

const handleDCC = async (page, uuid) => {
    try {
        logMessage(`[${uuid}] Handling DCC`);
        const choice = Math.random() < 0.5 ? '#originalPay' : '#dccPay';
        await page.click(choice);
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });

        logMessage(`[${uuid}] DCC completed`);
    } catch (error) {
        throw new Error(`DCC handling failed: ${error.message}`);
    }
};

const handle3DS = async (page, paymentMethod, flowType, uuid) => {
    try {
        logMessage(`[${uuid}] Handling 3D Secure challenge`);
        const otp = flowType === 'decline3DS'
            ? paymentMethod['3DS'].errorCode.toString()
            : paymentMethod['3DS'].successCode.toString();

        // OTP
        await page.waitForSelector('#otp', { visible: true, timeout: 5000 });
        await page.type('#otp', otp);

        // Submit
        await page.waitForSelector('#sendOtp', { visible: true, timeout: 5000 });
        await page.click('#sendOtp');

        logMessage(`[${uuid}] 3D Secure completed`);

    } catch (error) {
        throw new Error(`3DS challenge failed: ${error.message}`);
    }
};

// APM handlers

const handleKlarna = async (page, uuid) => {
    try {
        logMessage(`[${uuid}] Handling Klarna flow`);

        // Phone number
        await page.waitForSelector('#phone', { visible: true, timeout: 60000 });
        await page.type('#phone', '0794206969');
        await page.waitForSelector('#onContinue', { visible: true, timeout: 60000 });
        await page.click('#onContinue');

        // OTP
        await page.waitForSelector('#otp_field', { visible: true, timeout: 30000 });
        await page.type('#otp_field', '123456');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // Submit
        await page.waitForSelector('#buy_button', { visible: true, timeout: 30000 });
        await page.click('#buy_button');

        logMessage(`[${uuid}] Klarna flow completed`);

    } catch (error) {
        logMessage('If Klarna keeps failing, check with Datatrans that only Pay Later is enabled for your Klarna configuration.');
        throw new Error(`Klarna flow failed: ${error.message}`);
    }
};

const handlePayPal = async (page, account, uuid) => {
    try {
        logMessage(`[${uuid}] Handling PayPal flow`);

        // Email
        await page.waitForSelector('#email', { visible: true, timeout: 20000 });
        await page.type('#email', account.email);
        await page.waitForSelector('#btnNext', { visible: true, timeout: 20000 });
        await page.click('#btnNext');

        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Password
        await page.waitForSelector('#password', { visible: true, timeout: 20000 });
        await page.type('#password', account.password);
        await page.waitForSelector('#btnLogin', { visible: true, timeout: 20000 });
        await page.click('#btnLogin');

        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Submit
        await page.waitForSelector('#payment-submit-btn', { visible: true, timeout: 45000 });
        await page.click('#payment-submit-btn');

        logMessage(`[${uuid}] PayPal flow completed`);

    } catch (error) {
        throw new Error(`PayPal payment failed: ${error.message}`);
    }
};


const handlePostFinanceCard = async (page, uuid) => {
    try {
        logMessage(`[${uuid}] Handling PostFinance Card flow`);

        if (page.url().includes('PFC_alias_1.jsp')) {
            // Terms acceptance for alias
            await page.waitForSelector('#tnb_accept', { visible: true, timeout: 30000 });
            await page.click('#tnb_accept');
            await page.click('#weiterButton');
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
        }

        // Continue flow
        await page.waitForSelector('button.efinance-button', { visible: true, timeout: 30000 });
        await page.click('button.efinance-button');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // Submit
        await page.waitForSelector('button.efinance-button', { visible: true, timeout: 30000 });
        await page.click('button.efinance-button');

        logMessage(`[${uuid}] PostFinance Card flow completed`);

    } catch (error) {
        throw new Error(`PostFinance flow failed: ${error.message}`);
    }
};

// Final URL check
const finalRedirect = async (page, redirectUrls, uuid) => {
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
        try {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const finalUrl = await page.url();

            if (Object.values(redirectUrls).some(pattern => finalUrl.includes(pattern.split('?')[0]))) {
                logMessage(`[${uuid}] Final URL ${finalUrl} verified.`);
                return finalUrl;
            }
        } catch (error) {
            logMessage(`[${uuid}] Error during navigation: ${error.message}`);
        }
    }

    const finalUrl = await page.url();
    throw new Error(`Final URL validation failed after ${maxRetries} retries. Actual URL: ${finalUrl}`);
};

module.exports = { handlePaymentPage };