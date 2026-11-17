### Technical decision: Defined ParaBank as a docker-compose.yml service instead of a manual docker run command

**Why I made it:**

A README depends on a human reading it and typing the right command correctly. A Compose file turns the environment setup into configuration Docker can execute directly, so the same setup runs identically locally and in CI.

**Risk it reduces:**

It reduces setup drift and human error — for example, forgetting the correct image tag, port mapping, environment variables, or other flags when recreating the container later or when CI starts it without human intervention.

**Trade-off:**

For a single container, Compose adds another configuration file and some abstraction that may not strictly be necessary. It also creates resources such as a default Docker network automatically, which adds a small amount of complexity compared with one direct `docker run` command.


### Technical decision: Use conditional spread instead of `workers: undefined` in playwright.config.ts

**Why I made it:**

`exactOptionalPropertyTypes` in `tsconfig.json` rejects an explicit `undefined` value for an optional property not typed as `T | undefined`, which is how Playwright's config type declares `workers`.

**Risk it reduces:**

A type error that would fail `tsc --noEmit` in CI.

**Trade-off:**

Slightly less obvious syntax than the Playwright-generated default.

This decision has been superseded by the single-worker decision below: the configuration now sets `workers: 1` directly.

### Intermittent login failure was not reproduced in three reruns

**Why I made it:**

A single run of "existing customer can log in" failed on the `Accounts Overview` heading timeout, with identical credentials that passed both manually and in every other run. Before assuming flakiness, I added a temporary `console.log(JSON.stringify(password))` to rule out a hidden-character or env-loading-order issue in the credential value.

**Risk it reduces:**

Treating every failure as automatically the app's fault, or automatically the test's fault, without evidence either way. Also reduces the risk of masking a real defect by adding a longer timeout speculatively.

**Trade-off:**

The failure is unexplained rather than root-caused. I reran the suite three consecutive times, all passed, so I accepted "not reproducible" as enough evidence to move on rather than spending further time chasing a single occurrence.

Later evidence showed that overlapping customer registrations can fail intermittently in ParaBank. It is possible that this earlier login failure was related to the same concurrency behaviour later reproduced during registration, but I did not establish that link.


### Technical decision: Register a customer twice through the UI to set up the duplicate-username test

**Why I made it:**

No API client exists yet (A3.1 not yet built). The UI registration flow is the only available way to create a pre-existing customer at this stage.

**Risk it reduces:**

None directly; this is a necessary workaround, not a risk mitigation.

**Trade-off:**

Slower test, and it depends on the first registration succeeding before the actual assertion under test runs.


### Technical decision: Use `randomUUID()` instead of `Date.now()` for generated customer usernames

**Why I made it:**

A registration test unexpectedly received a duplicate-username error even though the username was generated with `Date.now()`. The exact root cause was not confirmed. Rather than assume the failure was caused by a timestamp collision, I changed the generator to remove execution timing as a dependency.

A later registration-only investigation reproduced the duplicate-username error with two different UUID-based usernames. UUIDs did not remove the failure, so uniqueness of the generated username was not the sole cause of the earlier failure.

**Risk it reduces:**

Reduces the chance of test-data collisions when tests run quickly, repeatedly, or in parallel.

**Trade-off:**

UUID-based values are less readable than timestamps, and this change does not prove that timestamp collision caused the original failure.


### Technical decision: Keep `fullyParallel: true` globally, but use `test.describe.configure({ mode: 'default' })` in the login and registration specs

**Why I made it:**

- Registration tests failed when they ran in parallel, but passed when run one at a time.
- The valid-login test failed when it ran at the same time as another credential-based login request.
- Changing the invalid-login username did not fix the issue, so the problem was not caused by both tests using the same account.
- Empty-submit could run beside valid login without causing the failure.
- The same tests passed consistently with one worker.
- This points to a possible concurrency problem in parts of the local ParaBank backend.
- The exact backend/database mechanism was not identified.

**Risk it reduces:**

Removes known parallel-execution flakiness from login and registration tests.

**Trade-off:**

Tests inside these specs run one after another, so they take slightly longer. Other specs can still run in parallel. This only stops tests inside the same spec from racing each other. If tests in different files later interfere with the same backend at the same time, a broader solution will be needed.

