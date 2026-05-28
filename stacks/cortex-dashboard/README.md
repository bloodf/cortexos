# Cortex Dashboard Stack

On-host Docker Compose wrapper for the dashboard during the Docker transition.

The dashboard builds from repo source and connects to host services through
host networking and mounted host sockets. It does not own sibling service
lifecycle.

Target replacement is a host systemd service after Docker sunset criteria in
`PLAN.md` are satisfied.
