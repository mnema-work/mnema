"""Section 9: a proof of one decision, checked from the file alone.

A proof carries, for one decision, the stored lines of every checkpoint range that holds one of
its events, the checkpoint lines that sign those ranges, the tail proof of each tail it draws
from, the roster facts of every identity those lines speak for, the public keys, and a manifest
that says the decision's text, state and moves in words. Nothing in it is signed anew: every
check below is a check this reader already makes of a record (sections 1, 3, 4, 4.1, 5, 6, 6.1,
6.2, 6.7, 6.8 and 6.10), made over the lines the file carries instead of a directory.

The checks run in section 9's order and stop at the first refusal, which is said by name. The
manifest is never a source: this reader derives the same object from the lines and refuses the
file when one field differs.
"""

from __future__ import annotations

from typing import Any

from . import enrolment, retraction, schema, workflow
from .canonical import canonical_bytes, is_canonical_line, utf8_text
from .checkpoint import (
    NAMED_CHECKPOINT_SCHEME,
    NAMED_TAILPROOF_SCHEME,
    binding_break,
    read_checkpoint,
    read_tailproof,
)
from .ed25519 import verify as ed25519_verify
from .entry import Entry, entry_hash, read_line
from .keys import PublicKey, parse_pem
from .root import content_root
from .verdict import Refusal, Report

PROOF_SCHEME = "mnema-proof/1"
PROOF_KEYS = ["keys", "manifest", "scheme", "tails"]
TAIL_KEYS = ["ranges", "tail", "tailproof"]
RANGE_KEYS = ["checkpoint", "entries"]

# Section 9, "What a proof does not prove", in its order and words. Said beside every proof this
# reader accepts, because a proof that verifies is read as more than it is.
NOT_COVERED = (
    "that nothing was written after the last range it carries on each tail: a later move (a "
    "supersede, a rejection), a later writing or a revocation of a key sits after it, where this "
    "file does not reach",
    "that no tail it does not carry holds a move or a writing of this decision, or a roster fact "
    "of an identity it names: the record is the set of its tails, and this file carries some of "
    "them",
    "when anything was written: every time in it is the clock of the machine that wrote it, and "
    "no external witness (section 8) travels with it",
    "that the person behind a key is who the key is named for: it proves which key signed, and "
    "that the record enrolled that key for that identity",
)


def _refuse(what: str) -> Refusal:
    return Refusal("9", what)


def _keys_are(value: dict[str, Any], keys: list[str]) -> bool:
    return sorted(value) == keys


def _tail_fingerprint(tail_id: str) -> str:
    return tail_id.rsplit("-", 1)[0]


def _manifest_of(
    texts: dict[str, Entry], moves: list[Entry], decision: str, record: str | None
) -> dict[str, Any]:
    text = texts[decision]
    payload = text.event["payload"]
    said: list[dict[str, Any]] = []
    for move in moves:
        event = move.event
        fields = event["payload"]
        one: dict[str, Any] = {
            "action": fields["action"],
            "at": event["at"],
            "from": fields["from"],
            "seq": move.seq,
            "tail": move.tail,
            "to": fields["to"],
            "who": event["who"],
        }
        if "by" in fields:
            one["by"] = fields["by"]
        if "which" in event:
            one["which"] = event["which"]
        said.append(one)
    manifest: dict[str, Any] = {
        "adr": payload["adr"],
        "decision": decision,
        "moves": said,
        "rationale": payload["rationale"],
        "record": record,
        "state": said[-1]["to"] if said else None,
        "title": payload["title"],
    }
    if "alternatives" in payload:
        manifest["alternatives"] = payload["alternatives"]
    return manifest