**Why not `serial`:**

The tests are independent. `serial` can skip later tests after one fails and retry the group together. `mode: 'default'` prevents parallel execution in the spec while keeping each test independent.

This decision has been superseded by the later single-worker decision. In a later two-worker run of `accounts.spec.ts` and `register.spec.ts`, the specs ran concurrently with different UUID-based usernames and one registration failed. That showed that limiting parallelism only within individual spec files was not sufficient.


### Technical decision: No `BasePage` introduced during POM formalisation

**Why I made it:**

The current page objects do not yet share enough meaningful behaviour to justify inheritance. They all use Playwright's `Page` object, and containers such as `#rightPanel` appear on multiple pages, but that does not make them useful shared abstractions. `#rightPanel` contains different content and behaviour depending on the page, such as login errors, registration results, or account balances, so there is no common method or assertion to extract. A shared selector alone is not enough reason to introduce a base class or component.

**Risk it reduces:**

It reduces the risk of creating a premature inheritance hierarchy or a growing `BasePage` that becomes a dumping ground for unrelated helpers, locators, and feature-specific behaviour.

**Trade-off:**

Some small pieces of setup, such as storing the Playwright `Page` reference, remain duplicated across page objects for now. I am accepting that minor duplication until genuine cross-page behaviour emerges that can be extracted with a clear responsibility.


### Run Playwright tests with one worker and disable fully parallel execution

**Technical decision:**

Configure Playwright with `workers: 1` and `fullyParallel: false`. One worker prevents concurrent execution. I disabled fully parallel execution because concurrent registration has failed, and I do not currently want tests within a file scheduled across multiple workers.

**Why I made it:**

One registration failure was observed in a 10-test `--workers=4` run with `This username already exists`, even though each test generated a different UUID-based username.

I isolated the behaviour with a registration-only experiment on an already initialised ParaBank container. Two workers registered two different UUID-based usernames concurrently; one registration succeeded and the other was rejected as an existing username.

I ruled out duplicate usernames being generated by the factory, browser-side double submission, and database startup as explanations for that reproduction. The failure appears to be caused by concurrent registration handling in ParaBank, but the exact backend mechanism remains unverified.

Failure rate not measured.

`fullyParallel: false` alone does not prevent different test files from running concurrently. The single-worker setting prevents concurrency across the suite.

**Risk it reduces:**

Contains the observed concurrent registration failure by preventing simultaneous registration during normal local and CI test execution. It does not fix the application defect.

**Trade-off:**

Serial execution is slower and does not exercise state-changing flows concurrently. This is a stability measure, not a root-cause fix.

Revisit this decision if the registration defect is resolved, the environment changes, or the Playwright test step in CI exceeds 60 seconds on three consecutive runs.

The 60-second threshold is approximately five times the 12.7-second baseline observed in one CI test run. It is a review trigger, not a performance limit.


### Retry in CI only and record traces on first retry

**Technical decision:**

Use `retries: process.env.CI ? 2 : 0` and `trace: 'on-first-retry'`.

**Why I made it:**

Zero local retries show failures immediately. Two CI retries provide a chance to recover from two consecutive transient failures. More retries could hide instability and increase execution time. Two is a starting point, not a proven optimum.

First-retry tracing avoids the overhead of recording traces for every test.

**Risk it reduces:**

Stops a transient failure from immediately blocking a merge and reduces routine tracing overhead.

**Trade-off:**

The trace captures the first retry, not the original failure. Timing issues may not reproduce. `screenshot: 'only-on-failure'` captures one frame of the failed state, without action history.

Retries can hide instability if flaky results are ignored.

The test-scoped `customer`, `registeredCustomer` and `authenticatedPage` fixtures run again on each attempt, creating fresh customer data. Registration and login repeat before the test body, increasing execution time. Previous backend changes are not rolled back.

**Revisit trigger:**

Review the HTML report for flaky results. Reassess the retry count if the same test is flaky in two consecutive CI runs.

**Unverified:**

No flaky result has been observed in CI. The `list` reporter works locally with `CI=true`, but has not yet been verified in GitHub Actions.


