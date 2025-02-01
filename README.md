# 🚀 Datatrans Transactions Generator

The **Datatrans Transactions Generator** is your ultimate tool for simulating transactions in Datatrans' test environment. Whether you're testing payment flows, debugging, or just having fun with transaction scenarios, this script has got you covered. It’s designed to be flexible and easy to use. Some bugs may occur, use at your own risk. Each request has a built-in delay (2-5 seconds) to avoid overwhelming the servers. Be gentle with the Datatrans test environment. 👀

## Features

- **Simulate Transactions**: Test authorization (auto & deferred capture), capture, cancel, top-up, and refund flows.
- **Customizable Configurations**: Define your merchant settings, payment methods, and transaction scenarios in JSON files.
- **Decline Scenarios**: Test declines based on configurable amount ranges for each payment method.
- **Logging**: All transaction details are logged in a clean, structured format (`log.txt`).

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
| `authorizeCancel`              | Authorizes, then cancels the transaction.                                   |
| `authorizeCapture`             | Authorizes, then captures the full authorized amount.                       |
| `authorizeCaptureRefund`       | Authorizes, captures the full amount, then refunds the full amount.         |
| `authorizeCapturePartialRefund`| Authorizes, captures the full amount, then refunds a partial amount.        |
| `authorizeTopUp`               | Authorizes, adds a top-up, and leaves the capture pending.                  |
| `authorizeTopUpCapture`        | Authorizes, adds a top-up, then captures the transaction.                   |
| `authorizeTopUpCaptureRefund`  | Authorizes, adds a top-up, captures, then refunds the transaction.          |
| `authorizeCapturePartialRefund`| Authorizes, captures a partial amount, then refunds the full capture amount.|
| `authorizeAutoCaptureRefundMany`        | Authorizes and automatically captures the transaction, then partially refunds 2-4 times the transaction.                   |
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
| `transactionFlows.*`   | Number of tests to perform for each flow. Take the names of the flows from above.                                   | Int   |
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
    "authorizeAutoCapture": 5,
    "authorizeNoCapture": 3
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

This file defines the payment methods you’ll use for testing. Here’s what you can configure:

| Parameter       | Description                                                                 | Type     |
|-----------------|-----------------------------------------------------------------------------|----------|
| `type`          | Payment method type (`card` or 3-letter Datatrans code for others).                   | String   |
| `alias`         | Payment method alias.                                                       | String   |
| `expiryMonth`   | Expiry month. Mandatory for cards.                                                   | Int, 2-digit  |
| `expiryYear`    | Expiry year. Mandatory for cards.                                                    | Int, 2-digit   |
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
    "alias": "alias",
    "expiryMonth": 06,
    "expiryYear": 25,
    "ranges": {
      "success": [0, 9000],
      "decline": [9001, 12000]
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

Every test is logged with precision. Logs are stored in `app/logs/transaction_log.txt`. Keep an eye on them to track your tests.
