/**
 * The provenance of a published version is read against RECORDED answers of the registry (the
 * attestations and the version document of three versions (the newer, the older, and one built when
 * the repository had another owner), fetched once and kept in
 * `tests/fixtures/the-new-version/`): no test here asks a network.
 *
 * The library verifies a genuine bundle of ANY version, so what these cases hold is the four
 * comparisons: each is exercised alone over claims a hand-made statement states, and then end to
 * end over the real bundles, where a genuine bundle of another version must be refused.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  type Claimed,
  compareClaims,
  PINNED_ISSUER,
  PINNED_REPOSITORY,
  PINNED_WORKFLOW,
  readProvenance,
} from './read-provenance.js';

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'tests',
  'fixtures',
  'the-new-version',
);
const recorded = (name: string): string => readFileSync(join(FIXTURES, name), 'utf-8');

/** The three recorded versions by ROLE, so no case types a number the product itself is at. */
type Role = 'newer' | 'older' | 'moved';
const versionOf = (role: Role): string =>
  (JSON.parse(recorded(`version-${role}.json`)) as { version: string }).version;
const integrityOf = (role: Role): string =>
  (JSON.parse(recorded(`version-${role}.json`)) as { dist: { integrity: string } }).dist.integrity;
const attestations = (role: Role): string => recorded(`attestations-${role}.json`);

const HEX_OF = (integrity: string): string =>
  Buffer.from(integrity.slice('sha512-'.length), 'base64').toString('hex');

/** Claims that hold for the version of `role`, which each case then spoils in ONE place. */
function claims(role: Role): Claimed {
  return {
    identity: PINNED_WORKFLOW,
    issuer: PINNED_ISSUER,
    subjects: [
      { name: `pkg:npm/%40mnema/code@${versionOf(role)}`, sha512: HEX_OF(integrityOf(role)) },
    ],
    repository: PINNED_REPOSITORY,
  };
}
const expected = (role: Role) => ({ version: versionOf(role), integrity: integrityOf(role) });

describe('the four comparisons, each alone', () => {
  it('holds when every claim is the one expected', () => {
    expect(compareClaims(claims('newer'), expected('newer'))).toBeUndefined();
  });

  it('refuses another identity', () => {
    const other = `${PINNED_REPOSITORY}/.github/workflows/other.yml@refs/heads/main`;
    expect(compareClaims({ ...claims('newer'), identity: other }, expected('newer'))).toBe(
      'identity',
    );
    expect(compareClaims({ ...claims('newer'), identity: '' }, expected('newer'))).toBe('identity');
  });

  it('refuses a certificate another OIDC issuer vouched for, whatever workflow it names', () => {
    expect(
      compareClaims(
        { ...claims('newer'), issuer: 'https://accounts.google.com' },
        expected('newer'),
      ),
    ).toBe('identity');
    expect(compareClaims({ ...claims('newer'), issuer: '' }, expected('newer'))).toBe('identity');
  });

  it('refuses a statement that names another version', () => {
    const subjects = [
      { ...claims('newer').subjects[0], name: `pkg:npm/%40mnema/code@${versionOf('older')}` },
    ];
    expect(compareClaims({ ...claims('newer'), subjects }, expected('newer'))).toBe('purl');
    const namesake = [
      { ...claims('newer').subjects[0], name: `pkg:npm/%40other/code@${versionOf('newer')}` },
    ];
    expect(compareClaims({ ...claims('newer'), subjects: namesake }, expected('newer'))).toBe(
      'purl',
    );
  });

  it('refuses a digest that is not the one the registry gave', () => {
    const subjects = [{ ...claims('newer').subjects[0], sha512: HEX_OF(integrityOf('older')) }];
    expect(compareClaims({ ...claims('newer'), subjects }, expected('newer'))).toBe('digest');
    const notHex = [{ ...claims('newer').subjects[0], sha512: 'zz' }];
    expect(compareClaims({ ...claims('newer'), subjects: notHex }, expected('newer'))).toBe(
      'digest',
    );
  });

  it('refuses a workflow that ran in another repository', () => {
    expect(
      compareClaims(
        { ...claims('newer'), repository: 'https://github.com/someone-else/mnema' },
        expected('newer'),
      ),
    ).toBe('repository');
    expect(compareClaims({ ...claims('newer'), repository: undefined }, expected('newer'))).toBe(
      'repository',
    );
  });
});

