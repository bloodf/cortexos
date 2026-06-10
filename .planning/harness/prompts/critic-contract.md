## Verdict contract (mandatory)

Output EXACTLY this structure, in this order, with no preamble:

1. One line: `VERDICT: PASS` or `VERDICT: REJECT`
2. `FINDINGS:` followed by one line per finding, each starting with
   `[BLOCKER]`, `[MAJOR]`, or `[MINOR]`, then the finding with file:line or
   quoted evidence. Write `none` if you found nothing.
3. `COUNTERARGUMENT:` the strongest case against your own verdict, 2-4 lines.

Severity rules: one BLOCKER or two MAJOR findings force REJECT.
[BLOCKER] = will produce wrong code, data loss, or an unverifiable plan.
[MAJOR] = likely defect, missing acceptance criterion, untraceable requirement.
[MINOR] = style, clarity, redundancy.

Evidence rules: cite the document section or diff hunk for every finding.
If you claim something is ABSENT, quote the exact search you would run to
prove it (e.g. `grep -n "pattern" file`). Findings without evidence are
guesses; do not report them.
