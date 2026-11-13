Added

- **CodeQL reads the code from a workflow of the repository.** `.github/workflows/codeql.yml` analyzes the JavaScript and
  TypeScript, the Python verifier and the workflows, with the default query suite, on every pull request, on `main` and
  every Tuesday; its alerts are in the Security tab. It is not one of the checks a pull request must carry.
