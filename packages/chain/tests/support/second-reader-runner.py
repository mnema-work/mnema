#!/usr/bin/env python3
"""Answers many readings of the second reader from ONE python3 process.

A test seam, kept beside the tests and not shipped. It reads one request per line on stdin,
`{"argv": [<script>, <arguments>...]}`, runs the entry the command line would run for that
script (`mnema_verify.main` or `mutate.main`, the same functions `python3 <script> ...` ends
in), and writes one JSON line back: `{"status", "stdout", "stderr"}`. The verifier's code is
imported, not changed, and nothing is reset between requests: the verifier keeps no state
between readings (its module-level names are constants and compiled patterns), which
`second-reader-session.test.ts` checks by asking for every reading both ways.
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys
import traceback

verifier = os.path.abspath(sys.argv[1])
sys.path.insert(0, verifier)

import mnema_verify  # noqa: E402
import mutate  # noqa: E402

ENTRIES = {
    os.path.join(verifier, "mnema_verify.py"): mnema_verify.main,
    os.path.join(verifier, "mutate.py"): mutate.main,
}


def answer(argv: list[str]) -> dict[str, object]:
    out, err = io.StringIO(), io.StringIO()
    status = 0
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            status = ENTRIES[argv[0]](argv[1:])
        except SystemExit as stop:
            # What the interpreter does with an exit that carries something other than a number.
            if stop.code is None:
                status = 0
            elif isinstance(stop.code, int):
                status = stop.code
            else:
                err.write(f"{stop.code}\n")
                status = 1
        except BaseException:  # noqa: BLE001 - the interpreter reports and exits 1
            err.write(traceback.format_exc())
            status = 1
    return {"status": status, "stdout": out.getvalue(), "stderr": err.getvalue()}


for line in sys.stdin:
    request = json.loads(line)
    sys.__stdout__.write(json.dumps(answer(request["argv"])) + "\n")
    sys.__stdout__.flush()
