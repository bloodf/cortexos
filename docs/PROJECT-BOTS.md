# Project Automation Identity

Agents should use dedicated project or bot identities rather than personal
credentials.

For the first project instances, provision separate GitHub identity material
inside each Incus instance after the clean clone validates. Track the required
secret names in `manifests/rebuild/secrets.manifest.tsv`; never store tokens in
git.
