import { describe, expect, it } from 'vitest';
import {
  detectSecrets,
  SECRET_CLASSES,
  type SecretClass,
  scrubSecrets,
  secretPlaceholder,
} from './secrets.js';

/**
 * Every assertion in this file asks the SAME question: is the value ABSENT from
 * the output? Never "did a counter move", never "is the report non-empty".
 *
 * The reason is a bug this detector actually had. Its first version isolated a URL
 * password in a capture group and replaced it through a `String.replace` callback,
 * where the second argument is the match OFFSET when the pattern has no group, so
 * the replacement silently no-oped, and the report still said the value had been
 * replaced. A test that checked the report would have passed while the secret went
 * to the chain, and a false all-clear is worse than no defense, because it ends
 * the investigation. Only the output can answer.
 */

/**
 * One real-shaped value per recognized class: the value that must be gone from the
 * output, and the string written into the sentence to carry it, the same string for
 * every class but `url-password`, whose secret is a slot inside a URL.
 *
 * Keyed BY class, so `SECRET_CLASSES` drives every loop below instead of a list kept
 * in step by hand. That is the ruler this file measures with, and it answers two
 * questions the old array could not: a class added to the sieve with no sample here
 * fails, and a class whose sample an EARLIER shape already swallows fails too. The
 * second is the defect that reported a key of Anthropic's shape as `openai-key`.
 */
interface Sample {
  /** The exact string that must not survive into the output. */
  readonly value: string;
  /** What is written into the text: the value, or the thing that contains it. */
  readonly holder: string;
}

const SAMPLES: Readonly<Record<SecretClass, Sample>> = {
  'aws-access-key': itself('AKIAIOSFODNN7EXAMPLE'),
  'github-token': itself(`ghp_${'A1b2C3d4E5'.repeat(4)}`),
  'gitlab-token': itself(`glpat-${'xK3_m9Pq-2'.repeat(2)}`),
  'huggingface-token': itself(`hf_${'aBcD3fGh1J'.repeat(3)}xyzA`),
  'anthropic-key': itself(`sk-ant-api03-${'Xy9'.repeat(12)}`),
  'openai-key': itself(`sk-proj-${'Xy9'.repeat(12)}`),
  'stripe-key': itself(`sk_live_${'4a7B'.repeat(8)}`),
  'slack-token': itself('xoxb-123456789012-abcdefghijkl'),
  'google-api-key': itself(`AIza${'Sy0aB-c_9'.repeat(4)}`),
  'npm-token': itself(`npm_${'z9Y8x7W6v5'.repeat(4)}`),
  jwt: itself(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27u',
  ),
  'private-key-block': itself(
    '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQ\n-----END PRIVATE KEY-----',
  ),
  // The one class whose secret is not the whole of what is written: the password
  // sits in a slot, and the URL around it is what has to survive.
  'url-password': { value: 'Tr0ub4dor3', holder: 'postgres://svc:Tr0ub4dor3@db.internal/app' },
  // The two classes read by context: the value is what follows a header or a name, and
  // the header and the name are what has to survive around it.
  'authorization-header': {
    value: 'dXNlcjpodW50ZXIy',
    holder: 'Authorization: Basic dXNlcjpodW50ZXIy',
  },
  'named-credential': { value: 'hunter2', holder: 'DB_PASSWORD=hunter2' },
};

/** A sample whose value IS what gets written into the text. */
function itself(value: string): Sample {
  return { value, holder: value };
}

/** The sentence every sample is scrubbed inside: the context has to come back. */
function wrote(sample: Sample): string {
  return `deploying with ${sample.holder} against staging`;
}

// @proves secrets-stay-out
// @proves credentials-stay-out-of-the-record
describe('scrubSecrets: the value is absent from the output', () => {
  it('carries one sample per recognized class: the ruler the loops below measure with', () => {
    // Both directions. A class with no sample would be skipped by every loop in
    // this file while looking covered, and a sample for a class the sieve does not
    // have is a test measuring nothing.
    expect(Object.keys(SAMPLES).sort()).toEqual([...SECRET_CLASSES].sort());
  });

  for (const secret of SECRET_CLASSES) {
    it(`takes a ${secret} out of the text it was written into, and calls it a ${secret}`, () => {
      const sample = SAMPLES[secret];
      const scrubbed = scrubSecrets(wrote(sample));

      // THE assertion: the value is not in the output. Anywhere, in any form.
      expect(scrubbed.text).not.toContain(sample.value);
      // And in EXACT form: the sentence with the value swapped for the placeholder
      // and nothing else moved. It says three things at once: the context around
      // the value survived so the record is still worth having, the placeholder
      // went where the value was, and no FRAGMENT or digest of the value came with
      // it. `not.toContain(value)` alone would pass on a placeholder carrying the
      // first eight characters of the key, which is the leak the module refuses.
      expect(scrubbed.text).toBe(wrote(sample).replace(sample.value, secretPlaceholder(secret)));
      // EXACTLY this class, and nothing else: the assertion that fails when an
      // earlier shape swallows a later one's prefix, which is how `sk-ant-…` came
      // back named `openai-key`.
      expect(scrubbed.replaced).toEqual([secret]);
    });
  }

  it('takes the PASSWORD out of a URL and leaves everything that made it useful', () => {
    const password = 'Tr0ub4dor&3';
    const scrubbed = scrubSecrets(`db is postgres://svc:${password}@db.internal:5432/app`);

    expect(scrubbed.text).not.toContain(password);
    // The scheme, the user, the host, the port and the database all survive: that
    // is the whole argument for scrubbing instead of refusing.
    expect(scrubbed.text).toBe('db is postgres://svc:<SECRET:url-password>@db.internal:5432/app');
  });

  it('takes the KEY MATERIAL out of a closed PEM block, not only its header', () => {
    const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDb1234567890abcdef';
    const text = `the key is:\n-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\ndone`;
    const scrubbed = scrubSecrets(text);

    // Replacing only the BEGIN marker would leave the key itself in the record:
    // the failure this asserts against, and the reason the pattern spans the block.
    expect(scrubbed.text).not.toContain(body);
    expect(scrubbed.text).toBe('the key is:\n<SECRET:private-key-block>\ndone');
  });

  it('takes this product’s own protected key file out of a record, body and all', () => {
    // The file `mnema key protect` writes is the private key under a passphrase, framed
    // `MNEMA PROTECTED KEY`, not a `PRIVATE KEY`, and it was not a thing the detector saw.
    const body = 'eyJ2IjoxLCJrZGYiOiJzY3J5cHQiLCJzYWx0IjoiYWJjZGVmZ2hpamtsbW5vcCJ9AAAAAAAAAAAA';
    const text = `kept:\n-----BEGIN MNEMA PROTECTED KEY-----\n${body}\n-----END MNEMA PROTECTED KEY-----\ndone`;
    const scrubbed = scrubSecrets(text);
    expect(scrubbed.text).not.toContain(body);
    expect(scrubbed.text).toBe('kept:\n<SECRET:private-key-block>\ndone');
  });

  it('takes a real protected key file out whole: the multi-line body `mnema key protect` writes', () => {
    // Captured from `mnema key protect` run under a throwaway HOME: the body is base64 wrapped at 64
    // columns, so the block spans lines, unlike the one-line body of the test above.
    const body = [
      'eyJ2IjoxLCJrZGYiOiJzY3J5cHQiLCJOIjozMjc2OCwiciI6OCwicCI6MSwic2Fs',
      'dCI6InFoMkoxMW4rOU9vUFRiNzg2M0tGMVE9PSIsIml2IjoidkZrVFRYZnYrYTgw',
      'TDJIMiIsInRhZyI6Im9OY2Jqc1hSbUd6ZlFhRWN2SnZYY2c9PSIsImRhdGEiOiJj',
      'V0wyNjhEemMvR0RCeW89In0=',
    ];
    const file = `-----BEGIN MNEMA PROTECTED KEY-----\n${body.join('\n')}\n-----END MNEMA PROTECTED KEY-----\n`;
    const scrubbed = scrubSecrets(`my key file:\n${file}ends`);
    for (const line of body) expect(scrubbed.text).not.toContain(line);
    expect(scrubbed.text).toBe('my key file:\n<SECRET:private-key-block>\nends');
    expect(scrubbed.replaced).toEqual(['private-key-block']);
  });

  it('spans a real key of the largest size anyone uses', () => {
    // The span the block pattern follows is bounded (an unbounded lazy scan before
    // a literal terminator is quadratic in a field packed with headers), and the
    // bound is set from the cost of that hostile input. So the size of a REAL key
    // has to be asserted, not assumed: an RSA-4096 private key is the biggest one
    // in practice at roughly 3.2 KB of base64, and an Ed25519 one is ~400 bytes.
    for (const bodyBytes of [400, 3200]) {
      const body = 'A'.repeat(bodyBytes);
      const scrubbed = scrubSecrets(
        `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`,
      );
      expect(scrubbed.text).not.toContain(body);
      expect(scrubbed.text).toBe('<SECRET:private-key-block>');
    }
  });

  it('replaces BOTH values when one field carries two different classes', () => {
    const aws = 'AKIAIOSFODNN7EXAMPLE';
    const password = 'hunter2hunter2';
    const scrubbed = scrubSecrets(`use ${aws} and postgres://u:${password}@h/d`);

    expect(scrubbed.text).not.toContain(aws);
    expect(scrubbed.text).not.toContain(password);
    expect([...scrubbed.replaced].sort()).toEqual(['aws-access-key', 'url-password']);
  });

  it('replaces EVERY occurrence, not just the first', () => {
    const key = 'AKIAIOSFODNN7EXAMPLE';
    const scrubbed = scrubSecrets(`${key} then ${key} then ${key}`);

    expect(scrubbed.text).not.toContain(key);
    expect(scrubbed.replaced).toHaveLength(3);
  });

  it('leaves a clean text byte-identical, and reports nothing', () => {
    const text = 'the projection cache is rebuilt by dropping and replaying';
    const scrubbed = scrubSecrets(text);

    expect(scrubbed.text).toBe(text);
    expect(scrubbed.replaced).toEqual([]);
  });
});

