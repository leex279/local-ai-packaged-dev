# System Architecture & Container Dependencies

This document provides a comprehensive analysis of the container dependencies and startup requirements for the Local AI Development Environment.

## Overview

The system consists of 25+ containerized services organized into distinct tiers with specific startup dependencies. The architecture follows a layered approach where infrastructure services must be healthy before platform services can start, which in turn must be operational before application services.

## Dependency Tiers & Startup Order

### Tier 1: Foundation Infrastructure
**Must start first and achieve healthy state**

```
┌─ vector (logging agent)
├─ postgres (Langfuse DB)
├─ clickhouse (Analytics DB)  
├─ redis (Cache/Session)
└─ minio (Object Storage)
```

**Requirements:**
- All services have health checks that must pass
- No dependencies on other services
- Required for downstream services to function

### Tier 2: Core Database Layer
**Depends on Tier 1 being healthy**

```
┌─ db (Supabase PostgreSQL)
│   ├─ Health Check: pg_isready
│   └─ Depends on: vector
│
└─ analytics (Logflare)
    ├─ Health Check: HTTP endpoint
    └─ Depends on: db (healthy state)
```

**Critical Path:**
`vector` → `db` (healthy) → `analytics` (healthy)

### Tier 3: Platform Services
**Depends on Tier 2 being healthy**

#### Supabase Stack
```
analytics (healthy) ── ┬─ studio
                       ├─ kong (API Gateway)
                       ├─ auth (GoTrue)
                       ├─ rest (PostgREST)
                       ├─ realtime
                       ├─ meta (postgres-meta)
                       ├─ functions (edge functions)
                       ├─ supavisor (connection pooler)
                       ├─ storage
                       └─ imgproxy
```

#### Langfuse Stack
```
postgres + clickhouse + redis + minio (all healthy) ── ┬─ langfuse-worker
                                                        └─ langfuse-web
```

#### Import Services
```
┌─ n8n-import (one-time workflow import)
```

### Tier 4: Application Services
**Depends on specific Tier 3 services**

```
┌─ n8n
│   ├─ Depends on: n8n-import (completion)
│   └─ Connects to: postgres:5432 (DB connection)
│
├─ ollama-{cpu|gpu|gpu-amd}
│   └─ Independent services
│
└─ ollama-pull-llama-{cpu|gpu|gpu-amd}
    └─ Depends on: respective ollama service
```

### Tier 5: Independent Services
**No hard dependencies, can start anytime**

```
┌─ flowise (AI agent builder)
├─ open-webui (Chat interface)
├─ qdrant (Vector database)
├─ neo4j (Graph database)
├─ searxng (Search engine)
└─ caddy (Reverse proxy)
```

## Real Functional Dependencies

### Database Connection Dependencies

| Service | Database | Connection String | Failure Impact |
|---------|----------|------------------|----------------|
| `n8n` | PostgreSQL | `postgres:5432` | Cannot store workflows |
| `langfuse-web` | PostgreSQL + ClickHouse + Redis + MinIO | Multiple hosts | Cannot track LLM operations |
| `langfuse-worker` | PostgreSQL + ClickHouse + Redis + MinIO | Multiple hosts | Cannot process background tasks |
| Supabase services | Internal `db` | `db:5432` | Complete Supabase failure |

### Network/Service Discovery Dependencies

#### Reverse Proxy Routing (Caddy)
```
Caddy reverse proxy routes:
├─ :8001 → n8n:5678
├─ :8002 → open-webui:8080
├─ :8003 → flowise:3001
├─ :8004 → ollama:11434
├─ :8005 → kong:8000 (Supabase)
├─ :8006 → searxng:8080
└─ :8007 → langfuse-web:3000
```

**Impact:** Caddy handles upstream failures gracefully, but services remain inaccessible if down.

### Volume Dependencies

#### Persistent Data Services
```
Data persistence requirements:
├─ postgres → langfuse_postgres_data
├─ clickhouse → langfuse_clickhouse_data + langfuse_clickhouse_logs
├─ minio → langfuse_minio_data
├─ redis → valkey-data
├─ db → supabase_db_data
├─ ollama → ollama_storage
├─ n8n → n8n_storage
├─ qdrant → qdrant_storage
├─ neo4j → neo4j_data
└─ caddy → caddy-data + caddy-config
```

## Critical Configuration Issues

### 🚨 Database Host Inconsistency
**Location:** N8N database configuration  
**Issue:** Configuration mismatch between compose files

```diff
# Main docker-compose.yml
- DB_POSTGRESDB_HOST=postgres

# LocalAI UI input template  
+ DB_POSTGRESDB_HOST=db
```

**Impact:** N8N will fail to connect to database depending on which compose file is used.

