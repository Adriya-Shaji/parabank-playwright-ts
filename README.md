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
| `tests/` | UI, API, API-assisted UI and end-to-end Playwright tests. |
| `fixtures/` | Reusable Playwright fixtures for page objects, unique customer data, registered customers and a logged-in page. |
| `utils/` | Customer-data generation, API client and account setup helpers. |
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

The suite contains **15 tests in 9 spec files**, running on Chromium.

- **Smoke:** ParaBank home page loads.
- **Registration:** Successful registration, login after registration and duplicate username rejection.
- **Login:** Successful login, incorrect password and empty credentials.
- **Accounts:** SAVINGS account creation through the UI, including source and destination balance checks.
- **UI transfer:** $10 transfer with confirmation of amount and account numbers.
- **API:** Customer login, customer details, account validation and a $10 transfer with balance checks.
- **API-assisted UI transfer:** Creates and confirms a SAVINGS account through the API, transfers $10 through the UI, verifies both balances through the API and the destination balance through Accounts Overview.
- **End-to-end journey:** Registers a customer, opens a SAVINGS account, transfers $10 and verifies the debit and credit transactions through the UI.

## What is not tested

- Cross-browser execution beyond Chromium.
- Accessibility and performance testing.
- Full API error and negative-path behaviour.
- Parallel execution reliability.
- All ParaBank account types and banking features.

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

Screenshots are captured on failure. Traces are recorded on the first retry in CI. Video recording is off.

## Debugging the first CI failure

GitHub Actions Runs #1 and #2 failed on 13 October 2026 while the workflow used a basic `/parabank/` readiness check. In Run #2, 7 of the 8 tests in the suite at that time failed. All seven failing tests register a customer, while the smoke test passed. The failures occurred while waiting for registration-success UI such as the logged-in confirmation or welcome heading.

ParaBank's container logs for Run #2 showed `user lacks privilege or object not found: SEQUENCE` while executing `SELECT next_id FROM Sequence WHERE name = ?`.

Between the Run #2 and Run #3 commits, the only repository change was the readiness request. It changed from `curl -sf /parabank/` to `curl -sfL -m 10 /parabank/index.htm`, adding redirect following and a per-request timeout. Runs #3 to #12 passed.

On 20 October, Run #13 introduced the stricter `scripts/wait-for-parabank.sh` check, which explicitly initialises the database and verifies the seeded `john/demo` login before Playwright starts. No CI run using the `index.htm` check had failed before this change, so I treat the script as precautionary hardening rather than as a fix for a new observed CI failure.

## Test data

Each test that needs a customer registers a new one at runtime with a unique username. Tests do not depend on customer data created by hand in an earlier ParaBank session.

## Known limitations

### Single-worker execution

The suite runs with `workers: 1`. One registration failure was observed in a `--workers=4` run, with the error `"This username already exists"`, despite each test generating its own unique customer. The failure rate was not measured and the backend cause has not been established, so single-worker execution is a stability measure rather than a root-cause fix.

`fullyParallel: true` is set in the config, but it does not provide concurrent test execution while `workers` remains set to `1`.

### Readiness probe scope

The readiness script verifies that database initialisation completes and that seeded customer data can be read through the REST layer. It does not directly verify that customer registration works.

### Demo application, portfolio scope

ParaBank is a simplified demo application. Its behaviour and API do not represent a real banking architecture, and this is a portfolio framework rather than production infrastructure.

### Locators

ParaBank's UI has limited accessible names and labels. Where a role or label locator is not possible, the framework uses stable attributes such as `input[name="username"]`.

### Docker image version

The `parasoft/parabank` image is not pinned to a version, locally or in CI. A future image release could change application behaviour without any change to this repository.

### ParaBank URL configuration

The ParaBank URL is defined in `playwright.config.ts`, `utils/parabankApiClient.ts` (API paths) and `scripts/wait-for-parabank.sh`. Using another host or application path requires updating all three.

### ParaBank API behaviour

ParaBank's login endpoint includes credentials in the URL path (`/login/{username}/{password}`), which may expose them through URL logging.

The login API response also includes the customer's SSN, as observed in the `curl` output. This is ParaBank's response behaviour, not a data leak introduced by this test framework.

The tested REST endpoints accepted requests without a browser session in local testing.

The transfer API declares `application/json` but returns an unquoted plain-text success message.

The create-account response reported `balance: 0`, although the stored balance was $100 after the opening deposit. The reason for the response value is unverified.

API error behaviour has not been verified.

### OpenAPI specification mismatch

The specification describes `GET .../transactions/amount/{amount}` as "create". GET is not expected to create resources, and the SOAP equivalent is described as retrieving transactions. This endpoint has not been tested, so its actual behaviour remains unverified.

### API seeded data dependency

The customer API tests use ParaBank's seeded `john/demo` data.
The API transfer and API-assisted UI transfer tests use newly registered customers.

## AI-assisted development

I used AI assistants to explain concepts and to review my code and documentation. I wrote the code and the decisions in this repository myself and can explain each of them.
