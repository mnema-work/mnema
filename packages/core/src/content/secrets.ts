/**
 * What a credential looks like, and how it leaves the text before the text is
 * recorded.
 *
 * The record is append-only: a value written here cannot be taken back, and in a
 * public tree it is committed to the repository and clones to every machine that
 * ever pulls it. So a credential that reaches the chain is not a bug to fix
 * later: it is a permanent disclosure, and rotating the credential is the only
 * remedy left. That is why the text is cleaned at the door rather than reported
 * afterwards.
 *
 * A KNOWN PREFIX, OR A KNOWN CONTEXT. Every pattern below anchors on a format its
 * issuer defined (`AKIA…`, `ghp_…`, a PEM header), or on the place text keeps a
 * credential whatever its shape: the password slot of a URL, the value of an
 * `Authorization` header, the value written after a name such as `PASSWORD=` or
 * `"api_key":`. Generic "high-entropy string" detection is deliberately absent, and
 * not as a matter of taste: this product stamps a v7 id and a key fingerprint on
 * EVERY event, so an entropy rule would replace the record's own identity; measured
 * over a real archive of 4,277 events, a prefix rule flagged 0 values and an entropy
 * rule flagged 13,094, of which 8,208 were fingerprints and 3,649 were ids. A defense
 * that eats the identifiers is worse than none, because the record stops being
 * readable while still not being safe.
 *
 * A CONTEXT IS READ AS A KEY, NEVER AS A WORD. A class read by a credential's name was
 * written once and refused by measure: over twelve notes a knowledge base plausibly
 * records ("api_key: environment, it comes from the deploy", "password: unchanged
 * since the migration") it destroyed nine, because it could not tell where a secret
 * IS from where it lives. What the two classes read by context hold to now is the
 * shape text gives a key: in quotes of its own, or opening a line, an argument, a
 * member or a query parameter, followed by a value that ends where a value ends. Those
 * nine notes are asserted untouched in the tests; over this repository's own record
 * (1,892 events, 6,290 fields) and the machine's private one the two classes replaced
 * nothing at all, and over the documentation one value, an example passphrase.
 *
 * LENGTHS ARE MINIMUMS, NEVER EXACT. A pattern that pinned a token's length
 * would stop matching the day its issuer added one character: silently, with no
 * failing test anywhere. An early version of the Google pattern fixed 35
 * characters and missed a real 36-character key exactly that way.
 *
 * NO CAPTURE GROUPS. Every pattern matches the secret and NOTHING else, so the
 * replacement is always the whole match. This is structural, not stylistic: the
 * first version of this detector isolated a URL password in group 1 and passed
 * `String.replace` a callback, where the second argument is the match OFFSET when
 * the pattern has no group, so the replacement silently no-oped while the report
 * still said "replaced". It told the caller the value was gone and wrote it
 * anyway, which is worse than no defense at all, because a false all-clear ends
 * the investigation. With no groups that shape of bug cannot be written: the
 * password pattern uses a lookbehind for its context (see `url-password`), so the
 * match IS the secret. And the tests assert the VALUE IS ABSENT from the output,
 * never that a counter moved: the assertion that catches this, where checking
 * the report is the assertion that does not.
 *
 * THE PLACEHOLDER IS TYPED AND CARRIES NO DIGEST. `<SECRET:aws-access-key>` says
 * what class of thing was removed, because rotating an AWS key and changing a
 * database password are different operations and whoever reads the record six
 * months later has to know which one to do. It carries no hash of the removed
 * value: a digest of a LOW-entropy secret (a password) falls to a dictionary in
 * seconds, so it would leak the very value it replaced while looking safe.
 *
 * AND IT MUST NOT EAT THE NAMES PEOPLE CHOOSE. The same argument that killed an
 * entropy rule applies one level down, to a PREFIX that is also a word. `sk-` is a
 * convention several issuers reuse and it is also two letters a person reaches for
 * in a product whose own verb is `skill`. Measured over the 194 directory and
 * branch names this repository's own work produced, read as the skill id someone would
 * type, 173 of 194 were replaced: `mnema skill "sk-check-the-tenant-scope-first"`
 * recorded the name as `<SECRET:openai-key>`, and the record is append-only, so the
 * name the person chose was not recoverable. The same shape fired INSIDE a sentence,
 * so a memory that merely MENTIONED such an id was recorded mutilated too. What
 * answers for that is {@link readsAsAChosenName}, and it is measured on both sides
 * rather than tuned until it felt right.
 *
 * AND IT ONLY CATCHES WHAT IT RECOGNIZES. A proprietary token with no name around
 * it, a password written out in prose or as a lone word after a colon, a secret split
 * across two records, a base64 blob: all of them pass. This is damage reduction, not a guarantee, and the honest place to
 * say so is where a caller reads the contract, which is why the write surfaces
 * declare the limit in their own descriptions instead of letting silence read as
 * safety.
 */

