const puppeteer = require('puppeteer');
const { logMessage } = require('../utils/logger');

const handlePaymentPage = async (url, paymentMethod, flowType, uuid, redirectUrls) => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        await page.setCacheEnabled(false);
        await page.setDefaultNavigationTimeout(30000);
        await page.setDefaultTimeout(10000);

        // Execute payment flow
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

        switch (paymentMethod.type.toUpperCase()) {
            case 'CARD':
                await handleCards(page, paymentMethod, flowType, uuid);
                break;
            case 'PAP':
                await handlePayPal(page, paymentMethod.account, uuid);
                break;
            case 'KLN':
                await handleKlarna(page, uuid);
                break;
            case 'PFC':
                await handlePostFinanceCard(page, uuid);
                break;
            default:
                throw new Error(`Unsupported payment method: ${paymentMethod.type}`);
        }
        
        return await verifyFinalRedirect(page, redirectUrls, uuid);
    } catch (error) {
        throw new Error(`Error during browser session: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
};

// ================== Payment Handlers ==================
const handleCards = async (page, paymentMethod, flowType, uuid) => {
    try {
        // Card details entry
        await page.waitForSelector('#cardNumber', { visible: true, timeout: 5000 });
        await page.type('#cardNumber', paymentMethod.number);
        await page.type('#expiry', `${paymentMethod.expiryMonth}${paymentMethod.expiryYear}`);

        if (paymentMethod.paymentMethod !== 'CUP') {
            await page.type('#cvv', paymentMethod.cvv);
        }

        // Form submission
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
            page.click('#paymentButtons .form--submit')
        ]);

        // Handle dynamic content
        if (await page.$('#dccPay')) {
            await handleDCC(page, uuid);
        }

        // 3DS handling
        if ((await page.url()).includes('/acs/challenge')) {
            await handle3DS(page, paymentMethod, flowType, uuid);
        }
    } catch (error) {
        throw new Error(`Card payment failed: ${error.message}`);
    }
};

const handleKlarna = async (page, uuid) => {
    try {
        logMessage(`[${uuid}] Handling Klarna flow`);
        await page.waitForSelector('#klarna-container', { timeout: 15000 });

        // Phone number entry
        await page.waitForSelector('#phone', { timeout: 10000 });
        await page.type('#phone', '0794206969');
        await page.click('#onContinue');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // OTP handling
        await page.waitForSelector('#otp_field', { timeout: 10000 });
        await page.type('#otp_field', '123456');
        await page.click('#onContinue');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // Final confirmation
        await page.waitForSelector('#buy_button', { timeout: 10000 });
        await page.click('#buy_button');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

    } catch (error) {
        throw new Error(`Klarna flow failed: ${error.message}`);
    }
};

const handlePostFinanceCard = async (page, uuid) => {
    try {
        logMessage(`[${uuid}] Handling PostFinance Card flow`);

        if (page.url().includes('PFC_alias_1.jsp')) {
            // Terms acceptance for alias
            await page.waitForSelector('#tnb_accept', { timeout: 10000 });
            await page.click('#tnb_accept');
            await page.click('#weiterButton');
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
        }
        
        // Continue flow
        await page.waitForSelector('button.efinance-button', { timeout: 10000 });
        await page.click('button.efinance-button');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // Final confirmation
        await page.waitForSelector('button.efinance-button', { timeout: 10000 });
        await page.click('button.efinance-button');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

    } catch (error) {
        throw new Error(`PostFinance flow failed: ${error.message}`);
    }
};

const handlePayPal = async (page, account, uuid) => {
    try {
        logMessage(`[${uuid}] Handling PayPal flow`);
        
        await page.waitForSelector('#email', { visible: true, timeout: 10000 });
        await page.type('#email', account.email);
        await page.click('#btnNext');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        await page.waitForSelector('#password', { visible: true, timeout: 10000 });
        await page.type('#password', account.password);
        await page.click('#btnLogin');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // Final confirmation
        await page.waitForSelector('#payment-submit-btn', { visible: true, timeout: 10000 });
        await page.click('#payment-submit-btn');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
    } catch (error) {
        throw new Error(`PayPal payment failed: ${error.message}`);
    }
};

// ================== Specialized Handlers ==================
const handleDCC = async (page, uuid) => {
    try {
        logMessage(`[${uuid}] Handling Dynamic Currency Conversion`);
        const choice = Math.random() < 0.5 ? '#originalPay' : '#dccPay';
        await page.click(choice);
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
    } catch (error) {
        throw new Error(`DCC handling failed: ${error.message}`);
    }
};

const handle3DS = async (page, paymentMethod, flowType, uuid) => {
    try {
        logMessage(`[${uuid}] Handling 3D Secure challenge`);
        const otp = flowType === 'decline3DS'
            ? paymentMethod['3DS'].errorCode
            : paymentMethod['3DS'].successCode;

        await page.type('#otp', otp);
        await page.waitForSelector('#sendOtp:not([disabled])', { timeout: 5000 });
        await page.click('#sendOtp');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
    } catch (error) {
        throw new Error(`3DS challenge failed: ${error.message}`);
    }
};

// ================== Shared Utilities ==================
const verifyFinalRedirect = async (page, redirectUrls, uuid) => {
    const finalUrl = await page.url();

    if (!Object.values(redirectUrls).some(pattern => finalUrl.includes(pattern.split('?')[0]))) {
        throw new Error(`Final URL validation failed. Actual URL: ${finalUrl}`);
    }

    logMessage(`[${uuid}] Payment completed successfully`);
    return finalUrl;
};

module.exports = { handlePaymentPage };