### Remove video recording and keep failure screenshots

**Technical decision:**

Remove `video: 'retain-on-failure'`. Keep `screenshot: 'only-on-failure'` and `trace: 'on-first-retry'`.

**Why I made it:**

Screenshots capture the failed state. In CI, traces record the first retry. A screenshot is usually enough for visible failures in ParaBank's mostly server-rendered UI.

Locally, I use `--trace on` or Playwright UI mode for debugging because local retries are disabled.

**Risk it reduces:**

Avoids recording video for every test just to retain evidence from failures. The overhead has not been measured.

**Trade-off:**

Without video, I lose the full visual sequence of the initial failure. A screenshot shows one frame, while the CI trace captures the retry, which may behave differently.

**Revisit trigger:**

Reconsider video if a failure cannot be explained using the screenshot, retry trace and ParaBank container logs.

**Unverified:**

No test failure has occurred in the inspected runs, so no failure screenshot has been observed in `test-results/`. The CI workflow uploads only `playwright-report/`; screenshot availability in that artefact remains unverified.


### Keep Playwright's default timeouts explicit

**Technical decision:**

Set `timeout: 30_000` and `expect.timeout: 5_000`. Both match Playwright's documented defaults.

**Why I made it:**

Explicit timeouts make the settings visible and reviewable.

The slowest test took 1.1s to 2.1s across local runs, and 2.6s and 3.4s in two GitHub Actions runs, all using one worker.

I kept the 30s test timeout to allow for slower CI execution and fixture setup. The 5s assertion timeout has been sufficient in observed runs, and no explicit timeout overrides were found in the test or helper files. Neither value has been tuned.

**Risk it reduces:**

Avoids relying on hidden defaults that reviewers may overlook.

**Trade-off:**

A stuck test can take up to 30s per attempt, or approximately 90s across three attempts with two CI retries.

A test slowing from 1s to 20s could still pass without highlighting a performance regression.

**Revisit trigger:**

Review timeouts if the slowest test exceeds 10s in three consecutive CI runs, using per-test durations from the CI log.

The 10s threshold is about three times the 3.4s maximum observed in CI. It is a review trigger, not a tuned performance limit.

**Unverified:**

CI per-test durations come from two runs. They vary between runs.


### Use a trailing-slash `baseURL` with relative page paths

**Technical decision:**

Keep `baseURL: 'http://localhost:8080/parabank/'`. Page objects use relative paths such as `goto('overview.htm')`, without a leading slash.

**Why I made it:**

My Node.js URL check confirmed:

- `accounts.htm` with `/parabank/` resolves to `/parabank/accounts.htm`.
- `/accounts.htm`, or a base ending in `/parabank` without a trailing slash, resolves to `/accounts.htm`, dropping the application path.

A `grep` search for `goto(` confirmed that the current navigation calls use relative paths.

**Risk it reduces:**

Keeps the UI host and application path in one configuration setting instead of repeating them in page objects.

**Trade-off:**

The `/parabank/` path is also used in `utils/parabankApiClient.ts` and `scripts/wait-for-parabank.sh`. Changing environments requires coordinated edits, as documented in the README.

**Revisit trigger:**

If a second environment is introduced, refactor URL configuration across Playwright, the API client and the readiness script in a separate PR, using `PARABANK_URL` as the shared setting.

**Unverified:**

`smoke.spec.ts` calls `page.goto('index.htm')` directly, unlike other tests that use page objects. This is an inconsistency, not a confirmed defect.

The Node.js check verified URL resolution rules. Passing Playwright tests confirmed that the current navigation works locally.


### Add the `list` reporter beside HTML in CI

**Technical decision:**

Use `[['list'], ['html', { open: 'never' }]]` in CI. Locally, keep HTML with `open: 'on-failure'`.

**Why I made it:**

The `list` reporter shows individual test results and durations in the CI log. HTML provides detailed reports for debugging.

`open: 'never'` prevents the HTML reporter from opening or serving the report and blocking CI.

A GitHub Actions run confirmed that the `list` reporter displays individual test results and durations.

**Risk it reduces:**

Makes failed and flaky tests easier to notice in CI logs without downloading the HTML report.

