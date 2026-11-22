// The words of the diagrams of the packages and of the family: every one is a literal of the product.
//
// A line is written as pieces, each the literal it puts on the picture and the file of the repository that says it
// (`said`), joined by one of `SEPARATORS`. `the-front-page-is-drawn-from-the-console.test.ts` finds every literal in its
// file, finds nothing between two pieces but a separator, and finds no text on a picture that is not one of these lines.
// No line draws a record's id, which the command line prints new on every run. No host's name and no count that changes
// (kinds, hosts, tools) is drawn.

/** What may join two pieces of a line. */
export const SEPARATORS = Object.freeze([' · ', ' → ', ' ']);

/**
 * A literal of the product, and the file of the repository that says it, from the repository's root.
 * @param {string} literal
 * @param {string} where
 */
const said = (literal, where) => ({ said: literal, where });

/** @typedef {{ said: string, where: string }} Said */
/** @typedef {readonly (Said | string)[]} Line */

/**
 * What a line puts on the picture.
 * @param {Line} line
 */
export const textOf = (line) => line.map((p) => (typeof p === 'string' ? p : p.said)).join('');

const WORKFLOW = 'packages/chain/src/events/workflow.ts';
const ENTRY = 'packages/chain/src/chain/entry.ts';
const FIRST_RECORD = 'docs/first-record.md';
const HOW_IT_WORKS = 'docs/how-it-works.md';
const CONTEXT_README = 'packages/context/README.md';
const BOOTSTRAP = 'packages/context/src/context/bootstrap.ts';
const WRITES_GOLDEN = 'packages/code/src/cli.writes.golden.txt';
const STACK_FILES = 'packages/stacks/tests/an-archive-is-read-never-unpacked.test.ts';
const STACKS_README = 'packages/stacks/README.md';
const STACKS_VALIDATE = 'packages/stacks/src/validate.ts';
const ACTION_README = 'packages/action/README.md';
const PACKAGES = 'docs/packages.md';

/** The digest of the example stack, as the package's README states it. */
export const DIGEST = 'df9d8d71cdc13bd89b45af349e677ecfcbe98949805278bd42f16e6c0498f9ed';

/** @mnema/chain: an entry of the chain was altered, so verification fails and nothing after it is verified. */
export const CHAIN_LINES = Object.freeze({
  name: [said('@mnema/chain', 'packages/chain/package.json')],
  event: [said('decision.recorded', 'packages/chain/src/events/catalog.ts')],
  link: [said('seq', ENTRY), ' · ', said('prev', ENTRY), ' · ', said('hash', ENTRY)],
  mismatch: [said('entry hash mismatch', ENTRY)],
  altered: [said('content or link was altered', ENTRY)],
  checkpoint: [said('checkpoint', 'packages/chain/README.md')],
  verify: [said('$ mnema verify', 'packages/code/src/cli.reads.golden.txt')],
  failed: [said('local integrity FAILED: see issues', 'packages/chain/src/chain/level.ts')],
});

/** @mnema/core: the life of a decision, and the move a decision in a final state refuses. */
export const CORE_LINES = Object.freeze({
  name: [said('@mnema/core', 'packages/core/package.json')],
  life: [said('a new decision that supersedes the old one, never an edit of it', HOW_IT_WORKS)],
  proposed: [said('proposed', WORKFLOW)],
  awaiting: [said('awaiting a judgement', FIRST_RECORD)],
  record: [said('record', 'README.md')],
  accepted: [said('accepted', WORKFLOW)],
  governs: [said('the accepted ones', FIRST_RECORD)],
  governsMore: [said('that govern the work', FIRST_RECORD)],
  accept: [said('accept · a note', HOW_IT_WORKS)],
  superseded: [said('superseded', WORKFLOW)],
  newer: [said('a newer one that', 'docs/what-comes-next.md')],
  replaces: [said('replaces an older one', 'docs/what-comes-next.md')],
  supersede: [said('supersede', WORKFLOW)],
  rejected: [said('rejected', WORKFLOW)],
  terminal: [said('a terminal state', CONTEXT_README)],
  reject: [said('reject', WORKFLOW)],
  fold: [
    said('projectDecisions', 'packages/core/src/projections/decision.ts'),
    ' → ',
    said('ADR-2', 'docs/agent-hosts.md'),
    ' · ',
    said('Keep money as integer cents', 'README.md'),
    ' · ',
    said('accepted', WORKFLOW),
  ],
  refused: [
    said(
      'cannot "accept" a decision in rejected',
      'packages/core/src/workflow/the-gates-refuse-in-words-and-hand-back-what-was-proved.test.ts',
    ),
  ],
});

