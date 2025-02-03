# 🚀 Datatrans Transactions Generator

The **Datatrans Transactions Generator** is your ultimate tool for simulating transactions in Datatrans' test environment. Whether you're testing payment flows, debugging, or just having fun with transaction scenarios, this script has got you covered. It’s designed to be flexible and easy to use. Some bugs may occur, use at your own risk. Each request has a built-in delay to avoid overwhelming the servers. Be gentle with the Datatrans test environment. 👀

## Features

- **Simulate Transactions**: Test authorization (auto & deferred capture), capture, cancel, top-up, and refund flows. This script lets you test customer-initiated and merchant-initated transaction flows.
- **Customizable Configurations**: Define your merchant settings, payment methods, and transaction scenarios in JSON files.
- **Decline Scenarios**: Test declines based on configurable amount ranges for each payment method.
- **Decline Scenarios**: Test payment flows via our payment page headlessly. 3D Secure simulation included.
- **Logging**: All transaction details are logged in a clean, structured format.

## Prerequisites

- Node.js: Ensure you have Node.js installed on your machine. Tested with Node v18.17.1.
- Datatrans credentials: You will need at least one merchant configuration at your hand to run your tests. Be sure to know what payment methods and currencies are enabled.

## Installation

1. Run the following command to install the required Node.js packages:

    ```sh
    npm install
    ```

2. Navigate to the app/config folder, duplicate the configuration files, and remove the `_template` part of the file names.

3. Configure your necessary tests and add the payment methods to be used during your tests.

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

This file defines your merchant configurations and the flows you want to test. Here’s what you can tweak:

| Parameter            | Description                                                                 | Type     |
|----------------------|-----------------------------------------------------------------------------|----------|
| `id`                 | Unique configuration ID.                                                    | String   |
| `merchantId`         | Your merchant ID.                                                           | String   |
| `password`           | Basic auth password.                                                        | String   |
| `referenceType`      | Reference settings. Choose between random or static reference numbers.      | Object   |
| `currencies`         | List of possible currencies for transactions.                               | Array, String    |
| `amounts`            | Range and/or specific amounts for transactions.                             | Object   |
| `transactionFlows.CIT.*` `transactionFlows.MIT.*`  | Number of tests to perform for each flow. Take the names of the flows from above.                                   | Int   |
| `limits.*`             | Max percentage for top-ups and partial refunds (based on authorized/captured amount).| Int   |

#### config.json Example

```json
{
  "id": "config1",
  "merchantId": "your-merchant-id",
  "password": "basic-auth-password",
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
  }
}
```

Here's how to define a static reference for all your tests:

```json
  "referenceType": {
    "type": "static",
    "refno": "some-reference"
  },
```

### `payment_methods.json`

This file defines the payment methods you’ll use for testing. Some flows may only be available if you specify a card with a decline range or 3DS codes.

If you are not an expert, take the cards from the example file. You just need to create a single transaction manually using `"createAlias":true` with both cards to receive a valid alias for that card. Once created, add it to your configuration. The alias can be shared among your merchant configurations, as long as they are in the same Datatrans merchant group. The sample cards already cover all test cases.

Here’s what you can configure:

| Parameter       | Description                                                                 | Type     |
|-----------------|-----------------------------------------------------------------------------|----------|
| `type`          | Payment method type (`card` or 3-letter Datatrans code for others).                   | String   |
| `number`          | Card number. Required for automated card processing via the payment page.                   | Int, 12-19 digit   |
| `paymentMethod`          | Payment method value for Datatrans. Required for automated card processing via the payment page.                   | String   |
| `3DS.*`          | Verification codes that will be used for success and error cases.  Required for automated card processing via the payment page.                 | Int, 4-digit   |
| `alias`         | Payment method alias.                                                       | String   |
| `expiryMonth`   | Expiry month. Mandatory for cards.                                                   | Int, 2-digit  |
| `expiryYear`    | Expiry year. Mandatory for cards.                                                    | Int, 2-digit   |
| `cvv`          | Card CVV. Required for automated card processing via the payment page.                   | Int, 12-19 digit   |
| `ranges`        | Success or decline amount ranges. Optional.                                     | Range, Int   |
| `maxAttempts`   | Max retry attempts. Optional. Useful for payment methods that have a limit you don't want to reach.                              | Int   |
| `currencies`    | Supported currencies.                                                       | Array, String    |
| `transactionFlows`    | Supported transaction flows. If no flows are specified, all flows will be accepted.                                                      | Array, String    |
| `configurations`    | Supported configurations. If no configurations are specified, all configurations will be accepted.                                                       | Array, Int    |

#### payment_methods.json Example

```json
[
  {
    "type": "card",
    "number": 4111111111111111,
    "paymentMethod": "VIS",
    "3DS": {
      "successCode": 4000,
      "errorCode": 4009
    },
    "alias": "alias",
    "expiryMonth": "06",
    "expiryYear": "25",
    "cvv": 123
  },
  {
    "type": "card",
    "number": 5404000000000001,
    "paymentMethod": "ECA",
    "3DS": {
      "successCode": 4000,
      "errorCode": 4009
    },
    "alias": "alias",
    "expiryMonth": "06",
    "expiryYear": "25",
    "cvv": 123,
    "ranges": {
      "success": [
          100,
          9000
      ],
      "decline": [
          9001,
          100000
      ]
    }
  },
  {
    "type": "TWI",
    "alias": "alias",
    "currencies": ["CHF"],
    "configurations": [ 1, 2 ],
    "transactionFlows": [
      "authorizeAutoCapture",
      "authorizeCancel",
      "authorizeCapture",
      "authorizeCaptureRefund"
    ]
  }
]
```

## Logs

Every test is logged with precision. Logs are stored in `app/logs`. Keep an eye on them to track your tests.
