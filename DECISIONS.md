### Technical decision: Defined ParaBank as a docker-compose.yml service instead of a manual docker run command

**Why I made it:** A README depends on a human reading it and typing the right command correctly. A Compose file turns the environment setup into configuration Docker can execute directly, so the same setup runs identically locally and in CI.

**Risk it reduces:** It reduces setup drift and human error — for example, forgetting the correct image tag, port mapping, environment variables, or other flags when recreating the container later or when CI starts it without human intervention.

**Trade-off:** For a single container, Compose adds another configuration file and some abstraction that may not strictly be necessary. It also creates resources such as a default Docker network automatically, which adds a small amount of complexity compared with one direct docker run command.


### Technical decision: Use conditional spread instead of `workers: undefined` in playwright.config.ts

**Why I made it:** `exactOptionalPropertyTypes` in tsconfig.json rejects an explicit `undefined` value for an optional property not typed as `T | undefined`, which is how Playwright's config type declares `workers`.

**Risk it reduces:** a type error that would fail `tsc --noEmit` in CI.

**Trade-off:** slightly less obvious syntax than the Playwright-generated default.


### Technical decision: Treated an intermittent login test failure as a flake, not a defect

**Why I made it:** A single run of "existing customer can log in" failed on the `Accounts Overview` heading timeout, with identical credentials that passed both manually and in every other run. Before assuming flakiness, I added a temporary `console.log(JSON.stringify(password))` to rule out a hidden-character or env-loading-order issue in the credential value.

**Risk it reduces:** treating every failure as automatically the app's fault, or automatically the test's fault, without evidence either way. Also reduces the risk of masking a real defect by adding a longer timeout speculatively.

**Trade-off:** the failure is unexplained rather than root-caused. I reran the suite three consecutive times, all passed, so I accepted "not reproducible" as enough evidence to move on rather than spending further time chasing a single occurrence.


### Technical decision: Register a customer twice through the UI to set up the duplicate-username test

**Why I made it:** No API client exists yet (A3.1 not yet built). The UI registration flow is the only available way to create a pre-existing customer at this stage.

**Risk it reduces:** none directly, this is a necessary workaround, not a risk mitigation.

**Trade-off:** slower test, and it depends on the first registration succeeding before the actual assertion under test runs.



### Technical decision:
Use randomUUID() instead of Date.now() for generated customer usernames.

**Why I made it:** A registration test unexpectedly received a duplicate-username error even though the username was generated with Date.now(). The exact root cause was not confirmed. Rather than assume the failure was caused by a timestamp collision, I changed the generator to remove execution timing as a dependency.

**Risk it reduces:** Reduces the chance of test-data collisions when tests run quickly, repeatedly, or in parallel.

**Trade-off:** UUID-based values are less readable than timestamps, and this change does not prove that timestamp collision caused the original failure.


### Technical decision: Keep `fullyParallel: true` globally, but use `test.describe.configure({ mode: 'default' })` in the login and registration specs.


**Why I made it:** 
- Registration tests failed when they ran in parallel, but passed when run one at a time.
- The valid-login test failed when it ran at the same time as another credential-based login request.
- Changing the invalid-login username did not fix the issue, so the problem was not caused by both tests using the same account.
- Empty-submit could run beside valid login without causing the failure.
- The same tests passed consistently with one worker.
- This points to a concurrency problem in parts of the local ParaBank backend.
- The exact backend/database mechanism was not identified.

**Risk it reduces:** Removes known parallel-execution flakiness from login and registration tests.

**Trade-off:** Tests inside these specs run one after another, so they take slightly longer. Other specs can still run in parallel. This only stops tests inside the same spec from racing each other. If tests in different files later interfere with the same backend at the same time, a broader solution will be needed.

**Why not `serial`:**
The tests are independent. `serial` can skip later tests after one fails and retry the group together. `mode: 'default'` prevents parallel execution in the spec while keeping each test independent.