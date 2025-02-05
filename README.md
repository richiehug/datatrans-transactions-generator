# 🚀 Datatrans Transactions Generator

The **Datatrans Transactions Generator** is your ultimate tool for simulating transactions in Datatrans' test environment. Whether you're testing payment flows, debugging, or just having fun with transaction scenarios, this script has got you covered. It’s designed to be flexible and easy to use. Some bugs may occur, use at your own risk. Each request has a built-in delay to avoid overwhelming the servers. Be gentle with the Datatrans test environment. 👀

## Features

- **Simulate Transactions**: Test authorization (auto & deferred capture), capture, cancel, top-up, and refund flows. This script lets you test customer-initiated and merchant-initiated transaction flows.
- **Customizable Configurations**: Define your merchant settings, payment methods, and transaction scenarios in JSON files.
- **CIT Transactions**: Test payment flows via our payment page headlessly.
- **CIT Flows for APMs**: Simulate Klarna, PayPal, and PostFinance Card transactions, with custom payloads if necessary.
- **Dynamic URLs**: Configure redirects and webhooks with `:refNo` placeholders for transaction-specific tracking.
- **Dynamic Currency Conversion (DCC)**: Test DCC flows with supported cards (e.g., `5232050000010003`).
- **Decline Scenarios**: Test declines based on configurable amount ranges for each payment method.
- **Logging**: All transaction details are logged in a clean, structured format.

## Prerequisites

- Node.js: Ensure you have Node.js installed on your machine. Tested with Node v18.17.1.
- Datatrans credentials: You will need at least one merchant configuration at your hand to run your tests. Be sure to know what payment methods and currencies are enabled.

## Installation

Run the following command to install the required Node.js packages:

```sh
npm install
```

Navigate to the `app/config` folder, duplicate the desired configuration files, and remove the `_template*` part of the file names.

Configure your necessary tests and add the payment methods to be used during your tests.

## Run Script

Ready to roll? Run the script with:

```sh
node index.js
```

Make sure your JSON configuration files are set up correctly before running. If not, well, you know what to do. 😉

## Available Tests

Here’s what you can simulate:

| Test Value                        | Description                                                                 |
|----------------------------------|-----------------------------------------------------------------------------|
| `authorizeAutoCapture`         | Authorizes and automatically captures the transaction.                      |
| `authorizeNoCapture`           | Authorizes but leaves the capture pending.                                  |
| `decline`                      | Attempts to authorize with an amount and payment method that will decline.  |
| `decline3DS`                      | Attempts to authorize with an amount and payment method that will decline during the 3DS flow. Only available for CIT flows. |
| `authorizeCancel`              | Authorizes, then cancels the transaction.                                   |
| `authorizeCapture`             | Authorizes, then captures the full authorized amount.                       |
| `authorizeCaptureRefund`       | Authorizes, captures the full amount, then refunds the full amount.         |
| `authorizeCaptureRefundPartial`| Authorizes, captures the full amount, then refunds a partial amount.        |
| `authorizeCapturePartialRefund`| Authorizes, captures a partial amount, then refunds the full capture amount.|
| `authorizeAutoCaptureRefundMany`        | Authorizes and automatically captures the transaction, then partially refunds 2-4 times the transaction.                   |
| `authorizeTopUp`               | Authorizes, adds a top-up, and leaves the capture pending.                  |
| `authorizeTopUpCapture`        | Authorizes, adds a top-up, then captures the transaction.                   |
| `authorizeTopUpCaptureRefund`  | Authorizes, adds a top-up, captures, then refunds the transaction.          |
| `authorizeTopUpManyCapture`  | Authorizes, adds 2-4 top-ups, then captures the transaction.          |

## Configuration

### `config.json`

This file defines your global and merchant configurations and the flows you want to test. Here’s what you can tweak:

| Global Parameter     | Description                                                                 | Type     |
|----------------------|-----------------------------------------------------------------------------|----------|
| `logLimit`           | Defines the max size of your log folder. Once the limit is reached, old files are continuously deleted. If not specified the script assumes no limit. | Int   |
| `loop`               | Defines if the script should run in a continuous mode. If not specified the script only runs once.  | Int   |

| Config Parameter     | Description                                                                 | Type     |
|----------------------|-----------------------------------------------------------------------------|----------|
| `id`                 | Unique configuration ID.                                                    | String   |
| `merchantId`         | Your merchant ID.                                                           | String   |
| `password`           | Basic auth password.                                                        | String   |
| `urls.*`             | Redirect and webhook URLs to be used. `success`, `error`, and `cancel` may be called depending on the transaction outcome via the payment page. `webhook` will be called by Datatrans after various transaction operations. Add `:refNo` to your URLs for transaction-specific tracking. | String |
| `delay`              | Delay between flows within a configuration. If no delay is specified, no delay will be checked. If a delay is specified, the configuration will be skipped and another one picked.                                            | Int   |
| `referenceType`      | Reference settings. Choose between random or static reference numbers.</br></br>Options:</br>- `"referenceType": { "type": "random", "length": [12, 16], "prefix": "ORD-"}`</br>- `"referenceType": { "type": "static", "refno": "static-value"}`         | Object   |
| `currencies`         | List of possible currencies for transactions.                               | Array, String    |
| `amounts`            | Range and/or specific amounts for transactions.                             | Object   |
| `transactionFlows.CIT.*` `transactionFlows.MIT.*`  | Number of tests to perform for each flow. Take the names of the flows from above.                                   | Int   |
| `limits.*`             | Max percentage for top-ups and partial refunds (based on authorized/captured amount).| Int   |
| `paymentMethods.cards` `paymentMethods.APM`   | Controls which payment methods are used:</br>- `cards`: Credit/debit card schemes</br>- `APM`: Alternative Payment Methods</br></br>Options:</br>- `"cards": true`: Allow all in category</br>- `"cards": ["VIS"]`: Specific payment methods / card brands</br></br>Note: When defined, only specified categories/methods are used. Omit this parameter to allow all payment methods.                                                    | Bool or Array, String    |