/**
 * The classes of credential the scrubber recognizes, in the order it applies them.
 *
 * This list is the ONE address of that order: {@link scrubSecrets} walks it, and
 * the shapes next door are a lookup keyed by it rather than a second sequence. The
 * order carries meaning, see `SHAPES` for the prefix families it resolves, so two
 * copies of it would be two readings of one rule.
 */
export const SECRET_CLASSES = [
  'aws-access-key',
  'github-token',
  'gitlab-token',
  'huggingface-token',
  // `anthropic-key` before `openai-key`: `sk-ant-` is the longer of two prefixes
  // that share `sk-`, so the specific one has to be tried first. Moving it after
  // `openai-key` still refuses the value and reports the WRONG issuer.
  'anthropic-key',
  'openai-key',
  'stripe-key',
  'slack-token',
  'google-api-key',
  'npm-token',
  'jwt',
  'private-key-block',
  'url-password',
  // The two classes read by CONTEXT come last, after every shape an issuer defined:
  // `Authorization: Bearer ghp_...` is reported as the GitHub token it is, because the
  // prefix class already took the value and left a placeholder these two step over.
  // Moved first, they would still remove the value and report the wrong thing to rotate.
  'authorization-header',
  'named-credential',
] as const;

/** One class of credential the scrubber recognizes. */
export type SecretClass = (typeof SECRET_CLASSES)[number];

/** What replaces a recognized credential: the class, and nothing about the value. */
export function secretPlaceholder(secret: SecretClass): string {
  return `<SECRET:${secret}>`;
}

/**
 * How far past a PEM header the block's body is followed when looking for the
 * closing marker.
 *
 * The bound is what keeps the search linear. An unbounded lazy `[\s\S]*?` before
 * a literal terminator has to scan to the end of the field once per header when
 * no terminator exists, so a field packed with headers would cost the square of
 * its length.
 *
 * The SIZE of the bound is measured, not guessed. A field of 64 KiB packed with
 * 2,427 unclosed headers is the worst input reachable under the size limit, and the
 * span is what its cost is linear in; this pattern alone over that input, the two
 * spans measured side by side in one process:
 *
 *   span 16384 : 105.3 ms
 *   span  8192 :  55.3 ms
 *
 * Against 0.35 ms for a whole scrub of a clean 64 KiB field and 0.0011 ms for a
 * typical one, so the bound is the only thing standing between a hostile field and
 * a hundred milliseconds of regex.
 *
 * 8 KiB is still generous by a wide margin against what it has to hold: an RSA-4096
 * private key in PEM is about 3.2 KB of body and an Ed25519 one about 400 bytes, so
 * the span covers the largest key anyone uses twice over. Halving it halves the
 * worst case for nothing given up: both of those keys are still replaced whole,
 * asserted in the tests rather than assumed here.
 */
const PEM_BODY_SPAN = 8_192;

/**
 * The blanks allowed around a `:` or `=` in the two classes read by context, and the reason
 * they are COUNTED: those shapes begin with a lookbehind, which the engine runs backwards
 * from every position in the text, so an unbounded run of blanks inside it would be walked
 * once per position, the square of the field's length on a field of spaces. Eight is more
 * than any alignment a person or a formatter writes.
 */
const GAP = '[ \\t]{0,8}';

/** The scheme words an `Authorization` value may open with, and the blank after one. */
const SCHEME = '(?:bearer|basic|token|digest|negotiate)[ \\t]{1,8}';

/**
 * A scheme word standing alone, which is never the credential: `Authorization: Bearer,` in a
 * sentence that lists header names has no value after it to take.
 */
const SCHEME_WORD = String.raw`(?:bearer|basic|token|digest|negotiate)\b`;

/**
 * A credential in a header: the token characters of RFC 6750 with its trailing `=`, taken
 * whole or not at all, and never ending on a letter outside ASCII, which is the inside of a
 * word (`Faça` is not the token `Fa`).
 */
const HEADER_VALUE = String.raw`[A-Za-z0-9._~+/-]+=*(?![A-Za-z0-9._~+/-]|[^\x00-\x7f])`;

/**
 * The run of name characters before a credential's word (`DB_`, `x-api-`, `GITHUB_`, `--`),
 * counted for the reason {@link GAP} is.
 */
const NAME_HEAD = '[A-Za-z0-9_.-]{0,64}';

