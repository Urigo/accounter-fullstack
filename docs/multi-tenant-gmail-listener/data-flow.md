# Multi-tenant Email Ingestion Data Flow (v2)

This document visualizes the runtime data flow for the v2 Cloudflare -> Gateway -> Server
architecture.

During rollout, the current listener path remains active in parallel. This document focuses on the
new v2 ingestion path.

## End-to-End Flow

```mermaid
flowchart TD
    A[Inbound email to tenant alias] --> B[Cloudflare Email forwards event + payload]
    B --> C[Gateway receives request]
    C --> D{Authenticity checks plus replay checks}

    D -->|Invalid| E[Reject INVALID_AUTH or REPLAY_DETECTED + alert]
    D -->|Valid| F[Compute raw_message_hash + correlation_id]

    F --> G[Call Server control endpoint]
    G --> H{Alias resolved and allowed?}
    H -->|No| I[Quarantine UNKNOWN_ALIAS + audit + alert]
    H -->|Yes| J[Receive tenant-bound short-lived ingest grant]

    J --> K[Parse MIME and extract documents + sender evidence]
    K --> L{Extraction and limits valid?}
    L -->|No| M[Quarantine NO_DOCUMENTS, PARSE_ERROR, or OVERSIZE_MESSAGE]
    L -->|Yes| N[Call Server ingest endpoint with grant + idempotency_key]

    N --> O{Grant valid + unconsumed + tenant-bound?}
    O -->|No| P[Reject GRANT_INVALID or TENANT_MISMATCH]
    O -->|Yes| Q[Server idempotency and tenant-scoped dedup]

    Q --> R{Duplicate request?}
    R -->|Yes| S[Return duplicate with existing_ingest_id]
    R -->|No| T[Persist documents and charges via tenant guardrails]

    T --> U[Write audit trail + return inserted outcome]
    S --> U
    U --> V[Gateway applies processed or quarantine or retry handling]
    V --> W[Emit metrics, logs, and shadow parity signals]
```

## Cloudflare-Gateway-Server Sequence

```mermaid
sequenceDiagram
    autonumber
    participant CF as Cloudflare Email
    participant GW as Gateway
    participant CTRL as Server Control API
    participant ING as Server Ingest API
    participant DB as Tenant Persistence
    participant QA as Quarantine and Audit

    CF->>GW: Forward event(recipient_alias, headers, raw payload)
    GW->>GW: Verify signature or mTLS + IP allowlist + timestamp window + nonce replay

    alt Invalid authenticity or replay
        GW->>QA: Record INVALID_AUTH or REPLAY_DETECTED + alert
        GW-->>CF: Reject
    else Valid request
        GW->>GW: Compute raw_message_hash + correlation_id
        GW->>CTRL: resolveAliasAndIssueGrant(control request)

        alt Unknown alias or policy reject
            CTRL-->>GW: decision=reject, reason=UNKNOWN_ALIAS
            GW->>QA: Quarantine + alert
        else Grant issued
            CTRL-->>GW: tenant_id + decision_id + audit_id + ingest_grant
            GW->>GW: Parse MIME and extract docs and sender evidence

            alt Parse or limits failure
                GW->>QA: Quarantine NO_DOCUMENTS or PARSE_ERROR or OVERSIZE_MESSAGE
            else Extracted payload ready
                GW->>ING: ingest(ingest_grant, idempotency_key, extracted payload)
                ING->>ING: Validate grant scope + expiry + single-use jti

                alt Invalid or reused grant
                    ING-->>GW: rejected(reason_code)
                    GW->>QA: Quarantine or retry based on reason_code
                else Valid grant
                    ING->>ING: Idempotency and tenant dedup

                    alt Duplicate
                        ING-->>GW: duplicate(existing_ingest_id, audit_id)
                    else New insert
                        ING->>DB: Persist charge and documents in tenant context
                        DB-->>ING: ingest_id
                        ING-->>GW: inserted(ingest_id, audit_id)
                    end
                end
            end
        end
    end
```

## Data Contract Handoff

Control endpoint request should include:

1. recipient_alias
2. provider_event_id, message_id, thread_id
3. envelope and from and to metadata
4. raw_message_hash
5. received_at
6. correlation_id

Control endpoint response should include:

1. tenant_id
2. decision_id and audit_id
3. ingest_grant with jti, scope, tenant binding, and expires_at
4. optional policy/profile metadata

Ingest endpoint request should include:

1. ingest_grant
2. idempotency_key
3. extracted_documents with hash, size, mime_type, filename, and parse result
4. sender_evidence (alias, from, reply_to, forwarding headers, issuer candidate)
5. message_metadata
6. correlation_id

Ingest endpoint response should include:

1. outcome (inserted, duplicate, quarantined, rejected)
2. ingest_id or existing_ingest_id
3. audit_id and reason_code for non-insert outcomes

## Failure and Control Loops

1. Invalid authenticity or replay detection: reject, alert, and audit.
2. Unknown alias or policy reject: quarantine and alert; ops updates alias policy.
3. Grant validation failure or tenant mismatch: reject or quarantine with audit trail.
4. Parse or size-limit failures: quarantine with explicit reason_code.
5. Transient upstream failures: scheduled retry; non-transient failures remain manual reprocess.
6. Shadow mode rollout: legacy path remains active while v2 decisions and outcomes are measured.
