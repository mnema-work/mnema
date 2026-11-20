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
 * nine notes are asserted untouched in the tests, and so are fifty-five ordinary texts an
 * adversarial review wrote against the first cut, thirteen of which that cut replaced. Over
 * this repository's own record (3,223 events, 32,737 fields) the two classes replace nothing,
 * over the machine's private one (11,235 events) one value, in a review note that quotes a
 * password example, and over the documentation two, both example passwords.
 *
 * A FALSE REPLACEMENT COSTS LESS THAN A LEAK, BUT NOT NOTHING. A secret that reaches the record
 * is permanent and, in a public tree, published; so where a value's end is in doubt the whole of
 * it goes, and a value under a credential's name goes unless it reads as one of the things that
 * stand there without being one. In a body a false replacement costs a word; in a NAME it refuses
 * the write (see `screen.ts`), which is why the readings that keep a value are measured against
 * ordinary text and asserted by name rather than tuned.
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
 * The end of a name a credential is kept under, in any case (the shapes that use it are
 * case-insensitive): `PASSWORD`, `db_password`, `apiKey`, `X-Api-Key`, `client_secret`,
 * `GITHUB_TOKEN`. Only the END is matched, so any prefix is accepted, and a name that goes
 * on past the word (`tokenizer`, `secrets`, `max_tokens`, `token_count`) is not one.
 *
 * THREE WORDS NEED MORE THAN THEIR SPELLING. `token` also names a pagination cursor (`next_token`,
 * `NextToken`, `page_token`, `continuationToken`), an opaque value that is not a credential and
 * that an agent pastes when it debugs an API, so a cursor's prefix turns the name away, and so
 * does a form's anti-forgery token (`csrf_token`), which is bound to one session and opens
 * nothing after it, and a limit's (`max_token=8192`, `minToken`), which counts tokens. `auth` ends `oauth`, a protocol's name, and `pass` ends `bypass` and
 * `compass`, so each counts only as a word of its own (`DB_PASS`, `pass:`), which leaves out the
 * camelCase spelling (`smtpPass`): the shapes are read in any case, so `bypass` and `dbPass` look
 * the same to them. `basicAuth` is the one camelCase name spelled out.
 */
const CREDENTIAL_NAME =
  '(?:pass(?:word|wd|phrase)|pwd|secret|api[_-]?key|access[_-]?key|private[_-]?key|' +
  'secret[_-]?key|(?<!(?:next|page|continuation|pagination|sync|cursor|resume|csrf|xsrf|max|min)[_-]?)token|' +
  'basic[_-]?auth|(?<![a-z])(?:auth|pass))';

/**
 * The same names written the way an environment writes one, in capitals (`DB_PASSWORD`,
 * `SMTP_PASS`, `GITHUB_TOKEN`), for the one form whose reading turns on the case: see
 * `named-credential`. The list above has no escape with a letter in it, so its capitals are its
 * own words in capitals.
 */
const ENVIRONMENT_NAME = CREDENTIAL_NAME.toUpperCase();

/**
 * A run of letters alone, with the mark a sentence closes it with: what prose writes after a
 * colon or a flag as readily as a key's value, so the forms that read a value there refuse it.
 */
const A_WORD = '[A-Za-z]+[.,;:!?]?';

/** What may follow a value alone on its line: blanks, and a comment opened by `#` after a blank. */
const LINE_END = String.raw`(?:[ \t]+#[^\n]*)?[ \t\r]*$`;

/**
 * Where a credential's name stands as a KEY: bare before its `:` or `=` (`PASSWORD=`,
 * `--token=`, `{ apiKey:`, `#access_token=`), or in quotes of its own, whole
 * (`"db_password":`). A quoted key has to be a name from quote to quote, which is what turns
 * away a sentence held in quotes (`'a password' : ...`) and a package's path
 * (`"@octokit/auth-token":`), both found taking a value in this repository's own code
 * before this was written.
 */
function keyed(name: string): string {
  return String.raw`(?:["'\x60]${NAME_HEAD}${name}["'\x60]|${name})`;
}