/**
 * Where a credential's name stands as a KEY: bare before its `:` or `=` (`PASSWORD=`,
 * `--token=`, `{ apiKey:`, `#access_token=`), or in quotes of its own, whole
 * (`"db_password":`). A quoted key has to be a name from quote to quote, which is what turns
 * away a sentence held in quotes (`'a password' : ...`) and a package's path
 * (`"@octokit/auth-token":`), both found taking a value in this repository's own code
 * before this was written.
 */
function keyed(name: string): string {
  return String.raw`(?:["']${NAME_HEAD}${name}["']|${name})`;
}

/**
 * A quoted value after a credential's key and a `:` or `=`, the value made of `unit`. The
 * quote is spelled out per alternative rather than captured and referred back to, because
 * no shape here has a capture group (see the module comment).
 */
function quotedAfter(name: string, quote: '"' | "'", unit: string): string {
  return (
    String.raw`(?<=${keyed(name)}${GAP}[:=]${GAP}${quote}(?:${SCHEME})?)` +
    String.raw`(?!${SCHEME_WORD})${unit}{1,1024}(?=${quote})`
  );
}

/**
 * A value alone on its line after a credential's name opening that line (`.env`, INI, YAML,
 * a header), the value made of anything but blanks and quotes. `refuse` is a lookahead the
 * value must also pass, which is how the colon form turns away a single word.
 */
function onItsLine(separator: ':' | '=', refuse = ''): string {
  return (
    String.raw`(?<=^[ \t]{0,64}(?:- |export )?["']?${NAME_HEAD}${CREDENTIAL_NAME}["']?${GAP}${separator}${GAP}(?:${SCHEME})?)` +
    String.raw`(?!${SCHEME_WORD})${refuse}[^\s"'\x60]+(?=[ \t\r]*$)`
  );
}

/**
 * The names whose value may carry blanks: a passphrase is the one credential written as
 * words. Under every other name a quoted value with a blank in it is a sentence (a message
 * kept under `HOLDS_A_SECRET`, a description under `'google-api-key'`), not a key.
 */
const PASSPHRASE_NAME = '(?:pass(?:word|wd|phrase)|pwd)';

/**
 * The end of a name a credential is kept under, in any case (the shapes that use it are
 * case-insensitive): `PASSWORD`, `db_password`, `apiKey`, `X-Api-Key`, `client_secret`,
 * `GITHUB_TOKEN`. Only the END is matched, so any prefix is accepted, and a name that goes
 * on past the word (`tokenizer`, `secrets`, `max_tokens`, `token_count`) is not one.
 *
 * TWO WORDS NEED MORE THAN THEIR SPELLING. `token` also names a pagination cursor (`next_token`,
 * `NextToken`, `page_token`, `continuationToken`), an opaque value that is not a credential and
 * that an agent pastes when it debugs an API, so a cursor's prefix turns the name away. And
 * `auth` ends `oauth`, a protocol's name, so it counts only as a word of its own.
 */
const CREDENTIAL_NAME =
  '(?:pass(?:word|wd|phrase)|pwd|secret|api[_-]?key|access[_-]?key|private[_-]?key|' +
  'secret[_-]?key|(?<!(?:next|page|continuation|pagination|sync|cursor|resume)[_-]?)token|' +
  '(?<![a-z])auth)';

/**
 * The shape of each class, as a LOOKUP. The order lives in
 * {@link SECRET_CLASSES} and nowhere else; the keys below are written in that same
 * order for legibility only, and nothing reads this object's own key order.
 *
 * The type is a mapped record over {@link SecretClass}, so a class added to the
 * list does not compile until it has a shape here. That is the point: a class with
 * no shape would never fire, and an audit would report a clean record while the
 * value went to the chain.
 *
 * SHARED PREFIXES EXIST, AND ORDER IS WHAT RESOLVES THEM. This comment used to
 * claim that "no two patterns here overlap (`sk-` and `sk_` are different
 * prefixes)". That premise was false, and a real key falsified it: `sk-` is a
 * convention several issuers reuse, so a key of Anthropic's shape (`sk-ant-…`) was
 * matched by the OpenAI shape and reported to a person as `openai-key`: the
 * refusal right, the name wrong. The rule now: within a family that shares a
 * prefix, the class whose prefix is MORE SPECIFIC comes first in
 * {@link SECRET_CLASSES}, and the general one is the fallback label. `sk-` is the
 * only such family in this table today.
 *
 * The rule is held by `secrets.test.ts`, which walks `SECRET_CLASSES` and asserts
 * each class's sample is reported as EXACTLY that class. A class added behind a
 * prefix an earlier shape already swallows fails there rather than shipping the
 * wrong name, which is what this table had no way to catch before.
 *
 * Every shape is global, and matches the SECRET ONLY: no capture groups, ever
 * (see the module comment), so a replacement is the whole match. Each runs over the
 * text the previous ones already cleaned, so a placeholder is never re-matched.
 */