describe('the recorded bundles, through the real library', () => {
  it('verifies the genuine bundle of the newer version for itself and says when it was logged', () => {
    const reading = readProvenance(attestations('newer'), expected('newer'));
    expect(reading).toEqual({
      kind: 'verified',
      loggedAt: '2026-11-11T18:29:33.000Z',
      commit: '001f790fca08468d443894fd37246cae6eb79242',
    });
  });

  it('NEGATIVE CONTROL: the genuine bundle of the older version offered for the newer is refused by the comparisons', () => {
    // It is a bundle the library verifies: only the comparisons stand between it and a pass.
    expect(readProvenance(attestations('older'), expected('older')).kind).toBe('verified');
    const replayed = readProvenance(attestations('older'), expected('newer'));
    expect(replayed).toEqual({ kind: 'refused', refusal: 'purl' });
  });

  it('refuses the genuine bundle of the newer version offered for the older, and for a digest of another version', () => {
    expect(readProvenance(attestations('newer'), expected('older'))).toEqual({
      kind: 'refused',
      refusal: 'purl',
    });
    expect(
      readProvenance(attestations('newer'), {
        version: versionOf('newer'),
        integrity: integrityOf('older'),
      }),
    ).toEqual({ kind: 'refused', refusal: 'digest' });
  });

  it('refuses the genuine bundle of a version built when the repository had another owner', () => {
    expect(readProvenance(attestations('moved'), expected('moved'))).toEqual({
      kind: 'refused',
      refusal: 'identity',
    });
  });

  it('refuses a statement edited after it was signed, by the library', () => {
    const doc = JSON.parse(attestations('newer')) as {
      attestations: { predicateType: string; bundle: { dsseEnvelope: { payload: string } } }[];
    };
    const slsa = doc.attestations.find(
      (one) => one.predicateType === 'https://slsa.dev/provenance/v1',
    );
    const statement = Buffer.from(slsa?.bundle.dsseEnvelope.payload ?? '', 'base64').toString();
    if (slsa === undefined) throw new Error('the fixture has no SLSA entry');
    slsa.bundle.dsseEnvelope.payload = Buffer.from(
      statement.replace(HEX_OF(integrityOf('newer')), HEX_OF(integrityOf('older'))),
    ).toString('base64');
    expect(readProvenance(JSON.stringify(doc), expected('newer'))).toEqual({
      kind: 'refused',
      refusal: 'bundle',
    });
  });

  it('says there is no provenance where the answer has none, and refuses what is not an answer', () => {
    expect(readProvenance('{"attestations":[]}', expected('newer'))).toEqual({
      kind: 'refused',
      refusal: 'no-provenance',
    });
    expect(readProvenance('not json', expected('newer'))).toEqual({
      kind: 'refused',
      refusal: 'no-provenance',
    });
    const onlyPublish = JSON.parse(attestations('newer')) as { attestations: unknown[] };
    onlyPublish.attestations = onlyPublish.attestations.slice(0, 1);
    expect(readProvenance(JSON.stringify(onlyPublish), expected('newer'))).toEqual({
      kind: 'refused',
      refusal: 'no-provenance',
    });
  });

  it('refuses a bundle the carried trust root does not cover', () => {
    const root = { mediaType: 'application/vnd.dev.sigstore.trustedroot+json;version=0.1' };
    expect(readProvenance(attestations('newer'), expected('newer'), root)).toEqual({
      kind: 'refused',
      refusal: 'bundle',
    });
  });
});

describe('the pinned repository is the one the package declares', () => {
  it('names the repository package.json gives, so a second move turns this red, not silent', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'),
        'utf-8',
      ),
    ) as { repository: { url: string } };
    expect(manifest.repository.url).toBe(`git+${PINNED_REPOSITORY}.git`);
  });
});