/**
 * What a quoted value is made of, per quote, to its own closing quote: a doubled quote inside
 * it (`'it''s'`, the way SQL and YAML escape one) and a quote after a backslash (`"ab\"cd"`) are
 * part of the value, and so are its blanks. A fragment left past the first quote is a leak with a
 * placeholder beside it, which tells the reader the value went while part of it stayed.
 */
const QUOTED_VALUE = {
  '"': String.raw`(?:[^"\\\n]|\\.|"")+`,
  "'": String.raw`(?:[^'\n]|'')+`,
  '\x60': String.raw`[^\x60\n]+`,
} as const;

/**
 * A value in quotes after `context`, to its closing quote, or to the end of the line when none
 * closes it (a paste cut short keeps its secret all the same). It does not open on a blank or on
 * punctuation: a quote followed by one closes something else, as in `PASSWORD=` written in
 * backticks and followed by ` or a JSON field`. The context is read once, with any of the three
 * quotes, and the quote that opened is read back by a lookbehind of one character: a capture
 * group referred back to would do it in fewer characters, and no shape here has one (see the
 * module comment). Read once rather than once per quote, because a lookbehind is tried at every
 * position of the text and the three were a third of a scrub's worst case.
 */
function quotedAfter(context: string): string {
  const values = [
    String.raw`(?<=")${QUOTED_VALUE['"']}(?="|$)`,
    String.raw`(?<=')${QUOTED_VALUE["'"]}(?='|$)`,
    String.raw`(?<=\x60)${QUOTED_VALUE['\x60']}(?=\x60|$)`,
  ];
  return String.raw`(?<=${context}["'\x60])(?![ \t,;.)])(?:${values.join('|')})`;
}

/**
 * A value not in quotes, to the first blank or the end of the line, punctuation and all
 * (`abc;def123`, `p@ss,word99`), with three exceptions read from what follows. It stops before the
 * next pair of a query or a connection string (`&page=2`, `;Server=db`), where the separator
 * ends the value by the syntax that wrote it; it leaves the closing quotes and brackets it
 * ends on (`(PASSWORD=hunter2)`), so the text around it still reads; and it leaves a comma or a
 * semicolon it ends on (`password=hunter2, user=me`), which closes the value the way a list or a
 * statement does and is no part of it. A backslash before the end of a line continues the value
 * on the next one, as a shell reads it.
 */
const UNQUOTED_VALUE = String.raw`(?:[^\s\\]|\\[^\n]|\\\r?\n)+?(?=[;,]?[)\]}>"'\x60]*(?:\s|$)|[;&,][\w.-]{1,64}=)`;

/** A credential's name opening its line as a key, up to its separator. */
const LINE_KEY = String.raw`^[ \t]{0,64}(?:- |export )?["'\x60]?${NAME_HEAD}${CREDENTIAL_NAME}["'\x60]?${GAP}`;

/**
 * A value alone on its line after a credential's name opening that line (`.env`, INI, YAML,
 * a header), with a comment allowed after it, and a comma or a semicolon that closes it left
 * out of it. A single word after the colon is taken here and read by
 * {@link readsAsNoCredential}, which knows the name it stands under.
 */
function onItsLine(separator: ':' | '='): string {
  return (
    String.raw`(?<=${LINE_KEY}${separator}${GAP}(?:${SCHEME})?)` +
    String.raw`(?!${SCHEME_WORD}|["'\x60])[^\s]+?(?=[;,]?${LINE_END})`
  );
}

/**
 * A flag named as a credential, and the blank after it: `--password S3cret`, `--api-key ...`.
 * The flag opens the text or follows a blank or a quote, so a name inside a word is not one.
 */
const FLAG = String.raw`(?:^|[\s"'\x60])--${NAME_HEAD}${CREDENTIAL_NAME}[ \t]{1,8}`;

/**
 * The three commands that take a password in a flag of a single letter, in the form each one
 * reads: `curl -u user:password` (and `--user`), `docker login -p password`, and `mysql -ppassword`
 * with no blank, since `mysql -p` followed by a blank asks for it at the prompt. The command has
 * to stand on the same line before the flag, because `-u` and `-p` are a user, a port or a
 * parent directory everywhere else (`docker run -u 1000:1000 -p 8080:80`, `mkdir -p`).
 */
