---
name: Bug report
description: Report broken behavior in CortexOS
title: "fix: "
labels: ["type:bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug. Do not include secrets, tokens, private IPs, or credentials.
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What broke?
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: Commands, prompt module, or dashboard path.
      placeholder: |
        1. Run ...
        2. Open ...
        3. See ...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Relevant logs
      description: Trim logs. Redact secrets.
      render: shell
  - type: input
    id: environment
    attributes:
      label: Environment
      placeholder: Ubuntu version, Docker version, dashboard commit
