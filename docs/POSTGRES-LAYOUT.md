# PostgreSQL Layout

The host PostgreSQL service remains on the main machine.

Each project gets its own database role and database or schema grant. Project
instances connect over the host/project network using credentials declared in
the secrets manifest and provisioned outside git.
