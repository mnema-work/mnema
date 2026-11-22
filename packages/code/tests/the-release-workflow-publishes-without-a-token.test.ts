// @reads-the-tree
/**
 * THE RELEASE WORKFLOW PUBLISHES WITHOUT A TOKEN, IN ORDER, AND TAGS ONLY AFTER. `.github/workflows/release.yml`
 * publishes the five packages to npm and then cuts the tag and the release. What it must keep, because a run
 * of it is the one act here that cannot be taken back:
 *
 * - it runs on a push to `main` and by hand with `mode`, never on a pull request, a schedule or a tag;
 * - the job that publishes asks for the `npm` environment (so a person approves it), holds `id-token: write`
 *   (the OIDC the trusted publisher trusts) and nothing wider than `contents: read`;
 * - nothing in it that publishes a package reads a secret: no `secrets.` outside the one job that publishes the
 *   extension to Open VSX (which reads one, and only that), no `NODE_AUTH_TOKEN`, no `NPM_TOKEN`;
 * - it publishes the tarball of each package with `--provenance --access public`, in the order chain, core,
 *   context, stacks, code;
 * - the job that publishes names the npm registry in its `setup-node` (what the OpenSSF Scorecard reads to
 *   find a publishing workflow), still with no token; the tarballs and the extension are signed by two jobs that
 *   hold `id-token` and `attestations` and install, build and publish nothing, and the release carries the bundles;
 * - the tag and the release belong to a job that needs the publish, and no step before the publish creates one;
 * - the packed install runs first, on the three Nodes, on the very tarballs that are then published;
 * - the two jobs that write outside (the publish and the tag and release) ask for the `npm` environment, in
 *   both ways to reach the tag, so nothing is tagged or released without a person's approval;
 * - no job that installs or builds can ask for the OIDC token, and the job that can publishes without
 *   installing or building anything (not even a newer npm: it only reads the one it has); the one other job
 *   that can ask, the extension's to the Marketplace, installs no package script and holds no secret, and the
 *   Open VSX job, which runs the code of a third party with a token, cannot ask;
 * - the publish checks the tarballs it downloaded against the SHA-256 the pack job exposes as outputs, not
 *   against a file that travels in the same artifact;
 * - the publish needs the packed install and does not run when it failed (no `always()` in its `if`);
 * - the branch the plugins are installed from (`release`) is moved by one step of the job that tags, after
 *   `gh release create`, by a plain push of the tag's commit over SSH with a deploy key it reads from the
 *   one secret that holds it, never forced, in no other job.
 *
 * What this reads is the file, not a run: the workflow has never run, the trusted publisher is configured on
 * npmjs.com by a person, and none of that is visible here. The text is read without its comment lines, so a
 * sentence about a token is not a token.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const CODE = readFileSync(join(ROOT, '.github/workflows/release.yml'), 'utf-8')
  .split('\n')
  .filter((line) => !/^\s*#/.test(line))
  .join('\n');

/** The text of one job: from its `  name:` line to the next job or the end. */
function job(name: string): string {
  const start = CODE.search(new RegExp(`^ {2}${name}:\\n`, 'm'));
  expect(start, `no job named ${name}`).toBeGreaterThan(-1);
  const rest = CODE.slice(start + 1);
  const next = rest.search(/^ {2}[a-z][\w-]*:\n/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The step of the `release` job that moves the branch: from its `- name:` line to the next step or job. */
function moveStep(): string {
  const release = job('release');
  const start = release.indexOf('- name: Move the release branch to the tag');
  expect(start, 'the release job has no step that moves the release branch').toBeGreaterThan(-1);
  const rest = release.slice(start + 1);
  const next = rest.search(/^ {6}- /m);
  return next === -1 ? release.slice(start) : release.slice(start, start + 1 + next);
}

describe('the release workflow publishes without a token', () => {
  it('runs on a push to main and by hand, and on nothing else', () => {
    expect(CODE).toMatch(/^on:\n {2}push:\n {4}branches: \[main\]\n {2}workflow_dispatch:\n/m);
    expect(CODE).toMatch(/options: \[publish, tag-only\]/);
    expect(CODE).not.toMatch(/\bpull_request(_target)?\b/);
    expect(CODE).not.toMatch(/\bschedule:/);
    expect(CODE).not.toMatch(/^ {4}tags:/m);
  });

  it('reads nothing wider than contents by default', () => {
    expect(CODE).toMatch(/^permissions:\n {2}contents: read\n(?! {2}\w)/m);
  });

  it('publishes in the npm environment, with id-token and no write to the repository', () => {
    const publish = job('publish');
    expect(publish).toMatch(/^ {4}environment: npm$/m);
    expect(publish).toMatch(/^ {6}id-token: write$/m);
    expect(publish).not.toMatch(/contents: write/);
    expect(publish).toMatch(/needs: \[plan, pack, packed-install\]/);
  });

  it('asks for the npm environment in the two jobs that write outside', () => {
    expect(job('publish')).toMatch(/^ {4}environment: npm$/m);
    expect(job('release')).toMatch(/^ {4}environment: npm$/m);
  });

  it('never gives id-token to a job that installs or builds', () => {
    const names = [...CODE.slice(CODE.indexOf('\njobs:')).matchAll(/^ {2}([a-z][\w-]*):\n/gm)].map(
      (m) => m[1] as string,
    );
    expect(names).toEqual([
      'plan',
      'pack',
      'packed-install',
      'publish',
      'attest',
      'single-executable',
      'release',
      'vsix',
      'attest-vsix',
      'attach-vsix',
      'publish-marketplace',
      'publish-open-vsx',
      'publish-registry',
    ]);
    for (const name of names) {
      const text = job(name);
      if (/pnpm install|pnpm build|pnpm pack/.test(text)) {
        expect(text, `${name} installs or builds`).not.toMatch(/id-token/);
      }
    }
    const asking = names.filter((name) => /^ {6}id-token: write$/m.test(job(name)));
    expect(asking).toEqual([
      'publish',
      'attest',
      'attest-vsix',
      'publish-marketplace',
      'publish-registry',
    ]);
    expect(job('publish-open-vsx')).not.toMatch(/id-token|--oidc/);
    expect(job('pack')).toMatch(/^ {6}contents: read$/m);
    expect(job('pack')).toContain('pnpm install --frozen-lockfile');
    expect(job('pack')).toContain('sha256sum');
    expect(job('pack')).toContain('actions/upload-artifact@');
  });

  it('builds the experimental single executable without a token, and the release attaches it only when it was built', () => {
    const exe = job('single-executable');
    expect(exe).not.toMatch(/id-token|secrets\./);
    expect(exe).toMatch(/^ {6}contents: read$/m);
    expect(exe).toContain('pnpm build:single-executable');
    expect(exe).toContain('bash .github/the-single-executable/smoke.sh');
    expect(exe).toContain('steps.mark.outputs.built');
    const release = job('release');
    expect(release).toContain("needs.single-executable.outputs.built == 'true'");
    expect(release).toContain('Experimental, Linux x64 only, unsigned');
  });

  it('publishes without installing or building anything', () => {
    const publish = job('publish');
    expect(publish).not.toMatch(
      /npm install|npm ci|npm run|pnpm|git clone|checkout|actions\/cache/,
    );
    expect(publish).toContain('actions/download-artifact@');
    expect(publish).toContain('npm --version');
    expect(publish).toContain('older than 11.5.1, which publishing through OIDC needs');
  });

  it('checks the downloaded tarballs against the hashes the pack job exposes', () => {
    const pack = job('pack');
    const publish = job('publish');
    for (const p of ['chain', 'core', 'context', 'stacks', 'code']) {
      expect(pack).toContain(`sha256-${p}: \${{ steps.pack.outputs.${p} }}`);
      expect(publish).toContain(
        `SHA256_${p.toUpperCase()}: \${{ needs.pack.outputs.sha256-${p} }}`,
      );
    }
    expect(publish).toContain('sha256sum "$tarballs/mnema-$p-$VERSION.tgz"');
    expect(publish).not.toMatch(/SHA256SUMS|sha256sum --check/);
    expect(publish.indexOf('sha256sum "$tarballs')).toBeLessThan(publish.indexOf('npm publish'));
  });

  it('does not run the publish when the packed install failed', () => {
    const condition = /^ {4}if: (.*)$/m.exec(job('publish'))?.[1] ?? '';
    expect(condition).toBe("needs.plan.outputs.action == 'publish'");
    expect(condition).not.toMatch(/always\(\)|cancelled\(\)|failure\(\)|success\(\)/);
  });

  it('holds no secret for the packages, and the only secrets are the Open VSX token of the extension job and the deploy key of the branch step', () => {
    const market = job('publish-marketplace');
    const stores = job('publish-open-vsx');
    expect(CODE.replace(stores, '').replace(moveStep(), '')).not.toMatch(/\bsecrets\./);
    expect([...stores.matchAll(/\bsecrets\.(\w+)/g)].map((m) => m[1])).toEqual(['OVSX_PAT']);
    expect(CODE).not.toMatch(/VSCE_PAT/);
    expect(market).toMatch(/vsce" publish --oidc --skip-duplicate /);
    expect(stores).toMatch(/^ {4}environment: extension-stores$/m);
    expect(market).toMatch(/^ {4}environment: extension-stores$/m);
    expect(CODE.replace(stores, '').replace(market, '')).not.toMatch(/extension-stores/);
    expect(CODE).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|_authToken|npm login|npm adduser/);
    expect(CODE.match(/registry-url:/g)).toHaveLength(1);
    expect(job('publish')).toContain("registry-url: 'https://registry.npmjs.org'");
  });

  it('publishes each tarball with provenance, in dependency order', () => {
    const publish = job('publish');
    expect(publish).toContain(
      'npm publish "$tarballs/mnema-$p-$VERSION.tgz" --provenance --access public',
    );
    const order = [...publish.matchAll(/for p in ([a-z ]+); do/g)].map((m) => m[1]);
    const five = 'chain core context stacks code';
    expect(order).toEqual([five, five]);
    const packed = [...job('pack').matchAll(/for p in ([a-z ]+); do/g)].map((m) => m[1]);
    expect(packed).toEqual([five, five]);
    expect(publish).toContain('is already on npm');
  });

  it('cuts the tag and the release after the publish, and nowhere before', () => {
    const release = job('release');
    expect(release).toMatch(/needs: \[plan, publish, attest, single-executable\]/);
    expect(release).toMatch(/^ {6}contents: write$/m);
    expect(release).not.toMatch(/id-token/);
    expect(release).toContain('gh release create');
    const attach = job('attach-vsix');
    expect(attach).toContain('gh release upload');
    expect(attach).not.toContain('gh release create');
    const outside = CODE.replace(release, '').replace(attach, '');
    expect(outside).not.toMatch(/gh release|git tag|git push/);
    expect(release.indexOf('is not on npm')).toBeLessThan(release.indexOf('gh release create'));
  });

  it('signs the tarballs after the publish and the extension after its pack, and the release carries the signatures', () => {
    for (const name of ['attest', 'attest-vsix']) {
      const text = job(name);
      expect(text).toMatch(/^ {6}contents: read\n {6}id-token: write\n {6}attestations: write\n/m);
      expect(text).toMatch(/uses: actions\/attest@[0-9a-f]{40} # v\d+\.\d+\.\d+/);
      expect(text).not.toMatch(/pnpm|npm (install|ci|publish)|checkout|secrets\.|environment:/);
      // The SHA-256 of each file is compared with the pack job's before anything is signed: both the hash and the
      // comparison must be there, and before the action (an index of -1 would pass a bare toBeLessThan).
      const hashed = text.indexOf('sha256sum');
      const compared = text.search(
        /\[ -n "\$(want|SHA256)" \] && \[ "\$have" = "\$(want|SHA256)" \] \|\| \{[^}]*exit 1; \}/,
      );
      expect(hashed).toBeGreaterThan(-1);
      expect(compared).toBeGreaterThan(hashed);
      expect(compared).toBeLessThan(text.indexOf('actions/attest@'));
    }
    expect(job('attest')).toMatch(/needs: \[plan, pack, publish\]/);
    expect(job('attest-vsix')).toMatch(/needs: \[plan, vsix\]/);
    expect(job('attest')).toContain('mnema-npm-packages-$VERSION.sigstore.json');
    expect(job('attest-vsix')).toContain('mnema-$VERSION.vsix.sigstore.json');
    expect(job('release')).toContain('name: release-assets');
    expect(job('release')).toContain("needs.attest.result == 'success'");
    expect(job('release')).toContain('"$' + '{files[@]}"');
    expect(job('attach-vsix')).toContain(
      '"$RUNNER_TEMP/vsix-signature/mnema-$VERSION.vsix.sigstore.json"',
    );
    expect(job('attach-vsix')).toMatch(/needs: \[plan, vsix, attest-vsix\]/);
  });

  it('waits for npm to serve the five, up to a ceiling, before it tags', () => {
    const release = job('release');
    const step =
      /- name: Wait until npm serves the five[^\n]*\n([\s\S]*?)\n {6}- name:/.exec(release)?.[1] ??
      '';
    expect(step).toMatch(/^ *tries=20$/m);
    expect(step).toMatch(/^ *pause=30$/m);
    expect(step).toMatch(/for attempt in \$\(seq 1 "\$tries"\); do/);
    expect(step).toMatch(/sleep "\$pause"/);
    expect(step.indexOf('npm view')).toBeGreaterThan(step.indexOf('for attempt in'));
    expect(step.indexOf('sleep "$pause"')).toBeGreaterThan(step.indexOf('for attempt in'));
    expect(step).toMatch(/exit 0/);
    expect(step).toMatch(/is not on npm after \$\(\(.*\)\) minutes/);
    expect(step.lastIndexOf('exit 1')).toBeGreaterThan(step.indexOf('done'));
  });

  it('does not publish while the first publication is still by hand', () => {
    expect(job('plan')).toContain('E404');
    expect(job('plan')).toContain('action=first-by-hand');
    expect(job('publish')).toContain("needs.plan.outputs.action == 'publish'");
    expect(job('release')).toContain("needs.plan.outputs.action == 'tag-only'");
  });

  it('runs the packed install on the three Nodes before the publish', () => {
    const packed = job('packed-install');
    expect(packed).toContain("node: ['24.15.0', '24', '26']");
    expect(packed).toContain('run: bash .github/the-packed-install/run.sh "$RUNNER_TEMP/tarballs"');
    expect(packed).toContain('actions/download-artifact@');
    expect(packed).toMatch(/needs: \[plan, pack\]/);
    expect(packed).not.toMatch(/id-token|environment:|pnpm /);
  });

  it('moves the release branch after the release is created, in the job with the npm environment and in no other', () => {
    const release = job('release');
    expect(release).toMatch(/^ {4}environment: npm$/m);
    expect(release.indexOf('- name: Move the release branch to the tag')).toBeGreaterThan(
      release.indexOf('gh release create'),
    );
    const elsewhere = CODE.replace(release, '');
    expect(elsewhere).not.toMatch(/RELEASE_BRANCH_DEPLOY_KEY|refs\/heads\/release|GIT_SSH_COMMAND/);
    expect(job('attach-vsix')).not.toMatch(/git push/);
  });

  it("pushes the tag's commit to the release branch plainly, so a move that is not a fast-forward is refused", () => {
    const step = moveStep();
    expect(step).toContain(
      'git push "git@github.com:$GITHUB_REPOSITORY.git" "v$VERSION^{commit}:refs/heads/release"',
    );
    expect([...step.matchAll(/git push/g)]).toHaveLength(1);
    expect(step).not.toMatch(/--force|--mirror|--delete|--no-verify|-f\b/);
    expect(step).not.toMatch(/(^|[\s"'=])\+\S/m);
    expect(step).toMatch(/set -euo pipefail/);
    expect(step).toMatch(/merge-base --is-ancestor FETCH_HEAD/);
    expect(step).not.toMatch(/\|\| true|continue-on-error/);
    expect(job('release')).not.toMatch(/continue-on-error/);
  });

  it('takes the key from its one secret, keeps it in a private file it removes, and pins the host key of github.com', () => {
    const step = moveStep();
    expect([...step.matchAll(/\bsecrets\.(\w+)/g)].map((m) => m[1])).toEqual([
      'RELEASE_BRANCH_DEPLOY_KEY',
    ]);
    expect(step).toMatch(
      /RELEASE_BRANCH_DEPLOY_KEY: \$\{\{ secrets\.RELEASE_BRANCH_DEPLOY_KEY \}\}/,
    );
    expect(step).toMatch(/^ *umask 077$/m);
    expect(step).toMatch(/chmod 600 "\$keys\/key"/);
    expect(step).toMatch(/\$RUNNER_TEMP/);
    expect(step).toMatch(/trap 'rm -rf "\$keys"' EXIT/);
    expect(step).toMatch(/StrictHostKeyChecking=yes/);
    expect(step).toMatch(/UserKnownHostsFile=\$keys\/known_hosts/);
    expect(step).toMatch(/github\.com ssh-ed25519 AAAA[\w]+/);
    expect(step).not.toMatch(
      /ssh-keyscan|StrictHostKeyChecking=(no|accept-new)|set -x|\becho\b.*RELEASE_BRANCH_DEPLOY_KEY/,
    );
  });
});