const SHAPES: { readonly [K in SecretClass]: RegExp } = {
  'aws-access-key': /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16,}\b/g,
  // The classic prefixes, and the fine-grained token GitHub's own table of token formats
  // lists beside them (`github_pat_`, a 22-character id, `_`, then the 59-character secret).
  // Both runs are minimums; the `_` between them is what keeps a slug out, since a name
  // would need an unbroken run of twenty letters and digits on each side of it.
  'github-token':
    /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9]{20,}_[A-Za-z0-9]{40,})\b/g,
  // Every prefix GitLab's "Token prefixes" table lists, personal, project and group access
  // tokens (`glpat-`) and the deploy, runner, job, trigger, feed, mail, agent, workspace,
  // SCIM, OAuth application and feature flag ones. The body is 20 characters today; a
  // routable token carries more after it, and the minimum still takes the secret part.
  // No trailing `\b`, for the reason `google-api-key` has none: the body may end in `-`.
  'gitlab-token': /\bgl(?:pat|oas|dt|rtr?|cbt|ptt|ft|imt|agent|wt|soat|ffct)-[A-Za-z0-9_-]{20,}/g,
  // `hf_` and a run of letters and digits: the shape Hugging Face's user access tokens
  // page shows. Its length is not documented, so the minimum is below the 34 seen today.
  'huggingface-token': /\bhf_[A-Za-z0-9]{30,}\b/g,
  // Anthropic's own prefix, tried before the shared one. The suffix after `sk-ant-`
  // is left open (`api03`, `admin01`, and whatever comes next) because the family
  // name is what identifies the issuer, not the product code inside it.
  //
  // It reads a match for a name too, and it HAS to: `ant` is an English word, this
  // class runs FIRST, and a name it swallowed would never reach the fallback below.
  // Measured: behind `sk-ant-` the same 194 names came back 188 destroyed, and with
  // the second reading on the fallback ALONE, 173 of those 188 were still destroyed:
  // this shape had already eaten them. Half the fix lives here.
  'anthropic-key': /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  // The FALLBACK of the `sk-` family: OpenAI's legacy and project keys, and any
  // other issuer that reuses the convention without a prefix of its own. So the
  // NAME here is a best guess over a refusal: a trade asserted as a declared limit
  // in the tests rather than left to be discovered by a reader.
  //
  // The refusal used to be CERTAIN, and that is the half this shape no longer
  // claims: `sk-` is a prefix a person also chooses, so a match here is read once
  // more by {@link readsAsAChosenName} before it is destroyed. What falsified the
  // old wording was a name, not a key: `sk-check-the-tenant-scope-first` came back
  // out of the record as `<SECRET:openai-key>`.
  'openai-key': /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  // The secret and restricted keys, and the webhook signing secret (`whsec_`) Stripe's
  // webhook guide hands to every endpoint.
  'stripe-key': /\b(?:(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{24,})\b/g,
  'slack-token': /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  // No trailing `\b`: a key one character longer than the issuer's current
  // length would otherwise stop matching, which is the failure mode the
  // minimum-length rule exists to avoid.
  'google-api-key': /\bAIza[0-9A-Za-z_-]{30,}/g,
  'npm-token': /\bnpm_[A-Za-z0-9]{36,}\b/g,
  jwt: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  // The WHOLE block when it is closed, so the key material goes with the header.
  // The closing half is optional on purpose: a truncated paste with no END marker
  // would otherwise match nothing at all, and losing the header too is strictly
  // worse than losing only the body. What that costs is stated as a limit rather
  // than hidden: an unclosed block leaves its body in the text.
  //
  // TWO FRAMINGS, ONE CLASS. The product's own protected key file (`MNEMA PROTECTED KEY`, the
  // private key encrypted under a passphrase) is a private key in the one way that matters
  // here: its text, pasted into a record, is a key file in the record, and a record cannot be
  // edited. It did not match the first framing alone, which names a `PRIVATE KEY`.
  'private-key-block': new RegExp(
    String.raw`-----BEGIN (?:(?:[A-Z ]+ )?PRIVATE KEY|MNEMA PROTECTED KEY)-----` +
      String.raw`(?:[\s\S]{0,${PEM_BODY_SPAN}}?-----END (?:(?:[A-Z ]+ )?PRIVATE KEY|MNEMA PROTECTED KEY)-----)?`,
    'g',
  ),
  // The password half of `scheme://user:PASSWORD@host`, and only that half: the
  // scheme, the user and the host are the context that makes the record useful,
  // so they survive. The context is a LOOKBEHIND rather than a capture group,
  // which is what makes the match the secret itself.
  //
  // The `(?!<SECRET:)` is what keeps this shape from matching its OWN
  // placeholder. It is the only class whose shape is "whatever sits in this
  // position", so a cleaned URL still has something in the password slot, and
  // without the guard the detector would report a credential in text it had
  // already cleaned. That matters most for the audit, which reads the same
  // detector: every scrubbed record would show up in it forever, and a report that
  // always fires is a report nobody reads.
  'url-password': /(?<=\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)(?!<SECRET:)[^\s/@]{3,}(?=@)/g,
  // The value of an `Authorization` header (and `Proxy-Authorization`): whatever the token
  // looks like, the header names it a credential. The scheme is in the lookbehind, so the
  // match is the token alone, and the lookahead at the start is what keeps the scheme word
  // itself from being taken for the value.
  //
  // THE WORD IS ALSO PROSE, and that is measured, not supposed: over this repository's own
  // record the first cut of this shape took the first word after "standing authorization:"
  // 31 times. So the header has to look like one. Either it carries a scheme (`Bearer`,
  // `Basic`, ...), or it opens a line, a quoted string or an object and its
  // value ends there too. And the value ends at a blank, a quote or punctuation, never
  // in the middle of a word.
  'authorization-header': new RegExp(
    [
      String.raw`(?<=\bauthorization["']?${GAP}[:=]${GAP}["']?${SCHEME})${HEADER_VALUE}`,
      String.raw`(?<=(?:^[ \t]{0,64}|["'{][ \t]{0,8})(?:proxy-)?authorization["']?${GAP}[:=]${GAP}["']?)` +
        String.raw`(?!${SCHEME_WORD})${HEADER_VALUE}(?=[ \t\r]*(?:$|["',}]))`,
    ].join('|'),
    'gim',
  ),
  // A value written after a credential's NAME, in the three ways text writes one down:
  // quoted after `:` or `=` (JSON, YAML, TOML, code), unquoted right after `=` (`.env`, a
  // query string, a flag), and alone on its line after `:` or `=` (YAML, INI, a header
  // line). The third is bound to the line on purpose: in prose a colon is followed by a
  // sentence, and `Secret: the key lives in the vault` has to come out as written.
  'named-credential': new RegExp(
    [
      quotedAfter(PASSPHRASE_NAME, '"', String.raw`(?:[^"\\\n]|\\.)`),
      quotedAfter(PASSPHRASE_NAME, "'", String.raw`[^'\n]`),
      quotedAfter(CREDENTIAL_NAME, '"', String.raw`(?:[^"\\\s]|\\.)`),
      quotedAfter(CREDENTIAL_NAME, "'", String.raw`[^'\s]`),
      String.raw`(?<=${keyed(CREDENTIAL_NAME)}=)[^\s"'\x60<>&;,)\]}]+`,
      onItsLine('='),
      onItsLine(':', String.raw`(?![A-Za-z][a-z]*[.,;:!?]?[ \t\r]*$)`),
    ].join('|'),
    'gim',
  ),
};

