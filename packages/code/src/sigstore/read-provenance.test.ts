/**
 * The provenance of a published version is read against RECORDED answers of the registry (the
 * attestations and the version document of 0.1.5, 0.1.7 and 0.1.8, fetched once and kept in
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
const integrityOf = (version: string): string =>
  (JSON.parse(recorded(`version-${version}.json`)) as { dist: { integrity: string } }).dist
    .integrity;
const attestations = (version: string): string => recorded(`attestations-${version}.json`);

const HEX_OF = (integrity: string): string =>
  Buffer.from(integrity.slice('sha512-'.length), 'base64').toString('hex');

/** Claims that hold for `version`, which each case then spoils in ONE place. */
function claims(version: string): Claimed {
  return {
    identity: PINNED_WORKFLOW,
    subjects: [{ name: `pkg:npm/%40mnema/code@${version}`, sha512: HEX_OF(integrityOf(version)) }],
    repository: PINNED_REPOSITORY,
  };
}
const expected = (version: string) => ({ version, integrity: integrityOf(version) });

describe('the four comparisons, each alone', () => {
  it('holds when every claim is the one expected', () => {
    expect(compareClaims(claims('0.1.8'), expected('0.1.8'))).toBeUndefined();
  });

  it('refuses another identity', () => {
    const other = `${PINNED_REPOSITORY}/.github/workflows/other.yml@refs/heads/main`;
    expect(compareClaims({ ...claims('0.1.8'), identity: other }, expected('0.1.8'))).toBe(
      'identity',
    );
    expect(compareClaims({ ...claims('0.1.8'), identity: '' }, expected('0.1.8'))).toBe('identity');
  });

  it('refuses a statement that names another version', () => {
    const subjects = [{ ...claims('0.1.8').subjects[0], name: 'pkg:npm/%40mnema/code@0.1.7' }];
    expect(compareClaims({ ...claims('0.1.8'), subjects }, expected('0.1.8'))).toBe('purl');
    const namesake = [{ ...claims('0.1.8').subjects[0], name: 'pkg:npm/%40other/code@0.1.8' }];
    expect(compareClaims({ ...claims('0.1.8'), subjects: namesake }, expected('0.1.8'))).toBe(
      'purl',
    );
  });

  it('refuses a digest that is not the one the registry gave', () => {
    const subjects = [{ ...claims('0.1.8').subjects[0], sha512: HEX_OF(integrityOf('0.1.7')) }];
    expect(compareClaims({ ...claims('0.1.8'), subjects }, expected('0.1.8'))).toBe('digest');
    const notHex = [{ ...claims('0.1.8').subjects[0], sha512: 'zz' }];
    expect(compareClaims({ ...claims('0.1.8'), subjects: notHex }, expected('0.1.8'))).toBe(
      'digest',
    );
  });

  it('refuses a workflow that ran in another repository', () => {
    expect(
      compareClaims(
        { ...claims('0.1.8'), repository: 'https://github.com/someone-else/mnema' },
        expected('0.1.8'),
      ),
    ).toBe('repository');
    expect(compareClaims({ ...claims('0.1.8'), repository: undefined }, expected('0.1.8'))).toBe(
      'repository',
    );
  });
});

describe('the recorded bundles, through the real library', () => {
  it('verifies the genuine bundle of 0.1.8 for 0.1.8 and says when it was logged', () => {
    const reading = readProvenance(attestations('0.1.8'), expected('0.1.8'));
    expect(reading).toEqual({
      kind: 'verified',
      loggedAt: '2026-11-11T18:29:33.000Z',
      commit: '001f790fca08468d443894fd37246cae6eb79242',
    });
  });

  it('NEGATIVE CONTROL: the genuine bundle of 0.1.7 offered for 0.1.8 is refused by the comparisons', () => {
    // It is a bundle the library verifies: only the comparisons stand between it and a pass.
    expect(readProvenance(attestations('0.1.7'), expected('0.1.7')).kind).toBe('verified');
    const replayed = readProvenance(attestations('0.1.7'), expected('0.1.8'));
    expect(replayed).toEqual({ kind: 'refused', refusal: 'purl' });
  });

  it('refuses the genuine bundle of 0.1.8 offered for 0.1.7, and for a digest of another version', () => {
    expect(readProvenance(attestations('0.1.8'), expected('0.1.7'))).toEqual({
      kind: 'refused',
      refusal: 'purl',
    });
    expect(
      readProvenance(attestations('0.1.8'), { version: '0.1.8', integrity: integrityOf('0.1.7') }),
    ).toEqual({ kind: 'refused', refusal: 'digest' });
  });

  it('refuses the genuine bundle of 0.1.5, built when the repository had another owner', () => {
    expect(readProvenance(attestations('0.1.5'), expected('0.1.5'))).toEqual({
      kind: 'refused',
      refusal: 'identity',
    });
  });

  it('refuses a statement edited after it was signed, by the library', () => {
    const doc = JSON.parse(attestations('0.1.8')) as {
      attestations: { predicateType: string; bundle: { dsseEnvelope: { payload: string } } }[];
    };
    const slsa = doc.attestations.find(
      (one) => one.predicateType === 'https://slsa.dev/provenance/v1',
    );
    const statement = Buffer.from(slsa?.bundle.dsseEnvelope.payload ?? '', 'base64').toString();
    if (slsa === undefined) throw new Error('the fixture has no SLSA entry');
    slsa.bundle.dsseEnvelope.payload = Buffer.from(
      statement.replace(HEX_OF(integrityOf('0.1.8')), HEX_OF(integrityOf('0.1.7'))),
    ).toString('base64');
    expect(readProvenance(JSON.stringify(doc), expected('0.1.8'))).toEqual({
      kind: 'refused',
      refusal: 'bundle',
    });
  });

  it('says there is no provenance where the answer has none, and refuses what is not an answer', () => {
    expect(readProvenance('{"attestations":[]}', expected('0.1.8'))).toEqual({
      kind: 'refused',
      refusal: 'no-provenance',
    });
    expect(readProvenance('not json', expected('0.1.8'))).toEqual({
      kind: 'refused',
      refusal: 'no-provenance',
    });
    const onlyPublish = JSON.parse(attestations('0.1.8')) as { attestations: unknown[] };
    onlyPublish.attestations = onlyPublish.attestations.slice(0, 1);
    expect(readProvenance(JSON.stringify(onlyPublish), expected('0.1.8'))).toEqual({
      kind: 'refused',
      refusal: 'no-provenance',
    });
  });

  it('refuses a bundle the carried trust root does not cover', () => {
    const root = { mediaType: 'application/vnd.dev.sigstore.trustedroot+json;version=0.1' };
    expect(readProvenance(attestations('0.1.8'), expected('0.1.8'), root)).toEqual({
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