describe('scrubSecrets: a cleaned text is clean', () => {
  // Scrubbing has to reach a fixed point, and the reason is the audit: it reads the
  // SAME detector over the existing record, so a placeholder that still read as a
  // credential would make every already-cleaned record appear in the report
  // forever. A report that always fires is a report nobody reads.
  for (const secret of SECRET_CLASSES) {
    it(`finds nothing left in a text whose ${secret} was already replaced`, () => {
      const once = scrubSecrets(wrote(SAMPLES[secret]));
      expect(detectSecrets(once.text)).toEqual([]);
      expect(scrubSecrets(once.text).text).toBe(once.text);
    });
  }

  it('finds nothing left in a URL whose password was already replaced', () => {
    // The one class whose shape is "whatever sits in this position", so its own
    // placeholder lands exactly where it looks: the case that made this necessary.
    const once = scrubSecrets('postgres://svc:Tr0ub4dor3@db.internal/app');
    expect(once.text).toBe('postgres://svc:<SECRET:url-password>@db.internal/app');
    expect(detectSecrets(once.text)).toEqual([]);
    expect(scrubSecrets(once.text).replaced).toEqual([]);
  });
});

describe('scrubSecrets: the `sk-` family, where the prefix does not name the issuer', () => {
  // `sk-` is a convention several issuers reuse, so the prefix alone does not say
  // whose key it is. Order in `SECRET_CLASSES` is what decides the name a value is
  // reported under, and these cases pin the outcome of that order: the refusal was
  // never in doubt, the NAME was, and the name is what a person reads.
  const ANTHROPIC = `sk-ant-api03-${'Xy9'.repeat(12)}`;
  const ANTHROPIC_ADMIN = `sk-ant-admin01-${'Xy9'.repeat(12)}`;
  const OPENAI_PROJECT = `sk-proj-${'Xy9'.repeat(12)}`;
  const NO_ISSUER_PREFIX = `sk-${'Ab3'.repeat(9)}`;

  it('names ANTHROPIC on a key of Anthropic’s shape, not the issuer whose prefix it shares', () => {
    const scrubbed = scrubSecrets(`the key is ${ANTHROPIC} in staging`);

    expect(scrubbed.text).not.toContain(ANTHROPIC);
    expect(scrubbed.replaced).toEqual(['anthropic-key']);
    // The WRONG name, asserted ABSENT. It is the defect this class exists to fix:
    // `mnema decision import` printed `(openai-key)` beside a file holding one of
    // these, and a reader would have gone to rotate the wrong account's key.
    expect(scrubbed.replaced).not.toContain('openai-key');
    expect(scrubbed.text).not.toContain('openai-key');
  });

  it('names Anthropic after the family prefix, whatever product code follows it', () => {
    // The shape stops at `sk-ant-` on purpose: `api03` and `admin01` are product
    // codes, and pinning them would make the next one report the wrong issuer again.
    expect(detectSecrets(`rotate ${ANTHROPIC_ADMIN} today`)).toEqual(['anthropic-key']);
  });

  it('leaves OpenAI’s own shapes to OpenAI', () => {
    expect(detectSecrets(`rotate ${OPENAI_PROJECT} today`)).toEqual(['openai-key']);
    expect(detectSecrets(`rotate ${NO_ISSUER_PREFIX} today`)).toEqual(['openai-key']);
  });

  it('refuses EVERY member of the family: naming one of them cannot have opened a hole', () => {
    // The coverage question, asked WITHOUT reference to the label. Before this class
    // existed all four were replaced under one name; all four are still replaced,
    // once each. A reordering that opened a gap fails here and not somewhere later.
    for (const key of [ANTHROPIC, ANTHROPIC_ADMIN, OPENAI_PROJECT, NO_ISSUER_PREFIX]) {
      const scrubbed = scrubSecrets(`use ${key} now`);

      expect(scrubbed.text).not.toContain(key);
      expect(scrubbed.replaced).toHaveLength(1);
    }
  });

  it('replaces both when one field carries a key from each issuer', () => {
    const scrubbed = scrubSecrets(`old ${OPENAI_PROJECT} and new ${ANTHROPIC}`);

    expect(scrubbed.text).not.toContain(OPENAI_PROJECT);
    expect(scrubbed.text).not.toContain(ANTHROPIC);
    expect([...scrubbed.replaced].sort()).toEqual(['anthropic-key', 'openai-key']);
  });

  it('takes an Anthropic key out of a URL’s password slot under its OWN name', () => {
    // `url-password` is the class whose shape is "whatever sits in this position",
    // and it runs last, so a value that carries an issuer prefix is named by the
    // prefix, and only a password with no shape of its own falls through to it.
    const scrubbed = scrubSecrets(`https://u:${ANTHROPIC}@api.internal/v1`);

    expect(scrubbed.text).not.toContain(ANTHROPIC);
    expect(scrubbed.replaced).toEqual(['anthropic-key']);
  });
});

