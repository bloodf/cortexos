# CortexOS Observability

> Metrics, logs, dashboards, alerting rules, and operational runbooks.

## Contents

- [Stack](#stack)
- [Metrics](#metrics)
- [Logs](#logs)
- [Alerts](#alerts)
- [Dashboards](#dashboards)
- [Related docs](#related-docs)

## Stack

| Component | Role |
|---|---|
| Prometheus | Metrics scraping and alert evaluation |
| Grafana | Dashboards and visualization |
| Loki | Log aggregation |
| Fluent Bit / Promtail | Log shipping |
| Node Exporter | Host metrics |
| cAdvisor | Container metrics |
| PostgreSQL exporter | Database metrics |

## Metrics

Add scrape jobs under `/opt/cortexos/stacks/prometheus/prometheus.yml` or managed drop-in.

```yaml
scrape_configs:
  - job_name: cortex-dashboard
    static_configs:
      - targets: ['host.docker.internal:3080']
```

## Logs

Use Loki for service logs and systemd journal for units. Prefer structured logs for new services.

## Alerts

| Alert | Condition | Action |
|---|---|---|
| DashboardDown | dashboard health fails 3m | Restart dashboard and inspect logs |
| HermesUnavailable | Hermes profile health fails 1m | Restart the affected Hermes profile and inspect env |
| HonchoUnavailable | Honcho health fails 1m | Restart Honcho and inspect storage/env |
| SecretReadDeniedSpike | repeated deny events | Investigate possible traversal or misuse |

## Dashboards

> Placeholder: add Grafana dashboard screenshots for host health, Docker services, dashboard API latency, and Hermes/Paperclip outcomes.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