**Trade-off:**

Adds console output but no extra report artefact. JUnit XML was not added because the workflow does not use it.

**Revisit trigger:**

Review the reporter setup if CI logs become difficult to read or a tool requires JUnit XML.

**Unverified:**

The `list` reporter and per-test durations are verified in GitHub Actions. The HTML report artefact (playwright-report, 221 KB) was uploaded in CI. Flaky-test markers remain unverified because no test retried.


### Keep `goto()` on `AccountsOverviewPage`

**Technical decision:**

Keep `goto()` on `AccountsOverviewPage` for direct navigation to the overview page.

**Why I made it:**

A scratch test showed that direct navigation to `overview.htm` preserves the authenticated session after registration. Separately, as a design choice, a focused account test does not need to exercise the left-panel navigation path. The scratch test was deleted after verification, so it is not part of the repository.

**Risk it reduces:**

Avoids making focused account tests depend on extra navigation UI just to reach the overview page.

**Trade-off:**

Direct navigation does not verify the left-panel `Accounts Overview` link itself. A broader A2.7 journey test is planned to exercise that navigation path.


### Parameterised locators are methods

**Technical decision:**

Use methods for locators that need runtime arguments, and use `public readonly` fields only for plain locators that the spec must assert on directly.

**Why I made it:**

A parameterised locator such as `getAccountRow(accountNumber)` needs input at call time, while a fixed locator such as `newAccountId` can be created once and exposed when the spec needs it.

**Risk it reduces:**

Keeps interaction locators private so specs cannot bypass the page object by reaching into its internals and clicking elements directly.

**Trade-off:**

A locator method creates a new locator each time it is called, while a field is created once. For these small locators the cost is expected to be negligible, but it has not been measured.


### Follow ParaBank redirects in the CI readiness check (superseded)

**Superseded**

This approach was replaced by the entry below.

**Technical decision:**

The `Wait for ParaBank` step requests the home page and follows redirects. It retries up to 30 times, 5 seconds apart, with a 10-second limit on each request:

```bash
curl -sfL -m 10 http://localhost:8080/parabank/index.htm
```

**Why I made it:**

The original check used `curl -sf` against `/parabank/`. That URL returns a 302 to `index.htm`, which then redirects to `initializeDB.htm`. The old check treated the first 302 as success and stopped.

In failed CI run #2, the ParaBank server log showed `user lacks privilege or object not found: SEQUENCE`, followed by `Database not yet initialized. Initializing...`. That is consistent with the tests starting before the database was set up.

**Risk it reduces:**

It reduces the risk of CI declaring ParaBank ready too early and starting the tests before the application is ready for registration. In the first CI run, the old check passed on attempt 1 in about 1 second, but 7 of 8 tests then failed when registration returned HTTP 500.

**Trade-off:**

The check only proves that the home-page redirect path completes. It could still pass while registration or another backend function is failing, so it does not prove that every ParaBank feature is ready.

Why one fresh local run passed without opening the home page first was not established.


### Initialise ParaBank database and verify seeded data before starting tests

**Technical decision:**

CI runs `scripts/wait-for-parabank.sh` before Playwright. The script calls ParaBank's `initializeDB` endpoint until it receives HTTP `204`, then calls the seeded `john/demo` login endpoint until it receives HTTP `200`.

**Why I made it:**

The earlier readiness check followed the `index.htm` redirect path, but that proved only that the home-page redirect path completed, not that the database was usable. The `object not found: SEQUENCE` error came from Run #2, which used an earlier `/parabank/` check without redirect following. No CI run failed on the `index.htm` check, so this script is a stricter check rather than a fix for an observed failure of the previous one.

The new probe checks two stronger conditions: the database-initialisation operation completed successfully, and seeded customer data can be read through the REST layer.

The probe passed 3 of 3 fresh-container local validation runs, with all 8 Playwright tests passing immediately afterward. It also passed in two GitHub Actions runs, where `initializeDB` returned `204` on attempt 1, the seeded login returned `200` on attempt 1, and all 8 Playwright tests passed.

The retry path was observed locally but was not exercised in CI.

**Risk it reduces:**

