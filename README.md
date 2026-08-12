# dMoney API Integration Testing (Mocha + Chai + Axios)

Integration test suite covering the full dMoney transaction flow — user onboarding through deposits, transfers, cash-out and merchant payment — against a local dMoney API server.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Tests](#running-the-tests)
- [Test Flow](#test-flow)
- [Test Scenarios](#test-scenarios)
- [Fee / Commission Rules Verified](#fee--commission-rules-verified)
- [Project Structure](#project-structure)
- [Console log Output](#console-log-Output)
- [Notes](#notes)

## Tech Stack

| Tool  | Purpose |
|-------|---------|
| [Mocha](https://mochajs.org/) | Test runner |
| [Chai](https://www.chaijs.com/) | Assertions |
| [Axios](https://axios-http.com/) | HTTP client |

## Prerequisites

- Node.js 22+ (uses built-in `process.loadEnvFile()` — no `dotenv` dependency)
- dMoney API server running locally

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the project root (already listed in `.gitignore`):

```env
BASE_URL=http://localhost:5000
PARTNER_KEY=ROADTOSDET
```

`dmoney.spec.js` loads these via `process.env.BASE_URL` / `process.env.PARTNER_KEY`, with hardcoded fallbacks only if `.env` is missing.

## Running the Tests

```bash
npm test
```

Single command runs the entire chained flow in [dmoney.spec.js](dmoney.spec.js), sequentially, end to end.

## Test Flow

1. Admin login
2. Create + activate 2 customers, 1 agent, 1 merchant
3. System login, deposit 5000 tk to agent
4. Agent login (OTP), deposit 2000 tk to customer 01 — asserts 2.5% commission
5. Customer 01 login (OTP), sends 1000 tk to customer 02 — asserts flat 5 tk fee
6. Customer 02 login (OTP), cashes out 500 tk from agent — asserts fee = max(1%, 5)
7. Customer 02 pays 400 tk to merchant — asserts fee = max(1%, 5)

Each user's phone number and JWT token from one step is reused as input for the next, so the suite must run in order (Mocha preserves file order by default).

## Test Scenarios

| # | Scenario | Endpoint | Assertions |
|---|----------|----------|------------|
| 1 | Admin login | `POST /user/login` | status 200, message, token captured |
| 2 | Create customer 01 | `POST /user/create` | status 201, message, user id captured |
| 3 | Activate customer 01 | `PATCH /user/update/:id` | status 200, message |
| 4 | Create customer 02 | `POST /user/create` | status 201, message, user id captured |
| 5 | Activate customer 02 | `PATCH /user/update/:id` | status 200, message |
| 6 | Create agent | `POST /user/create` | status 201, message, user id captured |
| 7 | Activate agent | `PATCH /user/update/:id` | status 200, message |
| 8 | Create merchant | `POST /user/create` | status 201, message, user id captured |
| 9 | Activate merchant | `PATCH /user/update/:id` | status 200, message |
| 10 | System login | `POST /user/login` | status 200, message, token captured |
| 11 | System deposits 5000 tk to agent | `POST /transaction/deposit` | status 201, message |
| 12 | Agent login (sends OTP) | `POST /user/login` | status 200, message contains "otp" |
| 13 | Agent OTP verification | `POST /user/verify-otp` | status 200, token captured |
| 14 | Agent deposits 2000 tk to customer 01 | `POST /transaction/deposit` | status 201, message, commission == 2.5% of amount |
| 15 | Customer 01 login (sends OTP) | `POST /user/login` | status 200, message contains "otp" |
| 16 | Customer 01 OTP verification | `POST /user/verify-otp` | status 200, token captured |
| 17 | Customer 01 sends 1000 tk to customer 02 | `POST /transaction/sendmoney` | status 201, message, fee == 5 |
| 18 | Customer 02 login (sends OTP) | `POST /user/login` | status 200, message contains "otp" |
| 19 | Customer 02 OTP verification | `POST /user/verify-otp` | status 200, token captured |
| 20 | Customer 02 cashes out 500 tk from agent | `POST /transaction/withdraw` | status 201, message, fee == max(1%, 5) |
| 21 | Customer 02 pays 400 tk to merchant | `POST /transaction/payment` | status 201, message, fee == max(1%, 5) |

## Fee / Commission Rules Verified

| Transaction | Rule |
|-------------|------|
| Agent deposit to customer | 2.5% commission |
| Customer send money | Flat 5 tk fee |
| Customer cash out (withdraw) | max(1% of amount, 5 tk) |
| Customer pay merchant | max(1% of amount, 5 tk) |

## Project Structure

```
.
├── dmoney.spec.js    # test suite (Mocha + Chai + Axios)
├── .env              # BASE_URL / PARTNER_KEY (gitignored)
├── .gitignore         # node_modules, .env
├── package.json      # dependencies + npm test script
└── README.md
```

## Console log Output
<img width="1018" height="239" alt="image" src="https://github.com/user-attachments/assets/9d4ed1b6-ca0b-41dd-89be-206c9c5b96ec" />
<img width="1017" height="202" alt="image" src="https://github.com/user-attachments/assets/a53e4e0e-8a60-444e-bc00-11b8cde07816" />
<img width="1003" height="155" alt="image" src="https://github.com/user-attachments/assets/2e99a9dd-ad76-465b-aeea-8c7c889057f5" />
<img width="958" height="269" alt="image" src="https://github.com/user-attachments/assets/2621e213-9b12-4e1f-817f-5b827aa321b4" />


## Notes

- Email and phone numbers are randomized per test run to avoid colliding with previously created users (mirrors the Postman collection's random-generation approach).
- Since these tests run against the dev environment, OTP verification uses the fixed dev OTP `0000` passed via the `?env=dev` query param, instead of retrieving a real OTP from email/SMS.
- "Activate user" endpoint is asserted as status 200 based on observed server behavior (source Postman collection did not assert a status code for this step).