def _check(raw: bytes, report: Report) -> None:
    # The bytes: the canonical serialization of what the file holds, and one line feed.
    text = utf8_text(raw)
    if not text.endswith("\n") or text.endswith("\n\n"):
        raise _refuse("a proof ends in exactly one line feed")
    body = raw[:-1]
    canonical_ok, proof = is_canonical_line(body)
    if not isinstance(proof, dict):
        raise _refuse("a proof that is not a JSON object")
    if proof.get("scheme") != PROOF_SCHEME:
        raise _refuse(f"a proof scheme this reader does not know: {proof.get('scheme')!r}")
    if not _keys_are(proof, PROOF_KEYS):
        raise _refuse(f"proof keys are {sorted(proof)}, not {PROOF_KEYS}")
    if not canonical_ok:
        raise _refuse(
            "the proof: not the canonical serialization of what it holds, so these are not the "
            "bytes the proof was taken over"
        )

    # The keys: each one's fingerprint recomputed from its material, in ascending order.
    keys = proof["keys"]
    if not isinstance(keys, list) or not keys:
        raise _refuse("keys is not a list of keys")
    ring: dict[str, PublicKey] = {}
    last_key = ""
    for pem in keys:
        if not isinstance(pem, str):
            raise _refuse("a key that is not a string")
        try:
            key = parse_pem(pem)
        except Refusal as refusal:
            raise _refuse(f"a key: {refusal.what}") from refusal
        if key.fingerprint <= last_key:
            raise _refuse("the keys are not in ascending order of their fingerprints")
        last_key = key.fingerprint
        ring[key.fingerprint] = key
    report.ok("9", f"{len(ring)} key(s), each named by the fingerprint of its own material")

    try:
        declarations = schema.load()
    except Refusal as refusal:
        raise _refuse(f"the published field declarations could not be read: {refusal.what}") from refusal

    # The tails, each with its tail proof and its ranges.
    tails = proof["tails"]
    if not isinstance(tails, list) or not tails:
        raise _refuse("tails is not a list of tails")
    entries_by_tail: dict[str, list[Entry]] = {}
    covered: dict[str, int] = {}
    named: set[str] = set()
    last_tail = ""
    for held in tails:
        if not isinstance(held, dict) or not _keys_are(held, TAIL_KEYS):
            raise _refuse(f"a tail whose keys are not {TAIL_KEYS}")
        tail, tailproof, ranges = held["tail"], held["tailproof"], held["ranges"]
        if not isinstance(tail, str) or not isinstance(tailproof, str) or not isinstance(ranges, list):
            raise _refuse("a tail whose tail, tailproof or ranges is not of its type")
        if tail <= last_tail:
            raise _refuse("the tails are not in ascending order of their ids")
        last_tail = tail
        # Section 3: the tail id begins with a key the file carries.
        fingerprint = _tail_fingerprint(tail)
        tail_key = ring.get(fingerprint)
        if tail_key is None:
            raise _refuse(f"the tail {tail} names a key the proof does not carry")
        # Section 6.1: the tail proof, by the key the tail id names.
        try:
            proof_read = read_tailproof(tailproof.encode("utf-8"))
        except Refusal as refusal:
            raise _refuse(f"the tail proof of {tail}: {refusal.what}") from refusal
        if not proof_read.file_is_canonical:
            raise _refuse(f"the tail proof of {tail}: not canonical")
        if proof_read.stored["tail"] != tail:
            raise _refuse(f"the tail proof of {tail} does not verify: tail-mismatch")
        if proof_read.stored["signerFp"] != fingerprint:
            raise _refuse(f"the tail proof of {tail} does not verify: signer-mismatch")
        if not _signature_holds(tail_key, proof_read.stored["sig"], proof_read.message):
            raise _refuse(f"the tail proof of {tail} does not verify: bad-signature")
        signed_for = proof_read.stored["scheme"] == NAMED_TAILPROOF_SCHEME
        if proof_read.record is not None:
            named.add(proof_read.record)

        if not ranges:
            raise _refuse(f"the tail {tail} carries no range")
        lines: list[Entry] = []
        last_to = -1
        for index, held_range in enumerate(ranges):
            if not isinstance(held_range, dict) or not _keys_are(held_range, RANGE_KEYS):
                raise _refuse(f"a range of {tail} whose keys are not {RANGE_KEYS}")
            line, stored_entries = held_range["checkpoint"], held_range["entries"]
            if not isinstance(line, str) or not isinstance(stored_entries, list):
                raise _refuse(f"a range of {tail} whose checkpoint or entries is not of its type")
            try:
                checkpoint = read_checkpoint(line.encode("utf-8"), index)
            except Refusal as refusal:
                raise _refuse(f"a checkpoint of {tail}: {refusal.what}") from refusal
            if not checkpoint.line_is_canonical:
                raise _refuse(f"a checkpoint of {tail}: not canonical")
            stored = checkpoint.stored
            where = f"{tail} {checkpoint.label}"
            if stored["tail"] != tail:
                raise _refuse(f"{where} signs the tail {stored['tail']}")
            if stored["signerFp"] != fingerprint:
                raise _refuse(
                    f"{where} is signed by {stored['signerFp']}, not the key its tail id names"
                )
            if checkpoint.from_seq <= last_to:
                raise _refuse(f"{where} does not begin after the range before it")
            if last_to < 0 and checkpoint.from_seq != 0:
                raise _refuse(
                    f"{tail}: the first range it carries begins at seq {checkpoint.from_seq}, and a "
                    "proof carries every tail it touches from seq 0"
                )
            if last_to >= 0 and checkpoint.from_seq != last_to + 1:
                raise _refuse(
                    f"{tail} seq {last_to + 1}..{checkpoint.from_seq - 1} is not carried, and a "
                    "proof carries every range of a tail between the first it carries and the last"
                )
            last_to = checkpoint.to_seq
            # Section 6.10: a first-scheme checkpoint where the tail had named its record.
            if stored["scheme"] == NAMED_CHECKPOINT_SCHEME:
                signed_for = True
            elif signed_for:
                raise _refuse(f"{where} is a first-scheme checkpoint after the tail named its record")
            if checkpoint.record is not None:
                named.add(checkpoint.record)
            count = checkpoint.to_seq - checkpoint.from_seq + 1
            if len(stored_entries) != count:
                raise _refuse(
                    f"{where} signs {count} line(s), and the range carries {len(stored_entries)}"
                )
            span: list[Entry] = []
            for offset, stored_line in enumerate(stored_entries):
                seq = checkpoint.from_seq + offset
                if not isinstance(stored_line, str):
                    raise _refuse(f"{where}: a line that is not a string")
                try:
                    entry = read_line(stored_line.encode("utf-8"), f"{tail} seq {seq}")
                    schema.rebuild(declarations, entry.event)
                except Refusal as refusal:
                    raise _refuse(f"{tail} seq {seq}: {refusal.what}") from refusal
                if not entry.line_is_canonical:
                    raise _refuse(f"{tail} seq {seq}: not canonical")
                if entry.tail != tail:
                    raise _refuse(f"{tail} seq {seq}: link.tail is {entry.tail}")
                if entry.seq != seq:
                    raise _refuse(f"{where}: seq {entry.seq} where {seq} was due")
                if entry_hash(entry.event_bytes, tail, seq, entry.prev) != entry.stored_hash:
                    raise _refuse(f"{tail} seq {seq}: the entry hash does not hold")
                if not lines and not span:
                    if (seq == 0) != (entry.prev is None):
                        raise _refuse(
                            f"{tail} seq {seq}: a genesis link is a null prev, and only seq 0 has one"
                        )
                elif entry.prev != (span[-1] if span else lines[-1]).stored_hash:
                    raise _refuse(f"{tail} seq {seq}: prev does not chain")
                span.append(entry)
            if content_root(entry.event_bytes for entry in span) != stored["contentRoot"]:
                raise _refuse(f"{where} does not verify: content-root-mismatch")
            if not _signature_holds(tail_key, stored["sig"], checkpoint.message):
                raise _refuse(f"{where} does not verify: bad-signature")
            # Section 6: every event of a signed range names its signer, and none authorizes itself.
            found = binding_break([entry.event for entry in span], stored["signerFp"])
            if found is not None:
                offset, half = found
                seq = span[offset].seq
                if half == "signer":
                    raise _refuse(
                        f"{tail} seq {seq} names a signer other than the checkpoint that signs its range"
                    )
                raise _refuse(f"{tail} seq {seq}: its which is its who")
            lines.extend(span)
        entries_by_tail[tail] = lines
        covered[tail] = last_to
        report.ok(
            "9",
            f"{len(ranges)} signed range(s), {len(lines)} line(s), each range's root and signature "
            f"verified under {fingerprint[:12]}...",
            tail,
        )
    if len(named) > 1:
        raise _refuse(f"the tails name {len(named)} records")

    # Section 6.2: every event carried is signed by a key valid for its anchor at its point in the
    # fold, run over the file's lines alone. Every line is in a signed range, so all are covered.
    resolution = enrolment.resolve(entries_by_tail, covered, ring)
    if resolution.issues:
        issue = resolution.issues[0]
        raise _refuse(f"{issue.tail} seq {issue.seq}: {issue.detail}")
    report.ok("9", "every line is signed by a key valid for its anchor, folded over the file's lines")

    # Sections 6.7 and 6.8: the decision as these lines read it, compared with what the file claims.
    claimed = proof["manifest"]
    if not isinstance(claimed, dict) or not isinstance(claimed.get("decision"), str):
        raise _refuse("the manifest names no decision")
    decision = claimed["decision"]
    tables = workflow.load(declarations.workflows, declarations.path)
    merged = enrolment.merged_order(entries_by_tail)
    rulings = workflow.judge(merged.order, merged.held, tables)
    not_applied = {(ruling.tail, ruling.seq) for ruling in rulings}
    texts = retraction.decision_texts(merged, not_applied)
    if decision not in texts:
        raise _refuse(f"the proof carries no writing of the decision {decision}")
    moves = [
        entry
        for tail, entry in merged.order
        if entry.event.get("kind") == "decision.transitioned"
        and entry.event.get("subject") == decision
        and (tail, entry.seq) not in not_applied
    ]
    derived = _manifest_of(texts, moves, decision, next(iter(named)) if named else None)
    for field in sorted(set(derived) | set(claimed)):
        said = canonical_bytes(claimed[field]) if field in claimed else None
        read = canonical_bytes(derived[field]) if field in derived else None
        if said != read:
            raise _refuse(f"the manifest's {field} is not what the signed lines say")
    report.ok(
        "9",
        f"the manifest is what the signed lines say: {decision} is {derived['state']}, "
        f"{len(moves)} move(s), titled {derived['title']!r}",
    )
    for tail, entries in entries_by_tail.items():
        report.note("9", f"carries seq {', '.join(str(e.seq) for e in entries)}", tail)
    for what in NOT_COVERED:
        report.declare_not_covered("9", what, "a proof of one decision does not reach it")


def _signature_holds(key: PublicKey, signature: Any, message: bytes) -> bool:
    if not isinstance(signature, str):
        return False
    try:
        raw_signature = bytes.fromhex(signature)
    except ValueError:
        return False
    return ed25519_verify(key.raw, raw_signature, message)


def verify_proof(path: str, report: Report) -> None:
    """Check the proof of one decision at `path`, saying the first refusal by name."""
    try:
        with open(path, "rb") as handle:
            raw = handle.read()
    except OSError as exc:
        report.fail("9", f"the proof could not be read: {exc}", path)
        return
    try:
        _check(raw, report)
    except Refusal as refusal:
        report.fail(refusal.section if refusal.section == "9" else "9", refusal.what, path)
