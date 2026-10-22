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


### Run Playwright tests with one worker

**Technical decision:**

Configure Playwright with `workers: 1` for all test runs.

**Why I made it:**

Parallel runs passed sometimes and failed sometimes during customer registration with `This username already exists`, even though each test generated a different UUID-based username.

I isolated the behaviour with a registration-only experiment on an already initialised ParaBank container. Two workers registered two different UUID-based usernames concurrently; one registration succeeded and the other was rejected as an existing username.

I ruled out duplicate usernames being generated by the factory, browser-side double submission, and database startup as explanations for that reproduction. I did not establish the exact backend mechanism.

Failure rate not measured.

**Risk it reduces:**

Reduces false test failures caused by unreliable concurrent registration behaviour in the application under test.

**Trade-off:**

Serial execution is slower and does not exercise state-changing flows concurrently. This is a stability measure, not a root-cause fix.

Revisit this decision if ParaBank's concurrent registration behaviour changes, if the application is replaced with an isolated test environment, or if serial execution time becomes significant.


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

The earlier readiness check followed the `index.htm` redirect path, but that proved only that the home-page redirect path completed. Earlier CI evidence showed registration could still fail with database errors such as `object not found: SEQUENCE`.

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
