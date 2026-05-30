# Sandbox Runner

`stacks/cortex-sandbox-runner` provides a host tool execution API for short,
bounded container runs.

The rebuild keeps it as a host tool for now. Project agents should normally run
inside Incus instances and use only the shared tools they are explicitly
granted.
