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


### Technical decision: Treated an intermittent login test failure as a flake, not a defect

**Why I made it:**

A single run of "existing customer can log in" failed on the `Accounts Overview` heading timeout, with identical credentials that passed both manually and in every other run. Before assuming flakiness, I added a temporary `console.log(JSON.stringify(password))` to rule out a hidden-character or env-loading-order issue in the credential value.

**Risk it reduces:**

Treating every failure as automatically the app's fault, or automatically the test's fault, without evidence either way. Also reduces the risk of masking a real defect by adding a longer timeout speculatively.

**Trade-off:**

The failure is unexplained rather than root-caused. I reran the suite three consecutive times, all passed, so I accepted "not reproducible" as enough evidence to move on rather than spending further time chasing a single occurrence.


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

This decision is partly superseded by the later single-worker decision: with `workers: 1`, specs do not currently execute in parallel.


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

In a parallel full-suite run, 1 of 8 tests failed during registration with `This username already exists.` The same broader pattern was recorded earlier in the A2.1 decision: registration and credential-based login tests failed under parallel execution and passed with one worker. No duplicate-username failure has been observed in the serial runs so far. The underlying cause has not been established.

**Risk it reduces:**

Reduces failures that have appeared only during parallel runs and makes the default `npx playwright test` use the execution mode that has been reliable so far.

**Trade-off:**

The suite currently takes about 5 seconds when run serially, so the cost is small at its current size, but serial execution will take longer as the suite grows. This avoids the observed symptom rather than fixing its underlying cause. Revisit this decision when the cause of the duplicate-username error is identified or when serial execution time becomes a problem.


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
