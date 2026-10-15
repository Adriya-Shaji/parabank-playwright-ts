# ParaBank Playwright TypeScript Framework

## Overview

This is a personal portfolio test automation framework built with Playwright and TypeScript. It tests selected banking flows against a local ParaBank application running in Docker.

This is a personal project and is not based on client code.

## Why ParaBank, and why local Docker

I chose ParaBank because it is a banking demo application, so its customer, account and transaction flows are relevant to my previous banking testing experience.

I run ParaBank locally in Docker instead of relying on the public hosted environment because the public environment is shared and can reset.

A fresh container can require application/database initialisation through the ParaBank home page. I found this behaviour while debugging the GitHub Actions pipeline.

## Running it locally

### Prerequisites

- Node.js 20 or later (CI runs 20, I develop on 22)
- Docker

### 1. Start ParaBank

```bash
docker compose up -d
```

This reads `docker-compose.yml` and starts ParaBank in the background.

### 2. Initialise ParaBank

Open this page once in your browser:

```text
http://localhost:8080/parabank/index.htm
```

During manual testing with a fresh container, registering before opening the home page returned a 500 error, while following the home-page redirects first allowed registration to succeed.

A separate fresh local run of the Playwright suite also passed once without this manual step, so the exact trigger is not fully understood. Opening the home page first is currently the safer local setup.

### 3. Install dependencies

On the first setup:

```bash
npm ci
npx playwright install chromium
```

`npm ci` installs the package versions recorded in `package-lock.json` and fails if the lockfile and `package.json` do not match.

`npx playwright install chromium` downloads the Chromium browser that Playwright uses for the tests.

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

The current suite contains 8 tests covering:

- ParaBank home page loads
- New customer registration and automatic login
- Registered customer persists and can log in again
- Duplicate username registration is rejected
- Registered customer can log in and view the account overview
- Incorrect password is rejected
- Empty login credentials show a validation error
- A savings account can be opened and the account balances update

## What is not tested

The current framework does not yet cover:

- Money transfers
- Account details page
- API testing
- A complete end-to-end customer journey
- Cross-browser execution
- Accessibility testing
- Performance testing

The current Playwright project runs against Chromium.

## CI with GitHub Actions

The project uses GitHub Actions to run the Playwright suite:

- On pull requests
- On pushes to `main`

The CI job:

1. Runs on an Ubuntu runner
2. Starts ParaBank as a Docker service container
3. Sets up Node.js 20
4. Installs dependencies with `npm ci`
5. Installs Chromium and its required system dependencies
6. Waits for ParaBank to be ready
7. Runs the Playwright test suite
8. Uploads the Playwright HTML report
9. Prints the ParaBank container logs if the job fails. In failed run #2, the logs showed a database `object not found` error.

The readiness check follows the ParaBank home-page redirects:

```bash
curl -sfL -m 10 http://localhost:8080/parabank/index.htm
```

The check is retried up to 30 times, five seconds apart.

The HTML report is uploaded with `if: always()` so test evidence is preserved even when the test step fails.

## Debugging the first CI failure

The first CI run failed 7 of 8 tests, and the Playwright trace showed `POST /register.htm` returning 500.

The failure was linked to ParaBank initialisation behind the home-page redirect path.

I reproduced the 500 with a fresh local container when registering before following that path.

The CI readiness check was changed to follow the redirects through `index.htm` before starting the tests.

After the change, the PR workflow passed twice consecutively with all 8 tests passing.

## Test data

Registration tests create unique customers at runtime rather than relying on manually created users.

The login tests also register a new customer before each test, log out, and then exercise the login scenario.

This means the tests do not depend on `TEST_*` environment variables or customer data created by hand in a previous ParaBank session.

## Known limitations

### Single-worker execution

The suite currently runs with:

```ts
workers: 1
```

A parallel run previously failed once with:

```text
This username already exists.
```

Serial runs passed. The exact cause of the parallel failure has not been established.

`workers: 1` is therefore a current stability measure, not a proven root-cause fix.

### Demo and portfolio scope

ParaBank is a simplified demo application, and this is a portfolio framework rather than production infrastructure.

### Locators

Where I could not use a role or label locator, the framework uses stable attributes such as `input[name="username"]`.

### Docker image version

The `parasoft/parabank` Docker image is not pinned to a specific version. A future image release could therefore change application behaviour without any change to this repository.