/**
 * What a text must hold before a class read by context is looked for in it at all.
 *
 * A shape that OPENS with a lookbehind cannot be skipped ahead by the engine: it is tried at
 * every position of the text. Measured over a clean field of 64 KiB, the two such shapes
 * took a whole scrub from 0.31 ms to 3.55 ms; a literal the text has to contain first is
 * found by a scan the engine does quickly, and a text without it, nearly every one, never
 * pays for the lookbehinds. The gate is a necessary condition of its shape and no more: a
 * text it lets through is still read by the shape itself.
 */
const ONLY_WHERE: { readonly [K in SecretClass]?: RegExp } = {
  'authorization-header': /authorization/i,
  'named-credential': /(?:pass(?:word|wd|phrase)|pwd|secret|key|token|auth)["']?[ \t]{0,8}[:=]/i,
};

/**
 * The second reading a match under each class gets before it is destroyed, or `undefined`
 * where the shape is the whole answer. A reading returns true when the match is to be
 * carried through untouched.
 *
 * A mapped record over {@link SecretClass} for the reason `SHAPES` is one: a class
 * added to the list does not compile until it answers. The answer is not cosmetic:
 * `undefined` here means a name written under that prefix is destroyed, permanently, by a
 * record that cannot be edited.
 *
 * TWO READINGS, FOR TWO KINDS OF SHAPE. A prefix a person could choose for a name is read
 * by {@link readsAsAChosenName}; a value found by its CONTEXT, after a credential's name or
 * header, is read by {@link readsAsNoCredential}, because there the shape says nothing about
 * the value and the context alone cannot tell `PASSWORD=hunter2` from `password: string`.
 *
 * THE TWO `sk-` ENTRIES ARE THE ONLY PREFIXES READ AS A NAME, AND THE LINE IS MEASURED. Two other
 * shapes admit slug punctuation in their body and will swallow a name written under
 * their prefix: over the same 194 names, `slack-token` destroyed 191 of them behind
 * `xoxb-` and `google-api-key` destroyed them behind `AIza`. Both stay unread,
 * because the trade runs the other way there. `sk` is an English abbreviation of this
 * product's own verb and `ant` is an English word; `xoxb` and `AIza` are invented
 * tokens that are nobody's word, and no name among the 194 begins with either. So
 * relaxing those two would give up coverage of a real issuer to rescue a name that
 * does not exist. `gitlab-token` joins them on the same argument: `glpat` and its kin are
 * GitLab's own coinage. The limits are pinned BY NAME in `secrets.test.ts`, in the probe
 * table that walks this list, so changing one is a deliberate act and not a drift.
 *
 * IT IS NOT EXPORTED AT ALL, and neither is the rule it gates. Nothing outside asks
 * which prefixes are ambiguous, and a consumer able to import either could keep a
 * second opinion about what counts as a name. The module boundary is what makes that
 * impossible rather than merely discouraged: there is no declaration here for a
 * surface sweep to check, because there is nothing exported for it to find.
 */
const SECOND_READING: { readonly [K in SecretClass]: ((match: string) => boolean) | undefined } = {
  'aws-access-key': undefined,
  'github-token': undefined,
  'gitlab-token': undefined,
  'huggingface-token': undefined,
  'anthropic-key': readsAsAChosenName,
  'openai-key': readsAsAChosenName,
  'stripe-key': undefined,
  'slack-token': undefined,
  'google-api-key': undefined,
  'npm-token': undefined,
  jwt: undefined,
  'private-key-block': undefined,
  'url-password': undefined,
  'authorization-header': readsAsNoHeaderValue,
  'named-credential': readsAsNoCredential,
};

/** One piece of a name, cut at the punctuation a slug is written with. */
const NAME_WORD = /^[a-z]+$/;

/**
 * The same piece, carrying the number people version and count things with: `v2`,
 * `17`, `2026`, `p1`. Four letters at most before the digits, which is what keeps a
 * long mixed token (the shape every real key body has) from reading as one word.
 */
const NAME_NUMBERED_WORD = /^[a-z]{0,4}[0-9]{1,4}$/;

/** The punctuation a slug is written with, and the only thing a name is cut at. */
const NAME_SEPARATOR = /[-_]/;

/**
 * Whether `value` reads as a name a person chose rather than a credential.
 *
 * THE CRITERION. A credential has to be unguessable, so its body is drawn from a
 * dense alphabet at length; a name has to be sayable, so it is WORDS. A value is a
 * name when every piece of it, cut at the separators a slug uses, is a lowercase word,
 * optionally carrying a short number, which is how people version and number
 * things. Nothing here looks at the prefix: `sk` is itself a word, so the whole match
 * is asked the one question and no prefix has to be stripped off first.
 *
 * MEASURED ON BOTH SIDES, because tightening the shape risks letting a real key
 * through and leaving it risks going on destroying names: the tension is the whole
 * of the decision, so it was answered with counts. LEFT: the 194 directory and branch
 * names this repository's own work produced, under six spellings (plain, versioned,
 * ADR-numbered, underscored, camelCase, year-suffixed). RIGHT: 20,000 random draws
 * from each of 13 key formats their issuers define: OpenAI legacy at 48 and at 32
 * characters and with the `T3BlbkFJ` infix, OpenAI project, service-account and admin
 * keys, both Anthropic product codes, DeepSeek's 32 hex, OpenRouter's `sk-or-v1-`,
 * Moonshot, a generic OpenAI-compatible range, and a UUID-shaped one.
 *
 *   names destroyed   173/194 → 0/194   in five of the six spellings
 *   keys escaping     0 of 260,000, in every one of the 13 formats
 *
 * Four other criteria were run over the same two corpora and are rejected by the
 * number, not by taste. "A hyphen anywhere means a name" lets 160,000 of 300,000
 * keys through: every project key, every Anthropic key, every OpenRouter key.
 * "No hyphen-free run of twenty or more means a name" lets every UUID-shaped key
 * through, and it also let a handful of REAL base64url keys through at random,
 * because `-` and `_` are in that alphabet: a coverage that turns on a coin toss is
 * worse than a coverage that is merely narrower.
 *
 * WHAT THE CUT COSTS, as a number rather than a shrug. A name carrying a CAPITAL is
 * still destroyed, 139 of the 194 written in camelCase, and that is deliberate: an
 * uppercase letter is the mark of the dense alphabet every real key here is drawn
 * from, and rescuing camelCase would give up the OpenAI legacy format entirely. And a
 * hypothetical key drawn from a LOWERCASE-ONLY alphabet now reads as a name, 20,000
 * of 20,000 draws. No issuer among the 13 mints one; that is the whole of the
 * evidence for the cut, and it is a measurement rather than a proof.
 *
 * Held by `secrets.test.ts`: the differential there runs both corpora and asserts the
 * counts on both sides, and the probe table beside it pins which prefixes this rule
 * is reached from. Its cost is asserted there too: this runs only on a value that
 * already matched, so a clean field never reaches it.
 */
function readsAsAChosenName(value: string): boolean {
  for (const segment of value.split(NAME_SEPARATOR)) {
    if (!NAME_WORD.test(segment) && !NAME_NUMBERED_WORD.test(segment)) return false;
  }
  return true;
}

/**
 * Where a value found by its context points at the credential instead of being it: a shell
 * or template variable (`$TOKEN`, `${{ secrets.X }}`, `%TOKEN%`, `{token}`), a placeholder in
 * angle brackets (`<your-token>`), and this detector's own `<SECRET:...>`, which is what makes
 * a cleaned text clean a second time.
 */
const A_REFERENCE = /^[<$%{]/;

/**
 * What a value under a credential's name is when it is a fact about the field and not its
 * content: a flag, an empty marker, a type in a declaration (`password: string;`), with the
 * `;` or `,` a declaration ends on, and a permission (`id-token: write`, in every GitHub
 * workflow that signs).
 */
const NOT_A_VALUE =
  /^(?:true|false|null|nil|none|undefined|yes|no|on|off|string|str|number|int|integer|bool|boolean|bytes|any|unknown|object|optional|required|read|write)[;,]?$/i;

/** A name in code, followed by members (`.token`) or by keys (`[NAME]`). */
const IDENTIFIER_PATH = String.raw`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[A-Za-z_$][\w$]*\])*`;

/**
 * A value already masked by whoever wrote it (`***`, `xxxx`, `...`), or with no letter or
 * digit at all, which is a line of code opening a bracket (`SECRET = (`) and no key.
 */
const ALREADY_MASKED = /^(?:[^A-Za-z0-9]|[xX])+$/;

/**
 * A line of code where the name's value is another name or a number: `token: request.token,`,
 * `secret: VECTOR_SECRET,`, `bytesPerToken: 4,`, `token = config[NAME]`. Measured over this
 * repository's own source, where the line form took these before this reading kept them.
 *
 * A PATH OF NAMES IS ALSO A TOKEN, which is why a bare one is not enough: Google's access
 * tokens are written `ya29.` and a long run of letters, a path to the letter. So a path is
 * code only where code closes it (`;` or `,`) or where it starts from a root code reads a
 * setting from (the process's environment, `config.`, `request.`, ...).
 */
const A_CODE_EXPRESSION = new RegExp(
  String.raw`^(?:(?:${IDENTIFIER_PATH}|\d+(?:[._]\d+)*)[;,]|` +
    String.raw`(?:process\.env|os\.environ|env|this|self|config|settings|request|req|options|opts|args|params|props)` +
    String.raw`(?:\.[A-Za-z_$][\w$]*|\[[A-Za-z_$][\w$]*\])+)$`,
);

/** A version, which is what a package whose name ends in `token` or `auth` is given. */
const A_VERSION = /^[~^]?v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/;

/**
 * Whether a value found by its CONTEXT reads as no credential at all, so it is carried
 * through as written.
 *
 * THE CONTEXT CLASSES TAKE A VALUE WHATEVER ITS SHAPE, and that is the point of them: a
 * password has no prefix, and `PASSWORD=hunter2` carries seven characters any word could
 * have. The price is that the same position also holds what is not a value, and those are
 * what this answers for. A NUMBER IS A VALUE here: a PIN is a password, and a count is
 * turned away by its name instead (`max_tokens`, `token_count` are not credential names).
 *
 * A LOW-ENTROPY VALUE GETS THE PLACEHOLDER, NEVER A DIGEST, for the reason the module
 * comment gives: these two classes are where the low-entropy secrets are, so a digest here
 * would be a dictionary lookup away from the password it replaced.
 */
function readsAsNoCredential(value: string): boolean {
  return readsAsNoHeaderValue(value) || A_CODE_EXPRESSION.test(value) || A_VERSION.test(value);
}

/**
 * The same reading for a header, without the two that read code and versions: after
 * `Authorization:` neither is ever written, and a token can look like either (`ya29.` and a
 * run of letters is a path of names, and a short opaque token can be all digits and dots).
 */
function readsAsNoHeaderValue(value: string): boolean {
  return A_REFERENCE.test(value) || NOT_A_VALUE.test(value) || ALREADY_MASKED.test(value);
}

/** Text with every recognized credential replaced, and what was taken out of it. */
export interface ScrubbedText {
  /** The text as it will be recorded. */
  readonly text: string;
  /**
   * One entry per value replaced, in the order the classes were applied. Empty
   * when the text was already clean, and then {@link ScrubbedText.text} is the
   * input, unchanged and not rebuilt.
   */
  readonly replaced: readonly SecretClass[];
}

/**
 * Replaces every recognized credential in `text` with its typed placeholder.
 *
 * Each pattern runs over the output of the previous one, so a text carrying two
 * different classes comes back with both replaced. Nothing is allocated when the
 * text is clean, which is the overwhelmingly common case: the whole pass costs
 * about two microseconds on a typical record.
 */
export function scrubSecrets(text: string): ScrubbedText {
  let out = text;
  let replaced: SecretClass[] | undefined;
  for (const secret of SECRET_CLASSES) {
    const pass = scrubWith(out, secret, SHAPES[secret]);
    if (pass.replaced.length === 0) continue;
    out = pass.text;
    replaced = replaced === undefined ? [...pass.replaced] : [...replaced, ...pass.replaced];
  }
  return replaced === undefined ? { text, replaced: [] } : { text: out, replaced };
}

/**
 * The CLASSES of credential `text` contains, never the values.
 *
 * This is what an audit of the existing record reads, and the return type is the
 * whole of the defense there: a report that listed credentials it found would
 * turn the remedy into a second disclosure (a CI log, a terminal scrollback, a
 * screenshot). Returning classes means no caller CAN print the value, which is a
 * stronger guarantee than every caller remembering not to.
 *
 * It answers by scrubbing and discarding the result rather than matching
 * separately, so what an audit reports and what a write would have removed can
 * never disagree. The wasted string is the price of that agreement, and an audit
 * is a read a person runs, not a hot path.
 */
export function detectSecrets(text: string): readonly SecretClass[] {
  return scrubSecrets(text).replaced;
}

/**
 * One class's pass over the text, under the shape that class is recognized by.
 * Returns the input untouched when nothing matched, so a clean field costs a scan
 * and no allocation.
 *
 * A match under a prefix {@link SECOND_READING} gives a reading is
 * asked once more, and carried through untouched when the reading keeps it. That question is asked HERE and nowhere else: it is one rule,
 * so a class that becomes ambiguous tomorrow inherits it by answering the table.
 *
 * The shape's `lastIndex` is reset before the scan: these are module-level
 * regexes with the global flag, and a previous partial scan would otherwise make
 * the next call start in the middle of the text. The zero-length guard cannot
 * trigger for any pattern here (each requires literal characters) and is there so
 * a future one cannot turn into an endless loop.
 */
function scrubWith(text: string, secret: SecretClass, re: RegExp): ScrubbedText {
  const gate = ONLY_WHERE[secret];
  if (gate !== undefined && !gate.test(text)) return { text, replaced: [] };
  re.lastIndex = 0;
  let match = re.exec(text);
  if (match === null) return { text, replaced: [] };

  const kept = SECOND_READING[secret];
  const parts: string[] = [];
  const replaced: SecretClass[] = [];
  let copied = 0;
  while (match !== null) {
    if (match[0].length === 0) {
      re.lastIndex += 1;
      match = re.exec(text);
      continue;
    }
    // The second reading, and the only place it happens. Skipping the match leaves
    // `copied` where it was, so the value is carried through by the next slice:
    // byte for byte, which is what "the name the person chose" has to mean.
    if (kept?.(match[0])) {
      match = re.exec(text);
      continue;
    }
    parts.push(text.slice(copied, match.index), secretPlaceholder(secret));
    replaced.push(secret);
    copied = match.index + match[0].length;
    match = re.exec(text);
  }
  if (replaced.length === 0) return { text, replaced: [] };
  parts.push(text.slice(copied));
  return { text: parts.join(''), replaced };
}