#### config.json Example

```json
{
  "logLimit": 100,
  "loop": false,
  "configurations": [
    {
      "id": "config1",
      "merchantId": "your-merchant-id",
      "password": "basic-auth-password",
      "urls": {
        "success": "https://example.com/confirmation/:refNo?r=success",
        "cancel": "https://example.com/checkout/:refNo?r=cancel",
        "error": "https://example.com/checkout/:refNo?r=error",
        "webhook": "https://example.com/webhook/:refNo"
      },
      "delay": 10,
      "referenceType": {
        "type": "random",
        "length": [12, 16],
        "prefix": "ORD-"
      },
      "currencies": ["CHF", "EUR"],
      "amounts": {
        "range": [10, 10000],
        "specific": [500, 1500, 5000]
      },
      "transactionFlows": {
        "CIT": {
            "authorizeAutoCapture": 1,
            "decline": 1,
            "decline3DS": 1
        },
        "MIT": {
            "authorizeAutoCapture": 1,
            "decline": 1,
        }
      },
      "limits": {
        "topUp": 50,
        "refund": 90
      },
      "paymentMethods": {
        "cards": true,
        "APM": ["KLN", "PAP"]
      }
    }
  ]
}
```

### `payment_methods.json`

This file defines the payment methods you’ll use for testing. Some flows may only be available if you specify a card with a decline range or 3DS codes.

If you are not an expert, start testing with the simple template. You just need to create a single transaction manually using `"createAlias":true` with both cards to receive a valid alias for that card. Once created, add it to your payment methods. The alias can be shared among your merchant configurations, as long as they are in the same Datatrans merchant group. The 'simple' cards already cover all test cases except DCC.

Your cards should at least contain one range for success cases, one range for decline cases and at least have once 3DS success and error codes defined. Non-card types are optional.

Here’s what you can configure:

| Parameter       | Description                                                                 | Type     |
|-----------------|-----------------------------------------------------------------------------|----------|
| `type`          | Payment method type (`card` or 3-letter Datatrans code for others).                   | String   |
| `number`          | Card number. Required for automated card processing via the payment page.                   | Int, 12-19 digit   |
| `paymentMethod`          | Payment method value for Datatrans. Required for automated card processing via the payment page.                   | String   |
| `3DS.*`          | Verification codes that will be used for success and error cases.  Required for automated card processing via the payment page.                 | Int, 4-digit   |
| `alias`         | Payment method alias. Payment methods without alias will be ignored for MIT flows.                                                       | String   |
| `expiryMonth`   | Expiry month. Mandatory for cards.                                                   | Int, 2-digit  |
| `expiryYear`    | Expiry year. Mandatory for cards.                                                    | Int, 2-digit   |
| `cvv`          | Card CVV. Required for automated card processing via the payment page.                   | Int, 12-19 digit   |
| `ranges`        | Success or decline amount ranges. Optional.                                     | Range, Int   |
| `maxAttempts`   | Max retry attempts. Optional. Useful for payment methods that have a limit you don't want to reach.                              | Int   |
| `currencies`    | Supported currencies.                                                       | Array, String    |
| `transactionFlows.CIT` `transactionFlows.MIT`   | Supported transaction flows. If no flows are specified, all flows will be accepted.                                                      | Array, String    |
| `configurations`    | Supported configurations. If no configurations are specified, all configurations will be accepted.                                                       | Array, Int    |
| `payload`    | Appends the content 1:1 to the `init` and `authorize` request's payload. Required for testing with Klarna.                                                      | Object    |
| `account`   | Contains `email` and `password`. Required for PayPal.                                    | Object   |

#### payment_methods.json Example

```json
[
  {
    "type": "card",
    "paymentMethod": "VIS",
    "number": 4111111111111111,
    "expiryMonth": "06",
    "expiryYear": "25",
    "cvv": 123,
    "alias": "alias",
    "3DS": {
      "successCode": 4000,
      "errorCode": 4009
    }
  },
  {
    "type": "card",
    "paymentMethod": "ECA",
    "number": 5404000000000001,
    "alias": "alias",
    "expiryMonth": "06",
    "expiryYear": "25",
    "cvv": 123,
    "3DS": {
      "successCode": 4000,
      "errorCode": 4009
    },
    "ranges": {
      "success": [ 100, 9000 ],
      "decline": [ 9001, 100000 ]
    }
  },
  {
    "type": "TWI",
    "alias": "alias",
    "currencies": ["CHF"],
    "configurations": [ 1, 2 ],
    "transactionFlows": {
      "MIT": [
        "authorizeAutoCapture",
        "authorizeCancel",
        "authorizeCapture",
        "authorizeCaptureRefund" 
      ]
    }
  },
  {
    "type": "KLN",
    "payload": {
        "order": {
            "articles": [
              {
                "name": "some name",
                "quantity": "1",
                "price": "1",
                "taxPercent": "0"
              }
            ]
        }
    },
    "currencies": [
        "CHF"
    ]
  },
  {
        "type": "PAP",
        "account": {
            "email": "email@example.com",
            "password": "password"
        }
    },
    {
        "type": "PFC",
        "currencies": [
            "CHF"
        ]
    }
]
```

> **Note**: For Klarna, the `price` in the `articles` array is automatically adjusted to match the transaction amount during testing.

## Logs

Every test is logged with precision. Logs are stored in `app/logs`. Keep an eye on them to track your tests.
