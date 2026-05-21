# PostgreSQL Layout

PostgreSQL stores dashboard state, audit rows, service catalog data, project
metadata, Paperclip ticket links, and optional Langfuse metadata.

Honcho is the active memory and knowledge backend for Hermes profiles. Old
memory exports may be staged for import, but they are not live database
dependencies.
