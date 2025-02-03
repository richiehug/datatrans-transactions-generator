const puppeteer = require('puppeteer');
const { logMessage } = require('../utils/logger');

const handlePaymentPage = async (url, paymentMethod, flowType, uuid, refNo, redirectUrls) => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        // Configure reasonable timeouts
        await page.setDefaultNavigationTimeout(30000);
        await page.setDefaultTimeout(10000);

        logMessage(`[${uuid}] Navigating to payment page: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

        // Fill card details with error handling
        await fillCardDetails(page, paymentMethod, uuid);

        // Submit initial payment form
        await submitPaymentForm(page, uuid);

        // Handle potential 3DS challenge
        await handle3DSChallenge(page, paymentMethod, flowType, uuid);

        // Verify final redirect
        const finalUrl = await verifyFinalRedirect(page, redirectUrls, uuid);

        return finalUrl;

    } catch (error) {
        await handleError(page, error, uuid);
        throw error;
    } finally {
        await browser.close();
    }
};

// Helper functions
const fillCardDetails = async (page, paymentMethod, uuid) => {
    try {
        logMessage(`[${uuid}] Filling card details`);
        await page.waitForSelector('#cardNumber', { visible: true, timeout: 5000 });
        await page.type('#cardNumber', paymentMethod.number.toString(), { delay: 20 });

        await page.waitForSelector('#expiry', { visible: true, timeout: 5000 });
        await page.type('#expiry', `${paymentMethod.expiryMonth}${paymentMethod.expiryYear.slice(-2)}`, { delay: 20 });

        await page.waitForSelector('#cvv', { visible: true, timeout: 5000 });
        await page.type('#cvv', paymentMethod.cvv.toString(), { delay: 20 });
    } catch (error) {
        throw new Error(`Failed to fill card details: ${error.message}`);
    }
};

const submitPaymentForm = async (page, uuid) => {
    try {
        logMessage(`[${uuid}] Submitting payment form`);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
            page.click('#paymentButtons .form--submit')
        ]);
    } catch (error) {
        throw new Error(`Payment form submission failed: ${error.message}`);
    }
};

const handle3DSChallenge = async (page, paymentMethod, flowType, uuid) => {
    try {
        let currentUrl = await page.url();
        if (!currentUrl.includes('/acs/challenge')) return;

        logMessage(`[${uuid}] Handling 3DS challenge for ${flowType}`);
        const otp = flowType === 'decline3DS'
            ? paymentMethod['3DS'].errorCode
            : paymentMethod['3DS'].successCode;

        await page.waitForSelector('#otp', { visible: true, timeout: 5000 });
        await page.type('#otp', otp.toString(), { delay: 20 });

        await page.evaluate(() => {
            const submitBtn = document.getElementById('sendOtp');
            if (document.getElementById('otp').value.length >= 4) {
                submitBtn.disabled = false;
            }
        });

        await page.waitForSelector('#sendOtp:not([disabled])', { timeout: 5000 });
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
            page.click('#sendOtp')
        ]);
    } catch (error) {
        throw new Error(`3DS challenge failed: ${error.message}`);
    }
};

const verifyFinalRedirect = async (page, redirectUrls, uuid) => {
    try {
        let finalUrl = await page.url();
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts++ < maxAttempts) {
            if (matchesRedirectPattern(finalUrl, redirectUrls)) break;

            logMessage(`[${uuid}] Waiting for final redirect (attempt ${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 3000)); 

            try {
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 });
            } catch (error) {
                // Ignore timeout if we're already on final page
            }
            finalUrl = await page.url();
        }

        if (!matchesRedirectPattern(finalUrl, redirectUrls)) {
            throw new Error(`Final URL validation failed. Expected patterns:
                Success: ${redirectUrls.successUrl}
                Error: ${redirectUrls.errorUrl}
                Cancel: ${redirectUrls.cancelUrl}
                Actual URL: ${finalUrl}`
            );
        }

        logMessage(`[${uuid}] Final redirect validated: ${finalUrl}`);
        return finalUrl;
    } catch (error) {
        throw new Error(`Redirect verification failed: ${error.message}`);
    }
};

const matchesRedirectPattern = (url, redirectUrls) => {
    return Object.values(redirectUrls).some(pattern => url.includes(pattern.split('?')[0]));
};

const handleError = async (page, error, uuid) => {
    const pageContent = await page.content();

    logMessage(`[${uuid}]Error occurred: ${error.message}`);
};

module.exports = { handlePaymentPage };