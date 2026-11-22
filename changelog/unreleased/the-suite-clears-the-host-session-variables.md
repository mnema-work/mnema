Changed

- **The test suite clears the session variables of the hosts before any test.** Run from inside an agent's session
  (`CLAUDE_CODE_SESSION_ID` set), the suite no longer reads the person's words at the accept gate and its spawned processes
  inherit a clean environment, as on the CI. A guard fails when a host session variable named in the host table is not cleared.
