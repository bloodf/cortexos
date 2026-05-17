---
name: Feature request
description: Suggest improvement for CortexOS
title: "feat: "
labels: ["type:feature"]
body:

- type: textarea
    id: problem
    attributes:
      label: Problem
      description: What user or operator problem should this solve?
    validations:
      required: true
- type: textarea
    id: proposal
    attributes:
      label: Proposal
      description: Describe desired behavior.
    validations:
      required: true
- type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
- type: dropdown
    id: area
    attributes:
      label: Area
      options:
        - dashboard
        - prompts
        - agent roles
        - cortex-consumer
        - NATS pipeline
        - docs
        - templates
        - other
    validations:
      required: true
- type: textarea
    id: risks
    attributes:
      label: Risks or compatibility impact
