/**
 * Reading the provenance npm keeps for one published version: offline, against the trust root this
 * binary carries, and tied to THIS package by four comparisons the library does not make.
 *
 * THE LIBRARY'S CHECKS ARE `read.ts`'s: the certificate up to Fulcio, the certificate-transparency
 * timestamp, Rekor's promise and inclusion, and the signature over the envelope. What none of them
 * says is WHOSE bundle it is: a genuine bundle of another version, or of another project's
 * workflow, verifies as a bundle. So the reading compares, after the library, in this order:
 *
 *   1. identity   the certificate names the release workflow of this repository, and its OIDC
 *                 issuer is GitHub Actions';
 *   2. purl       the statement's subject names `pkg:npm/%40mnema/code@<version>`;
 *   3. digest     that subject's sha512 is the `dist.integrity` the registry gave for the version;
 *   4. repository the statement says the workflow ran in this repository.
 *
 * Each refusal names its comparison. A reading that cannot be made is a refusal, never a pass.
 *
 * `read.ts` refuses an envelope (it reads a signature over a checkpoint), so this is a reader of its
 * own. Loaded only by `mnema doctor --latest`.
 */

import { bundleFromJSON } from '@sigstore/bundle';
import { TrustedRoot } from '@sigstore/protobuf-specs';
import { toSignedEntity, toTrustMaterial, Verifier } from '@sigstore/verify';
import { runOf, verifiedTime } from './read.js';
import { PUBLIC_GOOD_TRUSTED_ROOT } from './trusted-root.js';

/** The repository whose release workflow builds `@mnema/code`; `package.json` says the same (a guard holds the two). */
export const PINNED_REPOSITORY = 'https://github.com/mnema-work/mnema';

/** The workflow identity a certificate must name: the release workflow, on `main`. */
export const PINNED_WORKFLOW = `${PINNED_REPOSITORY}/.github/workflows/release.yml@refs/heads/main`;

/** The OIDC issuer a certificate for a GitHub Actions run names. */
export const PINNED_ISSUER = 'https://token.actions.githubusercontent.com';

const SLSA_PROVENANCE = 'https://slsa.dev/provenance/v1';

/** What the four comparisons are made against. */
export interface Expected {
  readonly version: string;
  /** `dist.integrity` of the version, as the registry wrote it: `sha512-<base64>`. */
  readonly integrity: string;
}

/** The parts of a verified signer and of its statement the comparisons read. */
export interface Claimed {
  /** The identity the verified certificate names. */
  readonly identity: string;
  /** The OpenID issuer that vouched for the identity. */
  readonly issuer: string;
  /** The statement's subjects, as they were signed. */
  readonly subjects: readonly { readonly name?: unknown; readonly sha512?: unknown }[];
  /** The repository the statement says the workflow ran in. */
  readonly repository: unknown;
}

/** Which comparison, or which earlier step, refused a bundle. */
export type Refusal =
  | 'no-provenance'
  | 'bundle'
  | 'statement'
  | 'identity'
  | 'purl'
  | 'digest'
  | 'repository'
  | 'time';

export type ProvenanceReading =
  | {
      readonly kind: 'verified';
      /** The log time the library verified: when the version was signed into the public log. */
      readonly loggedAt: string;
      /** The commit the certificate names, when it names one. */
      readonly commit?: string;
    }
  | { readonly kind: 'refused'; readonly refusal: Refusal };

/** `sha512-<base64>` of the hex digest a statement carries, or undefined where it is not hex. */
function integrityOf(hex: unknown): string | undefined {
  if (typeof hex !== 'string' || !/^[0-9a-f]{128}$/.test(hex)) return undefined;
  return `sha512-${Buffer.from(hex, 'hex').toString('base64')}`;
}

/**
 * The four comparisons, over what a verified bundle claims. Pure: the first that fails is the
 * refusal, and `undefined` is every one holding.
 */
export function compareClaims(claimed: Claimed, expected: Expected): Refusal | undefined {
  if (claimed.identity !== PINNED_WORKFLOW || claimed.issuer !== PINNED_ISSUER) return 'identity';
  const subject = claimed.subjects.find(
    (one) => one.name === `pkg:npm/%40mnema/code@${expected.version}`,
  );
  if (subject === undefined) return 'purl';
  if (integrityOf(subject.sha512) !== expected.integrity) return 'digest';
  if (claimed.repository !== PINNED_REPOSITORY) return 'repository';
  return undefined;
}

const refused = (refusal: Refusal): ProvenanceReading => ({ kind: 'refused', refusal });

/**
 * Reads the answer of npm's attestations endpoint for `expected.version` (`text` is the body, as
 * received) and says whether it holds. Never throws.
 */
export function readProvenance(
  text: string,
  expected: Expected,
  trustedRoot: unknown = PUBLIC_GOOD_TRUSTED_ROOT,
): ProvenanceReading {
  let slsa: unknown;
  try {
    const attestations = (JSON.parse(text) as { attestations?: unknown }).attestations;
    slsa = Array.isArray(attestations)
      ? (attestations as { predicateType?: unknown; bundle?: unknown }[]).find(
          (one) => one?.predicateType === SLSA_PROVENANCE,
        )?.bundle
      : undefined;
  } catch {
    return refused('no-provenance');
  }
  if (slsa === undefined) return refused('no-provenance');
  try {
    const bundle = bundleFromJSON(slsa);
    if (bundle.content.$case !== 'dsseEnvelope') return refused('bundle');
    const verifier = new Verifier(toTrustMaterial(TrustedRoot.fromJSON(trustedRoot)), {
      tlogThreshold: 1,
      ctlogThreshold: 1,
      timestampThreshold: 1,
    });
    // No artifact is handed in: a DSSE envelope carries the payload the signature is over.
    const entity = toSignedEntity(bundle);
    const signer = verifier.verify(entity);
    const envelope = bundle.content.dsseEnvelope;
    if (envelope.payloadType !== 'application/vnd.in-toto+json') return refused('statement');
    const statement = JSON.parse(Buffer.from(envelope.payload).toString('utf8')) as {
      predicateType?: unknown;
      subject?: unknown;
      predicate?: {
        buildDefinition?: { externalParameters?: { workflow?: { repository?: unknown } } };
      };
    };
    if (statement.predicateType !== SLSA_PROVENANCE || !Array.isArray(statement.subject)) {
      return refused('statement');
    }
    const refusal = compareClaims(
      {
        identity: signer.identity?.subjectAlternativeName ?? '',
        issuer: signer.identity?.extensions?.issuer ?? '',
        subjects: (statement.subject as { name?: unknown; digest?: { sha512?: unknown } }[]).map(
          (one) => ({ name: one?.name, sha512: one?.digest?.sha512 }),
        ),
        repository: statement.predicate?.buildDefinition?.externalParameters?.workflow?.repository,
      },
      expected,
    );
    if (refusal !== undefined) return refused(refusal);
    const when = verifiedTime(entity, bundle.verificationMaterial.tlogEntries);
    if (when === undefined) return refused('time');
    const commit = runOf(signer.identity?.oids ?? [])?.commit;
    return {
      kind: 'verified',
      loggedAt: when.loggedAt,
      ...(commit === undefined ? {} : { commit }),
    };
  } catch {
    return refused('bundle');
  }
}