Reduces the risk of starting the Playwright suite when the ParaBank web server is reachable but the database is not yet usable for reads.

**Trade-off:**

The probe depends on ParaBank's `initializeDB` admin endpoint, the seeded `john/demo` account, and their current HTTP response behaviour. A future ParaBank image could change these and cause CI to fail until the probe is updated.

The script deliberately treats only HTTP `204` as successful initialisation, so an unexpected response fails loudly rather than being accepted silently.

The seeded-login probe proves that database-backed customer data is readable through the REST layer. It does not directly prove that customer registration works.

The local validation and two CI runs are a small sample; no failure rate was measured. The old readiness check was not rerun with `workers: 1`, so the successful runs do not establish that the new probe caused the improvement.


### Use test-scoped fixtures instead of shared `beforeEach` setup

**Technical decision:**

Use custom Playwright fixtures for reusable test setup and state, including page objects, unique customer data, registered customers, and authenticated browser state.

Keep state-changing fixtures test-scoped.

**Why I made it:**

The previous login setup used `beforeEach` to register and log out a customer before every login test. This meant some tests received setup they did not need. For example, the empty-credentials test registered a customer even though it only needed the login page.

The registration setup was also duplicated between `login.spec.ts` and `accounts.spec.ts`.

Fixtures let each test request only the state it needs, make dependencies visible in the test signature, and allow larger setup such as `authenticatedPage` to build on smaller fixtures such as `registeredCustomer`.

A worker-scoped fixture is shared by tests that run in the same worker process, so state-changing setup could leak between tests. The accounts test expects exactly one account, so reusing the same customer across tests could make the result depend on test order.

Removing the shared `beforeEach` also exposed a hidden dependency: the empty-credentials test had relied on the hook leaving the browser on the login page. The test now navigates there explicitly.

**Risk it reduces:**

Reduces unnecessary setup and duplicated registration logic.

Replaces module-level `let` variables with per-test fixture values, so tests do not depend on shared mutable state.

Makes hidden setup dependencies easier to see from the test signature.

**Trade-off:**

The fixture dependency chain is more abstract than inline setup, so a reader has to understand where each test state comes from.

`authenticatedPage` performs a real login for every test that requests it, which adds extra UI setup time.

Because `authenticatedPage` depends on `registeredCustomer`, a failure in registration or login can make every test that uses `authenticatedPage` fail. The fixture boundary makes the failure location clearer, but the dependency still creates a wider blast radius.


### JSON Response Handling

**Technical decision:**

Set `Accept: application/json` once in `ParaBankApiClient` and assert the response `content-type` in each API test before parsing JSON.

**Why I made it:**

My `curl` tests showed that ParaBank returns `Content-Type: application/xml` without the `Accept` header and `application/json` when the header is included.

**Risk it reduces:**

Without the header assertion, an unexpected XML response could pass the HTTP 200 check and fail later at `response.json()` with a parsing error that doesn't clearly identify the wrong response format.

**Trade-off:**

Checking `content-type` in every test adds repeated assertions. The client also always requests JSON, so tests that need a different format or no `Accept` header must use Playwright's `request` directly.


### Returning Raw APIResponse

**Technical decision:**

Return the raw Playwright `APIResponse` from the API client instead of parsing and returning the JSON body.

**Why I made it:**

I wanted assertions to remain in individual tests rather than shared client code, so failures are easier to trace back to the specific test scenario.

**Risk it reduces:**

Avoids hiding assertions inside shared client methods, where failures can be harder to trace to a specific scenario. It also preserves access to the raw HTTP status, which will be needed for negative-path testing.

**Trade-off:**

Each test repeats the same steps: checking the status, validating the `Content-Type` header and calling `response.json()`. If a developer forgets the header assertion, the test loses the protection against unexpected response formats established in JSON Response Handling Decision.


### REST Endpoints from the OpenAPI Specification

**Technical decision:**

Use REST endpoints documented in ParaBank's OpenAPI specification at `/parabank/services/bank/openapi.yaml`, rather than SOAP services.

**Why I made it:**

ParaBank's `services.htm` lists both SOAP and REST services. I used the OpenAPI specification to identify the REST endpoints and tested login, customer details and accounts against the running application.