/**
 * The 24 names below are REAL: directory and branch names this repository's own work
 * produced, read as the skill id a person would type. They are a frozen sample of the
 * 194 the cut was measured over, chosen so that every spelling of every one of them is
 * long enough to reach the sieve: a corpus that fell short of the pattern would
 * measure nothing at all.
 */
const CHOSEN_NAMES: readonly string[] = [
  'a-ceiling-on-the-cases-that-wait',
  'a-line-of-success-is-one-line',
  'an-anchor-you-can-read-and-type',
  'attack-the-structural-criterion',
  'a-write-invalidates-what-it-changed',
  'context-reads-on-the-surface',
  'defer-the-run-to-the-first-write',
  'every-public-option-has-a-caller',
  'find-and-count-across-the-workspace',
  'intelligence-on-the-surface',
  'move-what-lives-in-another-project',
  'naming-a-path-asserts-a-project',
  'no-field-slips-past-the-door',
  'one-place-that-writes-the-output',
  'read-across-the-workspace',
  'refusal-names-the-trees-it-searched',
  'resume-a-tail-in-constant-time',
  'screen-what-enters-the-record',
  'shrinking-keeps-the-history',
  'stop-announcing-an-inert-effect',
  'the-address-says-what-it-covers',
  'the-bare-name-asks-what-you-want',
  'the-console-measures-columns',
  'the-cost-comes-from-the-host',
];

/** The spellings a person writes the same name in, and what each is for. */
const SPELLINGS: readonly { readonly how: string; readonly write: (name: string) => string }[] = [
  { how: 'plain', write: (name) => `sk-${name}` },
  { how: 'under Anthropic’s own prefix', write: (name) => `sk-ant-${name}` },
  { how: 'under the project prefix', write: (name) => `sk-proj-${name}` },
  { how: 'versioned', write: (name) => `sk-${name}-v2` },
  { how: 'behind an ADR number', write: (name) => `sk-adr-17-${name}` },
  { how: 'with underscores', write: (name) => `sk-${name.replace(/-/g, '_')}` },
  { how: 'behind a year', write: (name) => `sk-${name}-2026` },
];

/** The same name in camelCase: the spelling the cut deliberately does NOT rescue. */
function inCamelCase(name: string): string {
  return `sk-${name.replace(/-(.)/g, (_, letter: string) => letter.toUpperCase())}`;
}

describe('scrubSecrets: a name a person chose is not a credential', () => {
  it('records the name someone typed, not a placeholder where it used to be', () => {
    // The delivery case, at the unit that decides it. The assertion is the NAME,
    // not the absence of a placeholder, which would also pass on a sieve that had
    // eaten the name and put nothing in its place.
    const chosen = 'sk-check-the-tenant-scope-first';
    const scrubbed = scrubSecrets(chosen);

    expect(scrubbed.text).toBe(chosen);
    expect(scrubbed.replaced).toEqual([]);
  });

  it('records the whole SENTENCE a name is mentioned inside', () => {
    // The shape fires mid-text, so the damage was never limited to a name field: a
    // memory that merely MENTIONED such an id was recorded mutilated.
    const sentence = 'the skill sk-check-the-tenant-scope-first governs this path';
    expect(scrubSecrets(sentence).text).toBe(sentence);
  });

  for (const spelling of SPELLINGS) {
    it(`leaves every one of the ${CHOSEN_NAMES.length} names alone, written ${spelling.how}`, () => {
      const destroyed = CHOSEN_NAMES.filter(
        (name) =>
          scrubSecrets(`the skill ${spelling.write(name)} governs this path`).replaced.length > 0,
      );
      expect(destroyed).toEqual([]);
    });
  }

  it('still destroys all of them in camelCase: the cost of the cut, as a count', () => {
    // NOT an oversight, and the assertion is written as a count so it cannot be
    // read as one. A capital letter is the mark of the dense alphabet every real
    // key in this table is drawn from, and rescuing camelCase would give up the
    // OpenAI legacy format entirely.
    //
    // It is also this file's NON-VACUITY witness for everything above: the same
    // names, one spelling away, DO reach the sieve and DO come back replaced. A
    // corpus that never matched the pattern would pass every case above while
    // measuring nothing.
    const destroyed = CHOSEN_NAMES.filter(
      (name) => scrubSecrets(inCamelCase(name)).replaced.length > 0,
    );
    expect(destroyed).toHaveLength(CHOSEN_NAMES.length);
  });
});

/**
 * One name-shaped value written under each class's prefix, and what the sieve must
 * say about it.
 *
 * Keyed BY class so `SECRET_CLASSES` drives the loop, exactly as `SAMPLES` does: a
 * class added to the sieve with no probe here fails, and so does a probe for a class
 * the sieve does not have. This is where "which prefixes the name rule is reached
 * from" is pinned: the table inside the module decides it, and a change to that
 * table shows up here as a named failure rather than as a shift in a corpus count.
 */
interface NameProbe {
  /** A name written under the class's prefix, or the nearest thing to one. */
  readonly text: string;
  /** What the sieve must report, and why that is the right answer. */
  readonly verdict: readonly SecretClass[];
  readonly why: string;
}

const NAME_UNDER_EACH_PREFIX: Readonly<Record<string, NameProbe>> = {
  'aws-access-key': {
    text: 'akia-check-the-tenant-scope-first',
    verdict: [],
    why: 'the prefix is four CAPITALS; no slug wears it',
  },
  'github-token': {
    text: 'ghp_check_the_tenant_scope_first_thing',
    verdict: [],
    why: 'the body admits no separator, so a slug never reaches the length',
  },
  'gitlab-token': {
    text: 'glpat-check-the-tenant-scope-first',
    verdict: ['gitlab-token'],
    why: 'A DECLARED LIMIT, on the argument `slack-token` makes below: `glpat` and its kin are GitLab’s own coinage, nobody’s word',
  },
  'huggingface-token': {
    text: 'hf_check_the_tenant_scope_first_thing',
    verdict: [],
    why: 'the body admits no separator',
  },
  'anthropic-key': {
    text: 'sk-ant-eater-does-not-eat-any-ants',
    verdict: [],
    why: 'the rule reaches this class: `ant` is a word, and this shape runs FIRST',
  },
  'openai-key': {
    text: 'sk-check-the-tenant-scope-first',
    verdict: [],
    why: 'the rule reaches this class: `sk` is this product’s own verb, abbreviated',
  },
  'stripe-key': {
    text: 'sk_live_check_the_tenant_scope_first',
    verdict: [],
    why: 'the body admits no separator',
  },
  'slack-token': {
    text: 'xoxb-check-the-tenant-scope-first',
    verdict: ['slack-token'],
    why: 'A DECLARED LIMIT. This shape DOES swallow a name (191 of the 194 measured) and it is left that way on purpose: `xoxb` is nobody’s word, no name among the 194 begins with one, so relaxing it would give up a real issuer to rescue a name that does not exist',
  },
  'google-api-key': {
    text: 'AIza-check-the-tenant-scope-first-thing',
    verdict: ['google-api-key'],
    why: 'the same declared limit, for the same reason: `AIza` is an invented token, not a word anyone chooses',
  },
  'npm-token': {
    text: 'npm_check_the_tenant_scope_first_thing',
    verdict: [],
    why: 'the body admits no separator',
  },
  jwt: {
    text: 'eyj-check-the-tenant-scope-first-thing',
    verdict: [],
    why: 'the prefix needs a capital J and two dots; a slug has neither',
  },
  'private-key-block': {
    text: 'begin-private-key-check-the-tenant-scope',
    verdict: [],
    why: 'the shape is a PEM header in full, dashes and capitals included',
  },
  'url-password': {
    text: 'postgres://svc:check-the-tenant-scope@db.internal/app',
    verdict: ['url-password'],
    why: 'RIGHT, not a limit: this class’s shape is "whatever sits in this position", and a name typed into a password slot is a password',
  },
  'authorization-header': {
    text: 'authorization-check-the-tenant-scope',
    verdict: [],
    why: 'a name with the word in it is not a header: there is no `:` or `=` after it',
  },
  'named-credential': {
    text: 'password-check-the-tenant-scope',
    verdict: [],
    why: 'a name with the word in it is not an assignment: there is no `:` or `=` after it',
  },
};