const CURL_USER = String.raw`\bcurl\b[^\n]{0,256}[ \t](?:-u[ \t]*|--user(?:[ \t]+|=))`;
const DOCKER_LOGIN_P = String.raw`\bdocker[ \t]+login\b[^\n]{0,256}[ \t]-p[ \t]+`;
const MYSQL_P = String.raw`\bmysql(?:dump|admin|import|show|check|slap)?\b[^\n]{0,256}[ \t]-p`;

/**
 * A shape looked for only in a text that holds `where`, for the reason {@link ONLY_WHERE} gives,
 * where one class is read by more than one shape and each has a literal of its own to wait for.
 */
interface GatedShape {
  readonly where: RegExp;
  readonly shape: RegExp;
  /**
   * The second reading of this shape's matches, where it is not its class's: see
   * {@link SECOND_READING}, which it stands in for.
   */
  readonly keeps?: SecondReading;
  /**
   * Whether the shape reads a body only. A name is read by every other shape and not by this
   * one: see {@link detectSecretsInAName}.
   */
  readonly inABodyOnly?: true;
}

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
const SHAPES: { readonly [K in SecretClass]: RegExp | readonly GatedShape[] } = {
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
  // value ends there too, and then a single word is not one (`Authorization: maintainer` is a
  // line of prose about who authorized). And the value ends at a blank, a quote or
  // punctuation, never in the middle of a word.
  'authorization-header': new RegExp(
    [
      String.raw`(?<=\bauthorization["']?${GAP}[:=]${GAP}["']?${SCHEME})${HEADER_VALUE}`,
      String.raw`(?<=(?:^[ \t]{0,64}|["'{][ \t]{0,8})(?:proxy-)?authorization["']?${GAP}[:=]${GAP}["']?)` +
        String.raw`(?!${SCHEME_WORD}|${A_WORD}[ \t\r]*(?:$|["',}]))${HEADER_VALUE}(?=[ \t\r]*(?:$|["',}]))`,
    ].join('|'),
    'gim',
  ),
  // A value written after a credential's NAME, in the ways text writes one down: quoted after
  // `:` or `=` (JSON, YAML, TOML, code), unquoted right after `=` (`.env`, a query string, a
  // flag), alone on its line after `:` or `=` (YAML, INI, a header line), after a flag named as a
  // credential, after the single-letter flags of three commands, and after a colon in a sentence
  // when the first word reads as a secret. The line forms are bound to the line on purpose: in
  // prose a colon is followed by a sentence, and `Secret: the key lives in the vault` has to come
  // out as written; for the same reason a single word after a flag, a short word in small letters
  // after a colon, or a word followed by more words after `=`, reads as prose.
  //
  // FOUR SHAPES, ONE CLASS, because one form turns on the case, one has a reading of its own, and
  // the rest are read in any case with the class's reading.
  // On a line of its own, a name in capitals (`DB_PASSWORD=pa ss word`) is an environment file's,
  // whose value runs to the end of the line, blanks and all; the same line under a name in small
  // letters is as often a sentence (`secret=sauce in the recipe`). And the three commands are
  // written in small letters, with flags whose case is their meaning (`mysql -P` is a port).
  'named-credential': [
    {
      where: /(?:PASS|PWD|SECRET|KEY|TOKEN|AUTH)[A-Z_]{0,16}[ \t]{0,8}=/,
      shape: new RegExp(
        String.raw`(?<=^[ \t]{0,64}(?:export[ \t]+)?[A-Z0-9_]{0,64}${ENVIRONMENT_NAME}${GAP}=${GAP})` +
          String.raw`(?!["'\x60#])[^\s]+(?:(?:[ \t]+(?!#)|(?<=\\)\r?\n)[^\s]+)*(?<![;,])`,
        'gm',
      ),
    },
    {
      where: /curl|docker|mysql/,
      shape: new RegExp(
        [
          String.raw`(?<=${CURL_USER}[^\s:"'\x60]{0,64}:)(?!["'\x60])${UNQUOTED_VALUE}`,
          String.raw`(?<=${CURL_USER}"[^\n:"]{0,64}:)[^"\n]+(?=")`,
          String.raw`(?<=${CURL_USER}'[^\n:']{0,64}:)[^'\n]+(?=')`,
          quotedAfter(DOCKER_LOGIN_P),
          String.raw`(?<=${DOCKER_LOGIN_P})(?!["'\x60-]|${A_WORD}(?:\s|$))${UNQUOTED_VALUE}`,
          quotedAfter(MYSQL_P),
          String.raw`(?<=${MYSQL_P})(?![\s"'\x60])${UNQUOTED_VALUE}`,
        ].join('|'),
        'g',
      ),
    },
    {
      where:
        /(?:pass(?:word|wd|phrase)?|pwd|secret|key|token|auth)["'\x60]?[ \t]{0,8}[:=]|--[\w.-]*(?:pass|pwd|secret|key|token|auth)/i,
      shape: new RegExp(
        [
          quotedAfter(`${keyed(CREDENTIAL_NAME)}${GAP}[:=]${GAP}`),
          String.raw`(?<=${keyed(CREDENTIAL_NAME)}=)(?!["'\x60]|[A-Za-z]+[ \t]+[A-Za-z])${UNQUOTED_VALUE}`,
          onItsLine('='),
          onItsLine(':'),
          quotedAfter(FLAG),
          String.raw`(?<=${FLAG})(?!["'\x60-]|${A_WORD}(?:\s|$))${UNQUOTED_VALUE}`,
        ].join('|'),
        'gim',
      ),
    },
    // After a colon anywhere in a line, the first word only, and only when it reads as a secret:
    // `token: abc123XYZ987 for the staging box`, `{password: S3cretPass, user: me}`. Here a
    // sentence goes on after the colon as readily as a value does, so the shape takes what any
    // value would and the reading keeps what does not look drawn at random.
    {
      where: /(?:pass(?:word|wd|phrase)?|pwd|secret|key|token|auth)["'\x60]?[ \t]{0,8}:/i,
      shape: new RegExp(
        String.raw`(?<=${keyed(CREDENTIAL_NAME)}${GAP}:${GAP})(?<!<SECRET:)(?![\s"'\x60])${UNQUOTED_VALUE}`,
        'gi',
      ),
      keeps: readsAsNoSecretInASentence,
      inABodyOnly: true,
    },
  ],
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
};

/** A second reading: true when the match at `at` in `text` is carried through untouched. */
type SecondReading = (match: string, text: string, at: number) => boolean;

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
 * A reading is handed the whole text and where the match starts, for the one that needs what
 * stands before the value: under a token's name a slug of words is a name, under a password's
 * it is a passphrase.
 *
 * IT IS NOT EXPORTED AT ALL, and neither is the rule it gates. Nothing outside asks
 * which prefixes are ambiguous, and a consumer able to import either could keep a
 * second opinion about what counts as a name. The module boundary is what makes that
 * impossible rather than merely discouraged: there is no declaration here for a
 * surface sweep to check, because there is nothing exported for it to find.
 */
const SECOND_READING: { readonly [K in SecretClass]: SecondReading | undefined } = {
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
  'authorization-header': readsAsNoHeader,
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
 * `;` or `,` a declaration ends on, a permission (`id-token: write`, in every GitHub
 * workflow that signs), and the word a value is while it is not one yet or lives elsewhere
 * (`env`, `oidc`, `pending`, `unset`, `redacted`, `inherit`, `example`, `todo`).
 *
 * `changeme` is in the list on purpose, and it is the one that is ever a password in use: it is
 * the default a template ships, so it is the first guess anyone makes, and writing it down
 * discloses nothing a guess does not. Recording `PASSWORD=changeme` as written keeps the line
 * readable; replacing it would protect no one.
 */
const NOT_A_VALUE =
  /^(?:true|false|null|nil|none|undefined|yes|no|on|off|string|str|number|int|integer|bool|boolean|bytes|any|unknown|object|optional|required|read|write|bearer|basic|digest|negotiate|env|oidc|pending|unset|empty|redacted|masked|hidden|inherit|changeme|change-me|placeholder|example|dummy|tbd|todo)[;,]?$/i;

/** A name in code, followed by members (`.token`) or by keys (`[NAME]`). */
const IDENTIFIER_PATH = String.raw`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[A-Za-z_$][\w$]*\])*`;

/**
 * A value already masked by whoever wrote it (`***`, `xxxx`, `...`), or with no letter or
 * digit at all, which is a line of code opening a bracket (`SECRET = (`) and no key.
 */
const ALREADY_MASKED = /^(?:[^A-Za-z0-9]|[xX])+$/;

/**
 * A line of code where the name's value is read from somewhere else: `token: request.token,`,
 * `secret: VECTOR_SECRET,`, `token: accessToken,`, `token = config[NAME]`. Measured over this
 * repository's own source, where the line form took these before this reading kept them.
 *
 * A PATH OF NAMES IS ALSO A TOKEN, which is why a bare one is not enough: Google's access
 * tokens are written `ya29.` and a long run of letters, a path to the letter. So a path is
 * code only where code closes it (a `;` or `,` right after it) or where it starts from a root
 * code reads a setting from (the process's environment, `config.`, `request.`, ...).
 *
 * AND A COMMA DOES NOT MAKE A WORD CODE. `password=hunter2, user=me` and `{password: S3cretPass,
 * user: me}` close their value with a comma as a line of code does, and the value is the
 * password. So a single name closed by code is kept only when it reads as the name of a
 * credential ({@link readsAsANameInCode}), and a number never is: a PIN is a password.
 */
const A_ROOTED_PATH = new RegExp(
  String.raw`^(?:process\.env|os\.environ|env|this|self|config|settings|request|req|options|opts|args|params|props)` +
    String.raw`(?:\.[A-Za-z_$][\w$]*|\[[A-Za-z_$][\w$]*\])+$`,
);

/** A name followed by members (`.token`) or keys (`[NAME]`), or a name alone. */
const A_PATH_OF_NAMES = new RegExp(`^${IDENTIFIER_PATH}$`);

/** Whether `value`, at `at` in `text`, is a line of code naming where the value is. */
function readsAsCode(value: string, text: string, at: number): boolean {
  if (A_ROOTED_PATH.test(value)) return true;
  const after = text.charAt(at + value.length);
  if (after !== ';' && after !== ',') return false;
  if (/[.[]/.test(value)) return A_PATH_OF_NAMES.test(value);
  return readsAsANameInCode(value);
}

/** A constant's name in capitals, and a credential's word as one of its pieces. */
const A_CONSTANT = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const A_CONSTANT_WORD = /(?:^|_)(?:TOKEN|KEY|SECRET|PASS(?:WORD|WD)?|PWD|AUTH|CREDENTIALS?)(?:_|$)/;

/**
 * A variable's name, and a credential's word as one of its pieces: opening it or after a `_`
 * (`password`, `db_password`), or after a small letter with its capital (`accessToken`).
 */
const A_VARIABLE = /^[a-z][A-Za-z_]*$/;
const A_VARIABLE_WORD =
  /(?:^|_)(?:token|key|secret|pass(?:word|wd)?|pwd|auth|credentials?)(?![a-z])|[a-z](?:Token|Key|Secret|Pass(?:word|wd)?|Pwd|Auth|Credentials?)(?![a-z])/;

/**
 * Whether `value` is the name code gives a credential, not the credential: a constant in
 * capitals (`VECTOR_SECRET`) or a variable (`accessToken`, `hashedPassword`) whose pieces
 * include a credential's word where a piece begins. `supersecret` holds the word inside a
 * piece, and `S3cretPass` opens on a capital and carries a digit: neither is one.
 */
function readsAsANameInCode(value: string): boolean {
  return (
    (A_CONSTANT.test(value) && A_CONSTANT_WORD.test(value)) ||
    (A_VARIABLE.test(value) && A_VARIABLE_WORD.test(value))
  );
}

/** A version, which is what a package whose name ends in `token` or `auth` is given. */
const A_VERSION = /^[~^]?v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/;

/**
 * A number of three digits or fewer: a count, an index, a pass of a review (`Pass: 3`). No
 * credential is that short, and one that were would fall to a thousand guesses.
 */
const A_COUNT = /^\d{1,3}[.,;]?$/;

/**
 * An issuer's prefix named on its own (`ghp_`, `xoxb-`, `glpat-`): a few letters and digits that
 * end on the `_` or `-` a token goes on after. A page that lists the formats names them after
 * `token:` in a sentence, and the token itself would carry its body.
 */
const A_PREFIX = /^[A-Za-z0-9]{1,10}[_-]$/;

/**
 * The same prefix with its body elided (`agm_…`, `ghp_...`): a page that shows the SHAPE of a
 * token (`"token":"agm_…"` in a protocol's example) writes the issuer's prefix and a mark for the
 * rest. The elision carries nothing, so the value is the prefix alone, which {@link A_PREFIX}
 * keeps too; a body after the mark (`agm_…x9`) is not this shape and is replaced.
 */
const A_PREFIX_ELIDED = /^[A-Za-z0-9]{1,10}[_-](?:\u2026|\.{3})$/;

/**
 * A name standing before a reference to the value (`anthropic=<key>`, `admin:$PASSWORD`), the way
 * a tool that takes several providers' keys in one flag is shown being called.
 */
const A_NAMED_REFERENCE = /^[\w.-]{1,64}[=:][<$%{]/;

/**
 * A path on a disk (`/home/me`, `~/.config/app`, `./build`), the value `pwd` names more often
 * than a password. Each piece is a name, in small letters after an optional capital: a base64
 * secret that happens to open on `/` carries capitals inside its pieces, and is not read as one.
 * The capital is `[A-Z]`, never `[A-Za-z]`: a small letter that either part could take splits a
 * piece two ways, and thirty pieces that do not match end in a search of two to the thirtieth.
 */
const A_PATH = /^(?:~|\.{1,2})?(?:\/[A-Z]?[a-z0-9._@-]*)+[.,;]?$/;

/**
 * An address with no credential in it: no user and password, no query, and a path read the way
 * {@link A_PATH} reads one, so a webhook whose secret is its path is not mistaken for one.
 */
const A_PLAIN_URL = /^[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Z]?[a-z0-9._~%-]*)*$/;

/** A token's, a key's, a secret's or an auth's name just before the value, with its separator. */
const AFTER_A_TOKEN_NAME = /(?:secret|key|token|auth)["'\x60]?[ \t]{0,8}[:=]?[ \t]{0,8}["'\x60]?$/i;

/**
 * Words joined by `-` or `_`, the first of them with an optional capital: the name of something
 * (`Mnema-agent-key`, `deploy-bot-key`), not its secret.
 */
const A_SLUG = /^[A-Za-z][a-z]*(?:[-_][a-z]+)+$/;

/** Four words or more, of letters and the marks a sentence carries: a description, not a key. */
const A_SENTENCE = /^[A-Za-z’'-]+[.,;:!?]?(?:[ \t]+[A-Za-z’'()-]+[.,;:!?)]?){3,}$/;

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
 *
 * WHAT STANDS BEFORE THE VALUE DECIDES TWO OF THE READINGS. Under a token's, a key's or a
 * secret's name, a slug of words (`token: Mnema-agent-key`) is the name of the thing and a
 * sentence of four words or more (a message kept under `HOLDS_A_SECRET`) is its description; a
 * real token has neither shape, and neither has a short run of hex digits, an id's head. Under a
 * password's name all three are kept as the secret, because a passphrase is exactly words
 * (`correct horse battery staple`). And a single word alone after a colon on a key's line is
 * prose under any other name when it is short and in small letters (`token: none`), and a
 * password under a password's (`password: letmein`).
 */
function readsAsNoCredential(value: string, text: string, at: number): boolean {
  if (
    readsAsNoHeaderValue(value) ||
    readsAsCode(value, text, at) ||
    A_VERSION.test(value) ||
    A_COUNT.test(value) ||
    A_PATH.test(value) ||
    A_PLAIN_URL.test(value) ||
    A_PREFIX.test(value) ||
    (A_PREFIX_ELIDED.test(value) && !underAPassword(text, at)) ||
    A_NAMED_REFERENCE.test(value)
  ) {
    return true;
  }
  const before = text.slice(Math.max(0, at - LINE_KEY_SPAN), at);
  if (A_SINGLE_WORD.test(value)) {
    const line = before.slice(before.lastIndexOf('\n') + 1);
    if ((line.length < before.length || at <= LINE_KEY_SPAN) && A_KEY_AND_COLON.test(line)) {
      return !UNDER_A_PASSWORD.test(line) && A_WORD_OF_PROSE.test(value);
    }
  }
  return (
    AFTER_A_TOKEN_NAME.test(before.slice(-40)) &&
    (A_SLUG.test(value) || A_SENTENCE.test(value) || AN_ID.test(value))
  );
}

/**
 * The longest a key opening its line can be before its value ({@link LINE_KEY} counted, with
 * room to spare), which bounds how far back a reading looks for the start of the line.
 */
const LINE_KEY_SPAN = 256;

/** A line that is a credential's name and a colon, so far: the value is alone after them. */
const A_KEY_AND_COLON = new RegExp(`${LINE_KEY}:${GAP}$`, 'i');

/** A password's name and its colon, just before the value. */
const UNDER_A_PASSWORD =
  /(?:pass(?:word|wd|phrase)|(?<![a-z])pass|pwd)["'\x60]?[ \t]{0,8}:[ \t]{0,8}$/i;

/**
 * Whether the value at `at` stands under a password's name, with a colon or an `=` and an optional
 * quote between: a password is any string, so `hunter2_...` there is a password and not a token's
 * shape.
 */
function underAPassword(text: string, at: number): boolean {
  return /(?:pass(?:word|wd|phrase)|(?<![a-z])pass|pwd)["'\x60]?[ \t]{0,8}[:=][ \t]{0,8}["'\x60]?$/i.test(
    text.slice(Math.max(0, at - 48), at),
  );
}

/** A single word of letters, with the mark a sentence may close it with. */
const A_SINGLE_WORD = /^[A-Za-z]+[.,;:!?]?$/;

/**
 * A single word that prose writes after a colon as readily as a value: short, in small letters
 * after an optional capital (`token: none`, `auth: oauth`, `api_key: environment`). A word in
 * mixed case or a long one (`api_key: AbCdEfGhIjKlMnOpQrSt`) is a key's shape, and under a
 * password's name every word is a password's (`password: letmein`), so neither is kept.
 */
const A_WORD_OF_PROSE = /^[A-Z]?[a-z]{1,15}[.,;:!?]?$/;

/**
 * A short run of hex digits, from 7 to 10: an abbreviated commit or the head of an id
 * (`token: 01a1f59d`), which no issuer mints as a token. A longer run is replaced as the secret
 * it can be: 32 hex digits is a Datadog or a Mailgun key, 40 an old GitHub OAuth token, and a
 * UUID is a Heroku API key, so neither a long run nor a UUID is read as an id.
 */
const AN_ID = /^[0-9a-f]{7,10}$/;

/**
 * Whether a value after a colon in a sentence is no secret: what {@link readsAsNoCredential}
 * keeps, and every word that does not read as one ({@link readsAsASecret}).
 */
function readsAsNoSecretInASentence(value: string, text: string, at: number): boolean {
  return readsAsNoCredential(value, text, at) || !readsAsASecret(value);
}

/** The marks a password carries and prose does not put inside a word. */
const A_SYMBOL = /[!#$%&*+=?@^|~]/;

/**
 * Whether a word reads as drawn at random rather than written: letters and digits together at
 * eight characters or more, or with a capital inside or a symbol at six (`Xk9qLm2Pz7`,
 * `abc123XYZ987`, `S3cret!`); letters alone in mixed case with three humps or more
 * (`AbCdEfGhIjKl`) or with a symbol (`pa$$word`); and any word of 24 characters or more. What it
 * lets through, by measure of the sentences it has to keep: a word in small letters
 * (`twelve`), a name in code (`secretKey`, `GH_TOKEN`), and a short word with a digit or two
 * (`Hunter2`, `OAuth2`, `Ed25519`, `sha256`), which an algorithm's or a version's name is.
 */
function readsAsASecret(value: string): boolean {
  const word = value.replace(/[.,;:)\]}]+$/, '');
  if (word.length < 6 || readsAsANameInCode(word)) return false;
  if (word.length >= 24) return true;
  const letter = /[A-Za-z]/.test(word);
  if (/\d/.test(word)) {
    return letter && (word.length >= 8 || /[a-z0-9][A-Z]/.test(word) || A_SYMBOL.test(word));
  }
  const bare = word.replace(/[!?]+$/, '');
  return (bare.match(/[a-z][A-Z]/g)?.length ?? 0) >= 3 || (letter && A_SYMBOL.test(bare));
}

/**
 * The same reading for a header, without the two that read code and versions: after
 * `Authorization:` neither is ever written, and a token can look like either (`ya29.` and a
 * run of letters is a path of names, and a short opaque token can be all digits and dots).
 */
function readsAsNoHeaderValue(value: string): boolean {
  return A_REFERENCE.test(value) || NOT_A_VALUE.test(value) || ALREADY_MASKED.test(value);
}

/**
 * The reading of a header's value: what {@link readsAsNoHeaderValue} keeps, and a short word in
 * small letters, which is a sentence about the header (`Authorization: Bearer tokens only, no
 * Basic`) and no issuer's token. Read here and not in the shape, which runs in any case: a
 * capital, a digit or a token character in it, or a longer run, and it is taken.
 */
function readsAsNoHeader(value: string): boolean {
  return readsAsNoHeaderValue(value) || /^[a-z]{1,16}$/.test(value);
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
  return scrub(text, false);
}

/**
 * The classes of credential a NAME holds, read as {@link detectSecrets} reads a body, less the
 * one shape that guesses: the first word after a credential's name and a colon, taken when it
 * looks drawn at random (`token: abc123XYZ987 for the staging box`).
 *
 * In a body that guess costs a word, replaced, and the sentence survives it. In a name it costs
 * the whole write, because a name is refused rather than replaced, and a title says what it is
 * about in exactly that shape: `Password: Argon2id over bcrypt`, `Token: Base64Url encoding`,
 * `Secret: SHA3-256 checksum`. So a name is read by the prefixes and the classes of their own
 * shape, and by a value after `=` or alone after the colon on its line, and not by the guess:
 * `Token: abc123XYZ987 for staging` is taken as a name and replaced in a body.
 */
export function detectSecretsInAName(text: string): readonly SecretClass[] {
  return scrub(text, true).replaced;
}

/** One scrub of `text`, by every shape, or by every shape that also reads a name. */
function scrub(text: string, inAName: boolean): ScrubbedText {
  let out = text;
  let replaced: SecretClass[] | undefined;
  for (const secret of SECRET_CLASSES) {
    const shapes = SHAPES[secret];
    const read: readonly (Omit<GatedShape, 'where'> & { where?: RegExp })[] =
      shapes instanceof RegExp ? [{ shape: shapes }] : shapes;
    for (const { where, shape, keeps, inABodyOnly } of read) {
      if (inAName && inABodyOnly) continue;
      if (where !== undefined && !where.test(out)) continue;
      const pass = scrubWith(out, secret, shape, keeps ?? SECOND_READING[secret]);
      if (pass.replaced.length === 0) continue;
      out = pass.text;
      replaced = replaced === undefined ? [...pass.replaced] : [...replaced, ...pass.replaced];
    }
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
 * A match under a prefix {@link SECOND_READING} gives a reading (or its shape's own, where the
 * shape names one) is asked once more, and carried through untouched when the reading keeps it.
 * That question is asked HERE and nowhere else: it is one rule, so a class that becomes
 * ambiguous tomorrow inherits it by answering the table.
 *
 * The shape's `lastIndex` is reset before the scan: these are module-level
 * regexes with the global flag, and a previous partial scan would otherwise make
 * the next call start in the middle of the text. The zero-length guard cannot
 * trigger for any pattern here (each requires literal characters) and is there so
 * a future one cannot turn into an endless loop.
 */
function scrubWith(
  text: string,
  secret: SecretClass,
  re: RegExp,
  kept: SecondReading | undefined,
): ScrubbedText {
  const gate = ONLY_WHERE[secret];
  if (gate !== undefined && !gate.test(text)) return { text, replaced: [] };
  re.lastIndex = 0;
  let match = re.exec(text);
  if (match === null) return { text, replaced: [] };

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
    // byte for byte, which is what "the name the person chose" has to mean. The scan
    // goes on from the next character rather than past the kept match, so a value kept
    // as a whole (a sentence, a reference) does not hide a credential written inside it.
    if (kept?.(match[0], text, match.index)) {
      re.lastIndex = match.index + 1;
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