**Risk it reduces:**

The specification provided the endpoint paths and HTTP methods, while my API tests confirmed that three of those endpoints work against the running application. This reduces reliance on documentation alone.

**Trade-off:**

SOAP services remain untested. The OpenAPI specification is not guaranteed to be accurate; for example, I found a GET operation described as "create". Documented behaviour still needs to be verified.


### Avoiding Database Reset Endpoints

**Technical decision:**

Do not call `/cleanDB` or `/initializeDB` in automated tests.

**Why I made it:**

The OpenAPI specification describes these as database clean and initialise operations. The SOAP service page also describes equivalent reset operations. My UI and API tests share the seeded `john/demo` data, so a database reset during execution could affect unrelated tests.

**Risk it reduces:**

The existing transfer test already changes account balances in the shared database. Calling a reset endpoint during execution could introduce further state changes and cause unrelated tests to fail.

**Trade-off:**

The suite cannot automatically restore a known database state between runs, so tests remain dependent on existing data and changes from earlier tests. Test independence is not fully established: one registration failure was observed in a `--workers=4` run, with the error `"This username already exists"`.

### API-assisted UI transfer test

**Technical decision:** Create the SAVINGS account through the API, then transfer funds through the UI.

**Why I made it:** Keeps account setup separate from the transfer behaviour being tested.

**Risk it reduces:** Reduces the chance of an account-creation UI failure being mistaken for a transfer failure.

**Trade-off:** API setup bypasses account creation through the UI.

**How I would explain it in interview:** I use the API to prepare account data so the UI test focuses on transferring funds.

**Possible interviewer challenge:** Doesn't this bypass UI testing?

**My defence:** Separate tests cover SAVINGS account creation through the UI and the full banking journey. Registration remains in the UI because no registration endpoint was identified in the OpenAPI specification.

### Account read-back validation

**Technical decision:** Return the account retrieved through GET, not the account creation response.

**Why I made it:** The creation response reported `balance: 0`, but the stored balance was $100.

**Risk it reduces:** Detects missing accounts, incorrect customer ownership, wrong account types and non-finite balances.

**Trade-off:** Adds an API request and dependency on the account retrieval endpoint.

**How I would explain it in interview:** The create response showed a balance of 0 while the stored balance was 100, so I return the read-back account instead.

**Possible interviewer challenge:** Does your helper verify the opening balance is $100?

**My defence:** No. It verifies the account ID, customer ID, type and finite balance, not a specific opening amount. I also tested that an incorrect expected account type produces a useful error.

### Account type mapping

**Technical decision:** Map `CHECKING` to `0` and `SAVINGS` to `1` inside the API client.

**Why I made it:** These values were verified from ParaBank's browser requests.

**Risk it reduces:** Prevents incorrect numeric codes being repeated across tests.

**Trade-off:** The mapping needs maintenance; LOAN is excluded because its code is unverified.

**How I would explain it in interview:** Tests use readable account types while the API client handles the numeric values.

**Possible interviewer challenge:** Why not support LOAN?

**My defence:** I added only verified types needed for the current tests.

### Deferred refactoring

**Technical decision:** Defer extracting `getCustomerId()`, `getSourceAccountId()` and refactoring `openAccountAndConfirm()`.

**Why I made it:** Login and source-account validation are already duplicated, but I prioritised completing A3.2.

**Risk it reduces:** Keeping refactoring separate makes it easier to identify whether a failure comes from the new feature or changes to existing code.

**Trade-off:** Login and source-account validation are duplicated across two tests, increasing maintenance effort.

**How I would explain it in interview:** I identified the duplication and deferred extraction to a separate change.

**Possible interviewer challenge:** Shouldn't shared setup be extracted now?

**My defence:** Yes, reuse is justified. I chose to finish and verify A3.2 first.

### Balance comparison in cents

**Technical decision:** Convert balances to integer cents before comparing them.

**Why I made it:** Decimal arithmetic in JavaScript can introduce floating-point rounding differences.

**Risk it reduces:** Avoids false failures caused by floating-point precision.

**Trade-off:** Assumes balances have at most two decimal places.