describe('scrubSecrets, which prefixes the name rule is reached from', () => {
  it('carries one probe per recognized class: the ruler this section measures with', () => {
    expect(Object.keys(NAME_UNDER_EACH_PREFIX).sort()).toEqual([...SECRET_CLASSES].sort());
  });

  for (const secret of SECRET_CLASSES) {
    const probe = NAME_UNDER_EACH_PREFIX[secret] as NameProbe;
    it(`under ${secret}, a name is ${probe.verdict.length === 0 ? 'left alone' : 'still replaced'}: ${probe.why}`, () => {
      expect(detectSecrets(`the skill ${probe.text} governs this path`)).toEqual(probe.verdict);
    });
  }
});

/**
 * Random draws in the formats their issuers define, so "no key stopped being caught"
 * is a COUNT and not a claim.
 *
 * The draws are deterministic, a fixed seed through a small generator, because a
 * suite that asserts over fresh randomness asserts a probability, and a probability
 * fails one run in some hundreds and gets called a flake instead of a finding.
 *
 * No value here is a credential: every one is generated in this process from digits
 * and letters, matches nothing anybody issued, and is printed nowhere.
 */
const KEY_DRAWS = 5_000;

/** A small deterministic generator: the same draws on every machine, every run. */
function rolls(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const BASE62 = `${LOWERCASE}${LOWERCASE.toUpperCase()}0123456789`;
const BASE64URL = `${BASE62}-_`;
const HEX = '0123456789abcdef';

/** The formats the cut is measured against: every `sk-` family shape in the wild. */
const KEY_FORMATS: readonly {
  readonly who: string;
  readonly of: (roll: () => number) => string;
}[] = [
  {
    who: 'an OpenAI legacy key, 48 characters with the fixed infix',
    of: (r) => `sk-${pickFrom(r, BASE62, 20)}T3BlbkFJ${pickFrom(r, BASE62, 20)}`,
  },
  { who: 'an OpenAI legacy key, 48 characters plain', of: (r) => `sk-${pickFrom(r, BASE62, 48)}` },
  {
    who: 'an OpenAI legacy key, the shorter 32-character spelling',
    of: (r) => `sk-${pickFrom(r, BASE62, 32)}`,
  },
  { who: 'an OpenAI project key', of: (r) => `sk-proj-${pickFrom(r, BASE64URL, 156)}` },
  { who: 'an OpenAI service-account key', of: (r) => `sk-svcacct-${pickFrom(r, BASE64URL, 100)}` },
  { who: 'an OpenAI admin key', of: (r) => `sk-admin-${pickFrom(r, BASE64URL, 100)}` },
  { who: 'an Anthropic api03 key', of: (r) => `sk-ant-api03-${pickFrom(r, BASE64URL, 95)}` },
  { who: 'an Anthropic admin01 key', of: (r) => `sk-ant-admin01-${pickFrom(r, BASE64URL, 95)}` },
  { who: 'a DeepSeek key, 32 hex', of: (r) => `sk-${pickFrom(r, HEX, 32)}` },
  {
    who: 'an OpenRouter key, an issuer tag then 64 hex',
    of: (r) => `sk-or-v1-${pickFrom(r, HEX, 64)}`,
  },
  { who: 'a Moonshot key, 48 base62', of: (r) => `sk-${pickFrom(r, BASE62, 48)}` },
  { who: 'an OpenAI-compatible key, 40 base62', of: (r) => `sk-${pickFrom(r, BASE62, 40)}` },
  {
    who: 'an OpenAI-compatible key, UUID-shaped',
    of: (r) =>
      `sk-${pickFrom(r, HEX, 8)}-${pickFrom(r, HEX, 4)}-${pickFrom(r, HEX, 4)}-${pickFrom(r, HEX, 4)}-${pickFrom(r, HEX, 12)}`,
  },
];

/** `count` characters drawn from `alphabet` by the generator. */
function pickFrom(roll: () => number, alphabet: string, count: number): string {
  let out = '';
  for (let index = 0; index < count; index += 1) {
    out += alphabet[Math.floor(roll() * alphabet.length)];
  }
  return out;
}

describe('scrubSecrets, the differential: no key stopped being caught', () => {
  for (const [index, format] of KEY_FORMATS.entries()) {
    it(`replaces ${KEY_DRAWS} of ${KEY_DRAWS} draws of ${format.who}`, () => {
      const roll = rolls(0x5eed + index);
      const escaped: number[] = [];
      for (let draw = 0; draw < KEY_DRAWS; draw += 1) {
        const key = format.of(roll);
        const scrubbed = scrubSecrets(`rotate ${key} today`);
        // The value is ABSENT from the output, never "the report is non-empty".
        if (scrubbed.text.includes(key)) escaped.push(draw);
      }
      // The draw NUMBERS, so a failure names which ones and the key itself is never
      // printed. This is the line that cannot fail: zero secrets stopped being caught.
      expect(escaped).toEqual([]);
    });
  }

  it('names the shape a lowercase-only issuer would have: the coverage the cut costs', () => {
    // Stated as a test rather than left in a comment, because it IS what the cut
    // gives up: a key drawn from a lowercase-only alphabet is words by shape, and no
    // shape-based sieve can tell it from a name. None of the thirteen formats above
    // mints one. If one ever does, this case is where the argument gets reopened.
    const roll = rolls(0xf00d);
    const hypothetical = `sk-${pickFrom(roll, LOWERCASE, 48)}`;

    expect(scrubSecrets(`rotate ${hypothetical} today`).replaced).toEqual([]);
  });
});

describe('scrubSecrets: what it does NOT flag', () => {
  // The values this product itself stamps on every event. An entropy rule would
  // replace all of them (measured: 13,094 hits over a real archive, of which
  // 8,208 fingerprints and 3,649 ids), which is why there is no entropy rule.
  const OWN_IDENTIFIERS = [
    '019fa8b7-0410-717b-9af2-cfeb013fc4ac',
    'mnid:8f14e45fceea167a5a36dedd4bea2543',
    'a3f5c9e1b7d24680f1e3a5c7b9d1f3e5a7c9b1d3f5e7a9c1b3d5f7e9a1c3b5d7',
    'decision_status_changed',
    'ADR-17',
  ];

  for (const identifier of OWN_IDENTIFIERS) {
    it(`leaves ${identifier.slice(0, 24)}… alone`, () => {
      expect(scrubSecrets(`subject ${identifier} recorded`).replaced).toEqual([]);
    });
  }

  it('leaves a URL with a PORT alone: a port is not a password', () => {
    const url = 'https://example.com:8080/v1/status';
    expect(scrubSecrets(url).text).toBe(url);
  });

  it('leaves an ordinary sentence about credentials alone', () => {
    const text = 'rotate the aws key and the github token before Friday';
    expect(scrubSecrets(text).replaced).toEqual([]);
  });
});

describe('scrubSecrets: the shapes each issuer documents', () => {
  // Each from the issuer's own table of token formats: GitHub's (`github_pat_`), GitLab's
  // "Token prefixes", Hugging Face's user access tokens page, Stripe's webhook guide.
  const FINE_GRAINED = `github_pat_${'11ABCDEFG0'.repeat(2)}ab_${'Zq8Rt5Wx2Ly'.repeat(6)}`;
  const CAUGHT: readonly { readonly value: string; readonly secret: SecretClass }[] = [
    { value: FINE_GRAINED, secret: 'github-token' },
    { value: `glpat-${'Ab3_dE6-hJ'.repeat(2)}`, secret: 'gitlab-token' },
    { value: `gldt-${'Ab3dE6hJ9k'.repeat(2)}`, secret: 'gitlab-token' },
    { value: `glrt-${'Ab3dE6hJ9k'.repeat(3)}`, secret: 'gitlab-token' },
    { value: `glcbt-${'Ab3dE6hJ9k'.repeat(2)}`, secret: 'gitlab-token' },
    { value: `hf_${'QwErTy7UiO'.repeat(3)}pAsD`, secret: 'huggingface-token' },
    { value: `whsec_${'Mn4Bv8Cx2Z'.repeat(3)}`, secret: 'stripe-key' },
  ];

  for (const { value, secret } of CAUGHT) {
    it(`replaces ${value.slice(0, 12)}... as ${secret}, and leaves the sentence`, () => {
      const scrubbed = scrubSecrets(`rotate ${value} today`);
      expect(scrubbed.text).toBe(`rotate ${secretPlaceholder(secret)} today`);
      expect(scrubbed.replaced).toEqual([secret]);
    });
  }

  const LEFT: readonly { readonly why: string; readonly text: string }[] = [
    {
      why: 'a name under github_pat_',
      text: 'the github_pat_rotation_policy_for_the_team_and_the_bots doc',
    },
    { why: 'the word glpat with too short a body', text: 'a glpat-short one' },
    { why: 'a name under hf_', text: 'the hf_check_the_tenant_scope_first_thing skill' },
    { why: 'whsec_ with too short a body', text: 'a whsec_short value' },
  ];
  for (const { why, text } of LEFT) {
    it(`leaves ${why} alone`, () => {
      expect(scrubSecrets(text).text).toBe(text);
    });
  }
});

describe('scrubSecrets: a value after a credential’s name or header', () => {
  // The value is gone and the name or the header stays: rotating it needs to know which.
  const CAUGHT: readonly {
    readonly text: string;
    readonly value: string;
    readonly secret: SecretClass;
  }[] = [
    {
      text: 'curl -H "Authorization: Bearer abc.DEF-123_xyz"',
      value: 'abc.DEF-123_xyz',
      secret: 'authorization-header',
    },
    {
      text: 'Authorization: Basic dXNlcjpwYXNz',
      value: 'dXNlcjpwYXNz',
      secret: 'authorization-header',
    },
    {
      text: 'authorization: bearer s3cr3t-T0ken',
      value: 's3cr3t-T0ken',
      secret: 'authorization-header',
    },
    {
      text: '{"Authorization": "Bearer abc123def"}',
      value: 'abc123def',
      secret: 'authorization-header',
    },
    {
      text: 'Proxy-Authorization: Basic Zm9vOmJhcg==',
      value: 'Zm9vOmJhcg==',
      secret: 'authorization-header',
    },
    { text: 'Authorization: rawtoken42', value: 'rawtoken42', secret: 'authorization-header' },
    {
      text: '{"type":"stream.hello","token":"agm_Zx81yQkP3nLw9Tr"}',
      value: 'agm_Zx81yQkP3nLw9Tr',
      secret: 'named-credential',
    },
    {
      text: '{"token":"agm_\u2026x9Kq2LmZp"}',
      value: 'agm_\u2026x9Kq2LmZp',
      secret: 'named-credential',
    },
    {
      text: 'curl -H "Authorization: Bearer agm_Zx81yQkP3nLw9Tr"',
      value: 'agm_Zx81yQkP3nLw9Tr',
      secret: 'authorization-header',
    },
    {
      text: 'X-Api-Key: agm_Zx81yQkP3nLw9Tr',
      value: 'agm_Zx81yQkP3nLw9Tr',
      secret: 'named-credential',
    },
    {
      text: 'MACHINE_TOKEN=agm_Zx81yQkP3nLw9Tr',
      value: 'agm_Zx81yQkP3nLw9Tr',
      secret: 'named-credential',
    },
    { text: 'PASSWORD=hunter2', value: 'hunter2', secret: 'named-credential' },
    {
      text: 'export DATABASE_PASSWORD=S3nh4F0rte',
      value: 'S3nh4F0rte',
      secret: 'named-credential',
    },
    { text: 'API_KEY=abc123', value: 'abc123', secret: 'named-credential' },
    { text: 'secret: Xq9-dk3', value: 'Xq9-dk3', secret: 'named-credential' },
    { text: '{"password": "hunter2"}', value: 'hunter2', secret: 'named-credential' },
    {
      text: "{ password: 'correct horse battery staple' }",
      value: 'correct horse battery staple',
      secret: 'named-credential',
    },
    { text: 'GET /v1/items?token=abc123&page=2', value: 'abc123', secret: 'named-credential' },
    {
      text: 'https://app.example/cb#access_token=Zm9vYmFy&state=1',
      value: 'Zm9vYmFy',
      secret: 'named-credential',
    },
    {
      text: 'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      secret: 'named-credential',
    },
    {
      text: 'ACME-INTERNAL-TOKEN=7f3a9c2b8e1d4a6f',
      value: '7f3a9c2b8e1d4a6f',
      secret: 'named-credential',
    },
    { text: 'X-Api-Key: 9f8e7d6c5b4a', value: '9f8e7d6c5b4a', secret: 'named-credential' },
    { text: 'docker run -e "MNEMA_TOKEN=Zx81yQ" app', value: 'Zx81yQ', secret: 'named-credential' },
    { text: 'client_secret: "abc-DEF_123"', value: 'abc-DEF_123', secret: 'named-credential' },
    { text: 'apiKey: "k3y-v4lue"', value: 'k3y-v4lue', secret: 'named-credential' },
    { text: 'PIN as a password: password=123456', value: '123456', secret: 'named-credential' },
    { text: '  passwd = pa55word', value: 'pa55word', secret: 'named-credential' },
  ];

  for (const { text, value, secret } of CAUGHT) {
    it(`takes the value out of ${JSON.stringify(text.slice(0, 40))} as ${secret}`, () => {
      const scrubbed = scrubSecrets(text);
      expect(scrubbed.text).not.toContain(value);
      expect(scrubbed.text).toBe(text.replace(value, secretPlaceholder(secret)));
      expect(scrubbed.replaced).toEqual([secret]);
    });
  }

  it('names the issuer when the value has a shape of its own: the context classes come last', () => {
    const github = `ghp_${'A1b2C3d4E5'.repeat(4)}`;
    const openai = `sk-proj-${'Xy9'.repeat(12)}`;
    expect(scrubSecrets(`Authorization: Bearer ${github}`).replaced).toEqual(['github-token']);
    expect(scrubSecrets(`OPENAI_API_KEY=${openai}`).replaced).toEqual(['openai-key']);
    expect(scrubSecrets(`{"password": "${github}"}`).replaced).toEqual(['github-token']);
  });

  // Each of these holds a credential's name, a header or the word, and none holds one.
  const LEFT: readonly { readonly why: string; readonly text: string }[] = [
    { why: 'a title about a token', text: 'Rotate the token every week' },
    { why: 'a title about a password', text: 'Passwords are kept in the vault, never in the repo' },
    { why: 'a count of tokens', text: 'max_tokens=1024 and token_count: 5' },
    { why: 'a pagination cursor', text: 'next_token=eyJvZmZzZXQiOjEwMH0 and NextToken: AbC123' },
    {
      why: 'a permission of a workflow',
      text: 'permissions:\n  id-token: write\n  contents: read',
    },
    {
      why: 'a type in a declaration',
      text: 'interface Login {\n  password: string;\n  token: string;\n}',
    },
    {
      why: 'a variable standing for the value',
      text: `Authorization: Bearer $TOKEN and PASSWORD=\${DB_PASSWORD}`,
    },
    { why: 'a placeholder for the value', text: 'API_KEY=<your-key> and "token": "<token>"' },
    { why: 'a value already masked', text: 'password: *** and token=xxxxxxxx' },
    { why: 'a flag with no value', text: 'auth: true\nsecret: none' },
    {
      why: 'code reading the value from elsewhere',
      text: '  token: request.token,\n  secret: process.env[NAME];',
    },
    {
      why: 'a package named after the word',
      text: '"@inquirer/password": "^4.0.0",\n"jsonwebtoken": "9.0.2"',
    },
    { why: 'a package path ending in the word', text: '"@octokit/auth-token": "latest"' },
    {
      why: 'a sentence about authorization',
      text: 'accepted under his standing authorization: "Faça os aceites"',
    },
    {
      why: 'a sentence quoting a word after authorization',
      text: 'granted under the maintainer’s authorization: "Approved"',
    },
    {
      why: 'header names listed in a sentence',
      text: 'none for github_pat_, glpat-, Authorization: Bearer, PASSWORD= or a JSON field',
    },
    {
      why: 'a message kept under a name',
      text: "HOLDS_A_SECRET: 'the field reads as a credential and was refused'",
    },
    { why: 'a name used in a sentence', text: "x ? 'a password' : 'a token'" },
    {
      why: 'a protocol sentence showing the shape of a token with its body elided',
      text:
        'a request with an `Origin` is refused. The first text frame: ' +
        '`{"type":"stream.hello","token":"agm_\u2026","streamId":"<43 base64url>"}` (the machine\'s token)',
    },
    { why: 'an issuer prefix with three dots for a body', text: 'token: "ghp_..." in the example' },
    // The nine notes that destroyed the first class read by name, measured then and
    // asserted now: each is where a secret lives, not the secret.
    {
      why: 'note 1',
      text: `the api_key: environment \u2014 it comes from the deploy, never the repo`,
    },
    { why: 'note 2', text: 'token: 15000000 tokens spent this month on the audit' },
    { why: 'note 3', text: 'the secret: rotation is quarterly and nobody remembers to do it' },
    { why: 'note 4', text: 'apiKey= process.env.OPENAI_API_KEY in the new client' },
    { why: 'note 5', text: 'credential: short-lived, issued by the OIDC provider at deploy time' },
    { why: 'note 6', text: 'token = identifier | keyword | punctuation in the lexer' },
    { why: 'note 7', text: 'design token: color-surface-raised, defined once in the theme' },
    { why: 'note 8', text: 'password: unchanged since the migration, tracked in the ticket' },
    { why: 'note 9', text: 'api_key: deprecated, use the bearer token instead' },
  ];

  for (const { why, text } of LEFT) {
    it(`leaves ${why} as written`, () => {
      expect(scrubSecrets(text).text).toBe(text);
    });
  }
});

describe('scrubSecrets: the whole value, wherever a credential is written', () => {
  // A fragment left behind is a leak with a placeholder beside it: the reader is told the value
  // went while part of it stayed. Each value ends where its form ends: an unquoted one at a blank
  // or the end of the line, punctuation and all; a quoted one at its own closing quote, a doubled
  // or escaped quote inside it included; and on a line of its own after an environment name, at
  // the end of the line. The expected text is written out, never derived from the input.
  const PLACEHOLDER = '<SECRET:named-credential>';
  const WHOLE: readonly { readonly text: string; readonly recorded: string }[] = [
    { text: 'password=abc;def123', recorded: `password=${PLACEHOLDER}` },
    { text: 'password=p@ss,word99', recorded: `password=${PLACEHOLDER}` },
    { text: 'token=abc<def123 next', recorded: `token=${PLACEHOLDER} next` },
    { text: 'password=hunter2)x', recorded: `password=${PLACEHOLDER}` },
    { text: '(PASSWORD=hunter2)', recorded: `(PASSWORD=${PLACEHOLDER})` },
    { text: "password='it''s'", recorded: `password='${PLACEHOLDER}'` },
    { text: 'password="it""s"', recorded: `password="${PLACEHOLDER}"` },
    { text: 'password="ab\\"cd"', recorded: `password="${PLACEHOLDER}"` },
    { text: 'password: "hunter2', recorded: `password: "${PLACEHOLDER}` },
    { text: 'DB_PASSWORD=pa ss word', recorded: `DB_PASSWORD=${PLACEHOLDER}` },
    {
      text: 'DB_PASSWORD=pa ss word # the old one',
      recorded: `DB_PASSWORD=${PLACEHOLDER} # the old one`,
    },
    { text: 'TOKEN=abc123\\\nxyz', recorded: `TOKEN=${PLACEHOLDER}` },
    {
      text: 'Server=db;User Id=sa;Password=Pa55w0rd!;',
      recorded: `Server=db;User Id=sa;Password=${PLACEHOLDER};`,
    },
    {
      text: 'GET /v1/items?token=abc;123&page=2',
      recorded: `GET /v1/items?token=${PLACEHOLDER}&page=2`,
    },
    { text: `password = "${'a'.repeat(1100)}"`, recorded: `password = "${PLACEHOLDER}"` },
    // A comma or a semicolon after the value ends it, and does not make it a line of code: a
    // review found each of these kept whole, the value read as a name that code closes.
    { text: 'password=hunter2, user=me', recorded: `password=${PLACEHOLDER}, user=me` },
    {
      text: 'token=Xk9qLm2Pz7, expires=3600',
      recorded: `token=${PLACEHOLDER}, expires=3600`,
    },
    { text: '{password: S3cretPass, user: me}', recorded: `{password: ${PLACEHOLDER}, user: me}` },
    { text: 'password=Xk9qLm2Pz7;', recorded: `password=${PLACEHOLDER};` },
    { text: 'DB_PASSWORD=Xk9qLm2Pz7,', recorded: `DB_PASSWORD=${PLACEHOLDER},` },
    { text: 'api_key: Xk9qLm2Pz7,', recorded: `api_key: ${PLACEHOLDER},` },
    // After a colon, the first word when it reads as a secret, and the words after it stay.
    {
      text: 'token: abc123XYZ987 for the staging box',
      recorded: `token: ${PLACEHOLDER} for the staging box`,
    },
    { text: 'secret: Xk9qLm2Pz7 rotated', recorded: `secret: ${PLACEHOLDER} rotated` },
    { text: 'password: S3cret! (prod)', recorded: `password: ${PLACEHOLDER} (prod)` },
    { text: 'the old pwd: Tr0ub4dor&3 is gone', recorded: `the old pwd: ${PLACEHOLDER} is gone` },
    // A single word alone after a colon: under a password's name any word that is not a
    // placeholder, and under another name a word that is not a short one in small letters.
    { text: 'api_key: AbCdEfGhIjKlMnOpQrSt', recorded: `api_key: ${PLACEHOLDER}` },
    { text: 'password: letmein', recorded: `password: ${PLACEHOLDER}` },
    { text: 'PASSWORD: letmein', recorded: `PASSWORD: ${PLACEHOLDER}` },
    { text: '  db_password: hunter', recorded: `  db_password: ${PLACEHOLDER}` },
  ];

  for (const { text, recorded } of WHOLE) {
    it(`takes the whole value out of ${JSON.stringify(text.slice(0, 40))}`, () => {
      const scrubbed = scrubSecrets(text);
      expect(scrubbed.text).toBe(recorded);
      expect(scrubbed.replaced).toEqual(['named-credential']);
    });
  }

  // The places a credential is passed that a key written down does not cover: a command's flag,
  // the user and password `curl` takes, a value in backticks, a name ending in `pass`, a comment
  // after the value, and a quoted value with blanks under any credential's name.
  const PASSED: readonly { readonly text: string; readonly recorded: string }[] = [
    {
      text: 'curl -u admin:S3cretPass https://api.x',
      recorded: `curl -u admin:${PLACEHOLDER} https://api.x`,
    },
    {
      text: 'curl --user admin:S3cretPass https://api.x',
      recorded: `curl --user admin:${PLACEHOLDER} https://api.x`,
    },
    {
      text: 'curl -s -u "admin:S3cret Pass" https://api.x',
      recorded: `curl -s -u "admin:${PLACEHOLDER}" https://api.x`,
    },
    {
      text: 'docker login -u me -p S3cretPass registry.io',
      recorded: `docker login -u me -p ${PLACEHOLDER} registry.io`,
    },
    {
      text: 'docker login -u me --password S3cretPass registry.io',
      recorded: `docker login -u me --password ${PLACEHOLDER} registry.io`,
    },
    { text: 'mysql -u root -pS3cretPass', recorded: `mysql -u root -p${PLACEHOLDER}` },
    { text: 'mysql --password S3nh4F0rte', recorded: `mysql --password ${PLACEHOLDER}` },
    { text: 'gh release --token "abc 123"', recorded: `gh release --token "${PLACEHOLDER}"` },
    { text: 'token=`abc123`', recorded: `token=\`${PLACEHOLDER}\`` },
    { text: 'apiKey: `abc123xyz`', recorded: `apiKey: \`${PLACEHOLDER}\`` },
    { text: 'DB_PASS=hunter2', recorded: `DB_PASS=${PLACEHOLDER}` },
    { text: 'export SMTP_PASS=hunter2', recorded: `export SMTP_PASS=${PLACEHOLDER}` },
    {
      text: 'auth: { user: "a", pass: "hunter2" }',
      recorded: `auth: { user: "a", pass: "${PLACEHOLDER}" }`,
    },
    { text: 'token: abc123 # rotated', recorded: `token: ${PLACEHOLDER} # rotated` },
    { text: 'api_key: "abc def ghi"', recorded: `api_key: "${PLACEHOLDER}"` },
    { text: 'apiKey: "abc def"', recorded: `apiKey: "${PLACEHOLDER}"` },
    { text: 'basicAuth=dXNlcjpwYXNz', recorded: `basicAuth=${PLACEHOLDER}` },
  ];

  for (const { text, recorded } of PASSED) {
    it(`takes the value out of ${JSON.stringify(text.slice(0, 44))}`, () => {
      const scrubbed = scrubSecrets(text);
      expect(scrubbed.text).toBe(recorded);
      expect(scrubbed.replaced).toEqual(['named-credential']);
    });
  }

  // What text writes in the same places and is no credential. The first fifty-five are the
  // ordinary texts an adversarial review of the first cut wrote against it, thirteen of which it
  // replaced; they are kept here as written, so a change that takes one again fails by name.
  const ORDINARY: readonly string[] = [
    'Rotate the token every week',
    'the password policy requires 12 characters',
    'authorization: the maintainer',
    'set API_KEY in the CI secret store',
    'tokenCount is 4096',
    'passwordHash: string;',
    'ADR-12: Use OAuth tokens for auth',
    'max_tokens=1024',
    'token budget: 200k',
    'Token budget: about 200000 per window',
    'id-token: write',
    'password: unchanged since the migration',
    'Secret: the key lives in the vault',
    'api_key: environment',
    'token: see the vault',
    'Authorization: Bearer',
    'the Authorization header carries a Bearer token',
    'password=<redacted>',
    `TOKEN=\${{ secrets.GH_TOKEN }}`,
    'GH_TOKEN=$GITHUB_TOKEN',
    'secret: VECTOR_SECRET,',
    'token: request.token,',
    'auth: required',
    'token-budget=large',
    'Key: the ADR number',
    'secret=sauce in the recipe',
    'password_min_length=12',
    'the auth=flow decision',
    'publish token=OIDC',
    'tokens=500',
    'key: value',
    'Pass: 3',
    'token: none',
    'secret: yes',
    'pwd: /home/me',
    'cwd=/tmp; pwd=/home/x',
    'password: see 1Password',
    'Authorization: maintainer',
    'apikey=env',
    'token: Mnema-agent-key',
    'auth=oidc',
    'next_token=abc',
    'pageToken=abcdef',
    'csrf_token=abcdef',
    'tokenizer=bpe',
    'secrets: inherit',
    'secret: inherit',
    `token: \${{ github.token }}`,
    'token: ghost',
    'access_key: rotated',
    'with: token: write',
    'auth: oauth',
    '"auth": "oidc"',
    '"token": "pending"',
    'PASSWORD=changeme',
    // And the flags those commands share with every other one.
    'echo "$PW" | docker login -u me --password-stdin registry.io',
    'docker run -p 8080:80 -u 1000:1000 app',
    'mkdir -p build && git push -u origin main',
    'mysql -u root -p mydb',
    'curl -u admin https://api.x',
    'pass the --password flag when the prompt is not wanted',
    'pwd=/srv/app',
    'AUTH_URL=https://login.example.com/oauth/authorize',
    'bypass: true',
    "'google-api-key': 'A Google API key, the shape the issuer documents'",
    // Found over this repository's own pages and record once the cut above was in: a prefix
    // named in a sentence, and a provider's name standing before a placeholder.
    'A GitHub token: `ghp_`, `gho_` or `ghr_`, then 36 or more letters',
    'run `aider --model sonnet --api-key anthropic=<key>` in the clone',
    // Found by the second review: a limit's name, an id under a token's name, and a title that
    // names a scheme in a sentence.
    'max_token=8192',
    'maxToken: 4096',
    'token: 01a1f59d',
    'the token: 01a1f59d was minted for the run',
    'Authorization: Bearer tokens only, no Basic',
    'Use Authorization: Bearer tokens',
    // And what a colon is followed by in a sentence: a word, a name in code, a number, an
    // algorithm's name, each followed by more words.
    'Password: twelve characters minimum',
    'A password: at least 12 characters',
    'The password: Hunter2 rule is gone',
    'Set the secret: GH_TOKEN in the repository',
    'Rename secret_key: secretKey',
    'token: accessToken,',
    'api_key: apiKey;',
    'auth: OAuth2 with PKCE',
    'private_key: Ed25519 only',
    'secret: sha256 of the body',
    'token: Mnema',
  ];

  for (const text of ORDINARY) {
    it(`records ${JSON.stringify(text.slice(0, 48))} as written`, () => {
      expect(scrubSecrets(text)).toEqual({ text, replaced: [] });
    });
  }
});

describe('scrubSecrets: the readings of a value cost a scan, not a search', () => {
  // A reading runs on every value a context class found, so a pattern in it that can split one
  // string in many ways is a door a crafted value walks through: a path of thirty `a/` pieces
  // took seconds under the first reading of a path, where an optional capital and the letters
  // after it could each take the same small letter.
  for (const value of [`/${'a/'.repeat(30)}!`, `https://-/${'a/'.repeat(30)}!`]) {
    it(`reads ${JSON.stringify(value.slice(0, 16))}... in well under a second`, () => {
      const started = performance.now();
      const scrubbed = scrubSecrets(`pwd=${value}`);
      expect(performance.now() - started).toBeLessThan(250);
      expect(scrubbed.text).toBe('pwd=<SECRET:named-credential>');
    });
  }
});

describe('scrubSecrets: the limits, stated as tests', () => {
  // These are the cases the shape cannot reach, and the reason each write surface
  // declares in its own description that what it does not recognize goes in
  // verbatim. They are asserted so the gap stays a known gap: a change that closed
  // one of them would fail here and be noticed, not discovered later.
  const ESCAPES: readonly { readonly why: string; readonly text: string }[] = [
    { why: 'a password written out in prose', text: 'the staging password is hunter2' },
    {
      why: 'a proprietary token format, with no name around it',
      text: 'the build uses 7f3a9c2b8e1d4a6f',
    },
    { why: 'a secret encoded in base64', text: 'creds: aHVudGVyMmh1bnRlcjJodW50ZXIy' },
    { why: 'a secret split across two records', text: 'the first half is AKIAIOSF' },
    { why: 'a key with a space injected', text: 'AKIA IOSFODNN7EXAMPLE' },
    { why: 'a password described rather than written', text: 'the password is the usual one' },
    // The class read by a NAME (`named-credential`) was refused once, by measure: over
    // twelve notes a knowledge base plausibly records it destroyed nine ("api_key:
    // environment", "password: unchanged since the migration"). What answers for those
    // nine now is that a name is read as a KEY only where text writes a key down, and a
    // colon followed by a sentence is not one; the nine are asserted below, untouched.
    // What that costs is these: a short word in small letters after a colon reads as prose
    // under a name that is not a password's, and a flag takes its value after a blank, where a
    // sentence goes on just the same.
    {
      why: 'a single short word in small letters after a colon under a name that is not a password’s, which prose writes too',
      text: 'token: abcd',
    },
    { why: 'a single word after a flag, for the same reason', text: 'mysql --password hunter' },
    {
      why: 'a single word followed by more words after `=`, which a sentence writes too',
      text: 'run it as PGPASSWORD=hunter psql',
    },
    {
      why: 'a value under a token’s name that reads as a slug of words',
      text: 'token: deploy-bot-key',
    },
    { why: 'a camelCase name ending in Pass', text: 'smtpPass=hunter2' },
    // The limits the documentation states, one each.
    {
      why: 'an unquoted passphrase of several words',
      text: 'secret: correct horse battery staple',
    },
    {
      why: 'a token that is a slug in small letters without digits',
      text: 'token=abcd-efgh-ijkl-mnop',
    },
    { why: 'a path standing as the value', text: 'webhook_secret=/T000/B000/abcdefgh' },
    {
      why: 'a webhook address, whose secret is its path',
      text: 'SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T000/B000/XXXXabcd',
    },
    { why: 'a value of three digits or fewer', text: 'password=123' },
    {
      why: 'a key of several lines with no BEGIN line',
      text: 'private_key: |\n  MIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n  abcdef0123456789abcdef',
    },
    {
      why: 'a word with letters and digits after a colon that is short and followed by more words',
      text: 'password: Hunter2 was the old one',
    },
  ];

  for (const uncaught of ESCAPES) {
    it(`does NOT catch ${uncaught.why}: a known limit, not a bug`, () => {
      expect(scrubSecrets(uncaught.text).replaced).toEqual([]);
    });
  }

  it('calls a `sk-` key with no issuer prefix `openai-key`: a best guess, not a reading', () => {
    // A declared LIMIT, and the reason `anthropic-key` did not close the whole
    // question: `sk-` alone is shared by OpenAI's legacy keys and by every other
    // issuer that reuses the convention without a prefix of its own, and nothing in
    // the value says which. Refusing under the likeliest name beats accepting for
    // want of a name, and asserting the name here makes a better one a deliberate
    // change rather than a drift.
    const key = `sk-${'Ab3'.repeat(9)}`;
    const scrubbed = scrubSecrets(`some other vendor: ${key}`);

    expect(scrubbed.text).not.toContain(key);
    expect(scrubbed.replaced).toEqual(['openai-key']);
  });

  it('leaves the BODY of an UNCLOSED PEM block, replacing only its header', () => {
    // Losing the header too would be strictly worse (nothing would match at all),
    // so this is the deliberate trade. It is a limit, and it is asserted as one.
    const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ';
    const scrubbed = scrubSecrets(`-----BEGIN PRIVATE KEY-----\n${body}`);

    expect(scrubbed.replaced).toEqual(['private-key-block']);
    expect(scrubbed.text).toContain(body);
  });
});

describe('detectSecrets: classes, never values', () => {
  it('answers with the class and gives no way to reach the value', () => {
    const key = 'AKIAIOSFODNN7EXAMPLE';
    const found = detectSecrets(`deploy with ${key}`);

    expect(found).toEqual(['aws-access-key']);
    // The return type is the whole of the defense in an audit report: there is no
    // value in it to print, so no caller can turn the remedy into a second
    // disclosure. Asserted structurally: every entry is a known class name.
    for (const entry of found) expect(SECRET_CLASSES).toContain(entry);
    expect(JSON.stringify(found)).not.toContain(key);
  });

  it('agrees with the scrub exactly: one code path, so they cannot drift', () => {
    const text = `AKIAIOSFODNN7EXAMPLE and postgres://u:s3cret@h/d and ${'x'.repeat(40)}`;
    expect(detectSecrets(text)).toEqual(scrubSecrets(text).replaced);
  });

  it('finds nothing in a clean text', () => {
    expect(detectSecrets('a memory about the merge order across tails')).toEqual([]);
  });
});