/** @mnema/context: what a session is handed when it opens. */
export const CONTEXT_LINES = Object.freeze({
  name: [said('@mnema/context', 'packages/context/package.json')],
  one: [said('ADR-1', WRITES_GOLDEN)],
  two: [said('ADR-2', WRITES_GOLDEN)],
  three: [said('ADR-3', WRITES_GOLDEN)],
  oneState: [said('superseded', WORKFLOW)],
  twoState: [said('accepted', WORKFLOW)],
  threeState: [said('proposed', WORKFLOW)],
  decisions: [said('decisions', BOOTSTRAP)],
  inForce: [said('ADR-2', WRITES_GOLDEN), ' · ', said('in force', 'README.md')],
  awaitingJudgement: [said('awaitingJudgement', BOOTSTRAP)],
  waits: [said('ADR-3', WRITES_GOLDEN), ' · ', said('proposed', WORKFLOW)],
  resume: [said('resume', BOOTSTRAP)],
  stopped: [said('where the last session stopped', 'docs/switches.md')],
  bootstrap: [said('bootstrap', BOOTSTRAP)],
  only: [said('only READS and COMPOSES', CONTEXT_README)],
  opensWith: [said('what a session opens with', 'packages/code/src/wiring/recall.ts')],
  never: [said('never decides a fact', CONTEXT_README)],
});

/** @mnema/stacks: the files of a stack, the validator, the digest, and the one file a stack never carries. */
export const STACKS_LINES = Object.freeze({
  name: [said('@mnema/stacks', 'packages/stacks/package.json')],
  manifest: [said('stack.json', STACK_FILES)],
  skill: [said('skills/hello/SKILL.md', STACK_FILES)],
  agent: [said('agents/greeter.md', STACK_FILES)],
  licence: [said('LICENSE', STACK_FILES)],
  mcp: [said('.mcp.json', STACKS_VALIDATE)],
  digest: [said('digest', STACKS_README)],
  digestStart: [said(DIGEST.slice(0, 32), STACKS_README)],
  digestEnd: [said(DIGEST.slice(32), STACKS_README)],
  refused: [said('mcp-server', 'packages/stacks/src/problem.ts')],
  never: [said('a stack never carries one', STACKS_VALIDATE)],
  validate: [said('validateStack', 'packages/stacks/src/index.ts')],
  line: [said('path NUL sha256(file) LF', STACKS_README)],
  identity: [said('The identity of a stack is its digest, not its version.', STACKS_README)],
  add: [said('mnema stack add', 'docs/reference/cli/stack.md')],
});

/** The family: the record in the middle, and the doors around it. */
export const FAMILY_LINES = Object.freeze({
  title: [said('The mnema family', 'README.md')],
  sdk: [said('SDK', 'docs/features.md')],
  sdkA: [said('a library door', 'docs/architecture.md')],
  sdkB: [said('to the record', 'docs/architecture.md')],
  vscode: [said('VS Code', PACKAGES)],
  vscodeA: [said('through the', PACKAGES)],
  vscodeB: [said('command line', PACKAGES)],
  ci: [said('An agent in CI', ACTION_README)],
  ciA: [said('mnema key', ACTION_README)],
  ciB: [said('restore', ACTION_README)],
  code: [said('@mnema/code', 'packages/code/package.json')],
  codeA: [said('two surfaces', 'packages/code/README.md')],
  codeB: [said('over one record', 'packages/code/README.md')],
  action: [said('The Action', ACTION_README)],
  actionA: [said('--require=', ACTION_README)],
  actionB: [said('signed', ACTION_README)],
  site: [said('mnema site', 'docs/site.md')],
  siteA: [said('A page that', 'README.md')],
  siteB: [said('verifies itself', 'README.md')],
  stacks: [said('Stacks', 'docs/glossary.md')],
  stacksA: [said('mnema stack', 'docs/reference/cli/stack.md')],
  stacksB: [said('add', 'docs/reference/cli/stack.md')],
});

/** The family's text alternative: on the picture itself and on every page that shows it. */
export const FAMILY_ALT =
  'The mnema family: @mnema/code, the command line and the MCP server over one record, with the SDK, a VS Code extension, an agent in CI, the GitHub Action, mnema site and Stacks around it';

/**
 * What each package's picture says of itself, for the one who cannot see it: `title` is the package's name and `alt` is
 * the text of its `aria-label` and of the `alt` of its README's image.
 */
export const PACKAGE_ALT = Object.freeze({
  chain:
    '@mnema/chain: an entry of the chain was altered, so mnema verify finds the entry hash mismatch, nothing after it is verified, and the record reads local integrity FAILED: see issues',
  core: '@mnema/core: a decision is proposed, then accepted, superseded or rejected, each move a new event and never an edit; accepting a rejected decision is refused',
  context:
    '@mnema/context: bootstrap reads decisions superseded, accepted and proposed, and composes what a session opens with: the decisions in force, those awaiting a judgement, and where the last session stopped; it writes nothing',
  stacks:
    '@mnema/stacks: validateStack reads the files of a stack, refuses an MCP server, and gives the digest that identifies the stack',
});