**Resolution Required:** Standardize on single database host reference.

## Health Check Requirements

### Critical Health Checks
Services with health checks that block dependent services:

```
Foundation Tier Health Checks:
├─ postgres: pg_isready -U postgres
├─ clickhouse: wget --spider http://localhost:8123/ping
├─ redis: redis-cli ping
├─ minio: mc ready local
└─ db: pg_isready (Supabase)

Platform Tier Health Checks:
└─ analytics: HTTP endpoint check
```

### Health Check Timeout Chain
```
Typical startup sequence timing:
1. Foundation services: 0-30 seconds to healthy
2. Core database layer: 30-45 seconds to healthy  
3. Platform services: 45-90 seconds to healthy
4. Application services: 90-120 seconds to ready
```

## Service Categories & Dependencies

### Infrastructure Services
| Service | Category | Hard Dependencies | Optional Dependencies |
|---------|----------|------------------|----------------------|
| `vector` | Logging | None | - |
| `postgres` | Database | None | - |
| `clickhouse` | Analytics DB | None | - |
| `redis` | Cache | None | - |
| `minio` | Object Storage | None | - |
| `caddy` | Reverse Proxy | None | All routed services |

### Platform Services
| Service | Category | Hard Dependencies | Optional Dependencies |
|---------|----------|------------------|----------------------|
| `db` | Database | `vector` | - |
| `analytics` | Logging | `db` (healthy) | - |
| `kong` | API Gateway | `analytics` (healthy) | - |
| `auth` | Authentication | `analytics` (healthy) | - |
| `rest` | API | `analytics` (healthy) | - |
| `storage` | File Storage | `analytics` (healthy) | `imgproxy` |
| `langfuse-worker` | Background Jobs | `postgres`, `clickhouse`, `redis`, `minio` (all healthy) | - |
| `langfuse-web` | Web Interface | `postgres`, `clickhouse`, `redis`, `minio` (all healthy) | - |

### Application Services
| Service | Category | Hard Dependencies | Optional Dependencies |
|---------|----------|------------------|----------------------|
| `n8n` | Workflow Automation | `n8n-import`, `postgres` | `supabase` services |
| `ollama-*` | LLM Runtime | None | - |
| `ollama-pull-*` | Model Downloader | Respective `ollama-*` | - |
| `flowise` | AI Builder | None | `ollama` |
| `open-webui` | Chat Interface | None | `ollama` |
| `qdrant` | Vector DB | None | - |
| `neo4j` | Graph DB | None | - |
| `searxng` | Search Engine | None | - |

## Failure Scenarios & Impact

### Database Failures
- **PostgreSQL down:** N8N and Langfuse completely non-functional
- **ClickHouse down:** Langfuse analytics and observability disabled
- **Redis down:** Langfuse caching disabled, performance degraded
- **Supabase DB down:** All Supabase services fail

### Network Failures
- **Caddy down:** All web interfaces inaccessible (except direct port access)
- **Kong down:** Supabase API completely inaccessible
- **Service isolation:** Most services continue functioning independently

### Recovery Strategy
1. **Infrastructure First:** Ensure all Tier 1 services are healthy
2. **Core Services:** Verify database health checks pass
3. **Platform Services:** Allow time for dependent services to reconnect
4. **Application Services:** Restart services that depend on recovered infrastructure

## Monitoring Recommendations

### Health Check Endpoints
Monitor these critical endpoints for system health:

```
Infrastructure Health:
├─ postgres:5432 (connection test)
├─ clickhouse:8123/ping
├─ redis:6379 (PING command)
├─ minio:9000/minio/health/live
└─ supabase-db:5432 (connection test)

Platform Health:
├─ kong:8000/health
├─ analytics:4000/health
└─ langfuse-web:3000/api/public/health

Application Health:
├─ n8n:5678/healthz
├─ flowise:3001/api/v1/ping
├─ open-webui:8080/health
└─ ollama:11434/api/tags
```

### Dependency Chain Monitoring
Monitor the critical dependency chains:
1. `vector` → `db` → `analytics` → `supabase-services`
2. `postgres` + `clickhouse` + `redis` + `minio` → `langfuse-services`
3. `n8n-import` → `n8n`

## Conclusion

The system architecture demonstrates a well-designed dependency hierarchy that ensures reliable service startup and operation. The main areas requiring attention are:

1. **Configuration Standardization:** Resolve database host inconsistencies
2. **Health Check Monitoring:** Implement comprehensive health monitoring
3. **Graceful Degradation:** Ensure services handle dependency failures appropriately
4. **Documentation:** Keep dependency documentation updated as services evolve

This tiered approach allows for predictable startup behavior, clear failure isolation, and systematic troubleshooting when issues arise.