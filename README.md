# ParaBank Playwright TypeScript Framework

## Overview

This is a personal SDET portfolio project built with Playwright and TypeScript to automate selected ParaBank UI tests in a local Docker environment.

The repository includes page objects, reusable Playwright fixtures, a ParaBank readiness script and GitHub Actions CI. It is a personal project and is not based on client code.

## Why ParaBank, and why local Docker

I chose ParaBank because it is a banking demo application, so its customer, account and transaction flows are relevant to my previous banking testing experience.

I run ParaBank locally in Docker instead of relying on the public hosted environment because the public environment is shared and can reset. Running it locally also gives me a more controlled and repeatable test environment for both local execution and CI.

## Stack

- Playwright
- TypeScript
- Docker and Docker Compose
- GitHub Actions
- Node.js 20 in CI
- Developed locally on Node.js 22

## Project structure

| Path | Purpose |
| --- | --- |
| `pages/` | Page objects that contain reusable locators and UI interaction methods. |
| `tests/` | Playwright spec files covering smoke, registration, login, account, transfer and end-to-end scenarios. |
| `fixtures/` | Reusable Playwright fixtures for page objects, unique customer data, registered customers and a logged-in page. |
| `utils/` | Shared test utilities, including runtime customer-data generation. |
| `scripts/` | Supporting automation scripts that initialise ParaBank and check that it is ready before the Playwright suite starts. |
| `.github/workflows/` | GitHub Actions workflow used to run the Playwright suite in CI. |
| `docker-compose.yml` | Defines the local ParaBank Docker service using the `parasoft/parabank` image and exposes it on port 8080. |
| `DECISIONS.md` | Records framework decisions, supporting evidence, trade-offs and limitations. |

## Running it locally

### Prerequisites

- Node.js (CI uses 20; local development is on 22)
- Docker

### 1. Start ParaBank

```bash
docker compose up -d
```

### 2. Initialise and verify ParaBank

```bash
./scripts/wait-for-parabank.sh
```

The script calls ParaBank's `initializeDB` endpoint until it returns HTTP `204`, then checks that the seeded `john/demo` customer can be read through the REST login endpoint with HTTP `200`.

Run it once after starting the container and before the tests. `initializeDB` resets the ParaBank database, so running it during a test run would remove data the tests created.

### 3. Install dependencies

```bash
npm ci
npx playwright install chromium
```

`npm ci` installs the exact versions in `package-lock.json`. The second command downloads the Chromium browser Playwright uses.

### 4. Run the tests

```bash
npx playwright test
```

To open the HTML report:

```bash
npx playwright show-report
```

### 5. Stop ParaBank

```bash
docker compose down
```

## What is tested

The suite contains 10 UI tests in 6 spec files, run on Chromium.

- **Smoke:** the ParaBank home page loads.
- **Registration:** a new customer can register and is logged in; a registered customer persists and can log in again; a duplicate username is rejected.
- **Login:** a registered customer can log in and see the account overview; an incorrect password is rejected; empty credentials show a validation error.
- **Accounts:** a savings account can be opened and the account balances update.
- **Transfer:** after opening a second account, a $10 transfer shows a "Transfer Complete" confirmation with the correct amount, source account and destination account.
- **End-to-end journey:** a single test registers a customer through the UI, opens a savings account and transfers $10 between the two accounts, without using the login fixtures. It checks the transfer confirmation, then confirms the source account shows one "Funds Transfer Sent" debit of $10.00 and the destination account shows one "Funds Transfer Received" credit of $10.00.

## What is not tested

- Account balances after a transfer
- Account details beyond the account number and transaction rows
- API testing
- Cross-browser execution
- Accessibility testing
- Performance testing

## CI with GitHub Actions

The workflow runs on pull requests and on pushes to `main`. The job:

1. Runs on an Ubuntu 26.04 runner
2. Starts ParaBank as a Docker service container
3. Sets up Node.js 20
4. Installs dependencies with `npm ci`
5. Installs Chromium and its system dependencies
6. Runs `scripts/wait-for-parabank.sh`
7. Runs the Playwright suite
8. Uploads the HTML report with `if: always()`, so it is kept when tests fail
9. Prints the ParaBank container logs if the job fails

For local runs, ParaBank is started with Docker Compose. In GitHub Actions, ParaBank runs as a service container defined directly in the workflow. Both use the same untagged `parasoft/parabank` image.

## Debugging with traces

Traces are recorded with `trace: 'on-first-retry'`. CI retries failing tests up to twice, so a trace is recorded on the first retry of a failing test. Locally, retries are set to 0, so no trace is recorded by default.

To debug a CI failure, download the `playwright-report` artifact from the run, open it with `npx playwright show-report <folder>`, and open the trace on the failed test.

To record traces locally:

```bash
npx playwright test --trace on
```

Screenshots and videos are kept only for failed tests.

## Debugging the first CI failure

GitHub Actions Runs #1 and #2 failed on 13 October 2026 while the workflow used a basic `/parabank/` readiness check. In Run #2, 7 of the 8 tests in the suite at that time failed. All seven failing tests register a customer, while the smoke test passed. The failures occurred while waiting for registration-success UI such as the logged-in confirmation or welcome heading.

ParaBank's container logs for Run #2 showed `user lacks privilege or object not found: SEQUENCE` while executing `SELECT next_id FROM Sequence WHERE name = ?`.

Between the Run #2 and Run #3 commits, the only repository change was the readiness request. It changed from `curl -sf /parabank/` to `curl -sfL -m 10 /parabank/index.htm`, adding redirect following and a per-request timeout. Runs #3 to #12 passed.

On 20 October, Run #13 introduced the stricter `scripts/wait-for-parabank.sh` check, which explicitly initialises the database and verifies the seeded `john/demo` login before Playwright starts. No CI run using the `index.htm` check had failed before this change, so I treat the script as precautionary hardening rather than as a fix for a new observed CI failure.

## Test data

Each test that needs a customer registers a new one at runtime with a unique username. Tests do not depend on customer data created by hand in an earlier ParaBank session.

## Known limitations

### Single-worker execution

The suite runs with `workers: 1`. I have observed registration failures when experimenting with overlapping workers, including a `--workers=4` run where 1 of 10 tests failed during customer registration with `"This username already exists"`, despite each test generating its own unique customer. The failure rate was not measured and the backend cause has not been established, so single-worker execution is a stability measure rather than a root-cause fix.

`fullyParallel: true` is set in the config, but it does not provide concurrent test execution while `workers` remains set to `1`.

### Readiness probe scope

The readiness script verifies that database initialisation completes and that seeded customer data can be read through the REST layer. It does not directly verify that customer registration works.

### Demo application, portfolio scope

ParaBank is a simplified demo application. Its behaviour and API do not represent a real banking architecture, and this is a portfolio framework rather than production infrastructure.

### Locators

ParaBank's UI has limited accessible names and labels. Where a role or label locator is not possible, the framework uses stable attributes such as `input[name="username"]`.

### Docker image version

The `parasoft/parabank` image is not pinned to a version, locally or in CI. A future image release could change application behaviour without any change to this repository.

## AI-assisted development

I used AI assistants to explain concepts and to review my code and documentation. I wrote the code and the decisions in this repository myself and can explain each of them.