**How I would explain it in interview:** I compare integer cents instead of subtracting decimal currency values.

**Possible interviewer challenge:** Is `Math.round(amount * 100)` suitable for all financial calculations?

**My defence:** No. It is suitable for the tested balances, but production financial calculations need stricter money handling.


## Parallel Execution Investigation — 17 November 2026

### Why I investigated this

My Playwright framework uses **UUID-based usernames** and **test-scoped fixtures** to create separate test customers.

I wanted to check whether the tests could run reliably with multiple Playwright workers against the same ParaBank Docker container.

### Test results

I ran two experiments using **4 workers** and `--repeat-each=5`.

| Test run | Total | Passed | Failed |
|---|---:|---:|---:|
| Full suite | 75 | 71 | 4 |
| Targeted rerun | 30 | 27 | 3 |

In the full suite, three failures happened during customer registration and one during API account creation.

In the targeted rerun, all three failures happened during registration.

### Issue 1: Customer registration

ParaBank rejected newly generated usernames with this message:

`This username already exists.`

I investigated the three failures using **Playwright Trace Viewer**.

I found that:

- Each test used a different UUID-generated username.
- Each failing trace contained only one `POST /parabank/register.htm` request.
- The server returned HTTP `200`, but the HTML response contained the duplicate-username error.
- The tests failed because the registration-success message never appeared.

I then checked the **Docker container logs**. `RegisterCustomerController` recorded the same error for all three usernames.

| Username | Log time (UTC) |
|---|---|
| `cust_0789a279c079` | 19:05:24.581 |
| `cust_812ce1ddcc88` | 19:05:24.587 |
| `cust_ff03a9e5ea2f` | 19:05:31.957 |

Two rejections occurred about **6 milliseconds apart**, on separate server request threads.

I also tried logging in with four rejected usernames: three from the targeted run and one from the full-suite run. All four failed authentication using the expected password.

The Docker container had not restarted during these tests.

**What I confirmed:** ParaBank rejected different generated usernames during concurrent execution, even though each failing browser trace showed only one registration request.

**What is still unknown:** Why ParaBank returned the duplicate-username error. Failed logins do not independently prove that the customer records were absent from the database.

### Issue 2: API account creation

One test failed while creating a new bank account through the API.

The API returned **HTTP 400**.

I checked the ParaBank server logs and found:

- `DuplicateKeyException`
- `SQLIntegrityConstraintViolationException`
- A primary-key constraint violation on the `ACCOUNT` table
- The failing SQL operation: `INSERT INTO Account (id, customer_id, type, balance) VALUES (?, ?, ?, ?)`

The logs also referenced customer `28085` and source account `37986`, matching the failed test.

**What I confirmed:** Account creation failed because the database rejected an `ACCOUNT` insert that violated a primary-key constraint.

**What is still unknown:** Why a conflicting account ID was used.

### Related investigation

I found an external GitHub report describing similar ParaBank issues:

[DEF-003 — Concurrent writes fail intermittently](https://github.com/gavenjohn/parabank-playwright-ts/blob/main/docs/defects/DEF-003-concurrent-registration-false-duplicate.md)

According to the report, its author inspected ParaBank's bytecode and found two possible explanations:

- **Account ID generation:** `JdbcSequenceDao.getNextId` uses separate read and update operations without sufficient locking. Concurrent requests may therefore use the same account ID.
- **Registration error handling:** `RegisterCustomerController.onSubmit` catches `DataIntegrityViolationException` and displays `error.username.already.exists`, even when the database error may not be caused by a duplicate username.

This could explain why ParaBank rejects unique usernames with a misleading error message.

My `DuplicateKeyException` on the `ACCOUNT` primary key is also consistent with the reported account-ID generation problem.

However, I have **not independently checked the bytecode** or confirmed that my Docker image uses exactly the same implementation. I am treating these findings as external evidence, not a proven root cause for my environment.

### My decision

I will keep:

```typescript
workers: 1,
fullyParallel: false,
```

This allows the tests to run sequentially against the shared ParaBank instance.

I have not added retries to work around the parallel failures.

My existing Playwright configuration uses:

```typescript
retries: process.env.CI ? 2 : 0,
```

CI also uses one worker, so these existing retries do not hide the parallel-execution failures observed during the experiments.

I will not add arbitrary waits or extra retries just to make the parallel tests pass.

### Trade-off

**Benefit:** Single-worker execution avoids the concurrent-execution failures observed during testing and provides more reliable regression results in this environment.

**Drawback:** Tests take longer because they run sequentially.

### Alternative considered

I considered running **one isolated ParaBank Docker container and database per worker**.

This could prevent workers from interfering with each other through shared backend state.

I decided not to implement it because the current test suite is small, and the additional Docker setup and maintenance would add unnecessary complexity.

### Future improvement

If I need parallel execution later, I will:

1. Verify the reported `JdbcSequenceDao` and `RegisterCustomerController` implementations against my ParaBank image.
2. Investigate isolated ParaBank containers and databases for parallel workers.
3. Run the concurrency tests again to check whether registration and account creation are reliable.

### Final outcome

I reproduced the failures, examined the Playwright traces, checked the HTTP requests and responses, and matched the failures with Docker server logs.

I confirmed a database primary-key violation during account creation and server-side username rejections during registration.

I could not independently confirm the exact backend mechanisms behind these failures.

**Final decision: Keep `workers: 1` for reliable test execution against the shared ParaBank environment.**


## Negative API tests pin observed error behaviour

**Decision:** Negative API tests assert the exact status, content type and error text that ParaBank returns today.

**Observed:** Invalid credentials and unknown customer ids return HTTP 400 with a `text/plain` body. Swagger documents a `default` response with `application/json` and does not specify error statuses or formats.

**Why exact values:** A range check such as "any 4xx" would hide a regression to 5xx. An exact text match verifies that the response body contains only the expected error message, rather than customer data.

**Design concerns noted, not raised as defects:**
- 401 would be more conventional for failed authentication, although this endpoint does not use HTTP authentication.
- Credentials are passed in the URL path, which exposes them to access and proxy logs. A production banking API should not do this.
- Swagger lists `application/json` for its default response, but the observed error responses use `text/plain`. The documentation does not clearly define error response formats.
- A successful login returns the customer's full SSN. A production banking API should mask or omit it, because returning it on every login widens exposure for no business need.

**Trade-off:** If ParaBank changes its error format, these tests fail. That is intended, because a contract change should be reviewed rather than silently accepted.

## Known defect: Negative transfer amount

**Observed:** ParaBank accepts `amount=-10` and returns HTTP 200. Instead of rejecting the request, it adds $10 to the source account and removes $10 from the destination account.

**Decision:** The test checks the expected behaviour: the request should fail and both balances should remain unchanged.

- `test.fail()` marks this as a known defect.
- `test.fail()` is placed after test setup so setup failures are reported normally.
- `expect.soft()` checks both balances and the API response without stopping at the first failure.

**When fixed:** Playwright will report an unexpected pass and fail the test run. Remove `test.fail()` and update the assertions if needed.

**Limitation:** Other failures after `test.fail()` may also be treated as expected. Check the test report to confirm the actual failure.

## Other observed transfer behaviour

- **Non-numeric amount:** `amount=abc` returns HTTP 404 with an empty response body. Neither account balance changes. The status code is misleading for invalid input, but the cause is not confirmed.
- **Invalid destination account:** Returns HTTP 400 with the message `Could not find account number {source} and/or {destination}`. The message does not identify which account is invalid.
- **Successful transfer:** Returns `Content-Type: application/json`, but the response body is plain text. Calling `response.json()` would fail.


## Tags: only where they cut across folders

**Decision:** Two tags. `@smoke` covers the UI home page and the API login. `@e2e` covers the end-to-end journey.

**Why `@smoke` includes an API test:** In CI Run #2 the home-page smoke test passed while ParaBank's database was not ready and 7 tests failed. The API login reads seeded data, so it confirms the database is up.

**Not added:** `@api` duplicates the `tests/api` folder, which can already be selected by path. `@regression` on every test would carry no information; the full run is the regression run.

**CI:** Runs the full suite in one step. The suite takes about 9 seconds, so separate smoke and regression stages would add complexity without saving time. Revisit if the suite grows to several minutes.
