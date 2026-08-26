# Five-card Batch Checklist

Скопируй этот ledger в рабочий отчёт партии. Не создавай постоянный candidate-архив в production tree.

## Batch

- Batch ID/date:
- Master-spec status:
- Exact five IDs:
- Working directory for temporary masters:
- Git baseline/status:

## Per-card record

Для каждой из пяти карт:

```text
ID / name:
Current canonical path:
Why regenerate now:
Asset problem vs render problem:

RWS contract:
- required figures:
- required objects and exact counts:
- placement/relationship:
- required background symbols:
- allowed stylistic changes:
- forbidden deviations:

Generation:
- shared style block version:
- card-specific scene block:
- candidate path:
- palette match vs world/judgement:
- self-review risks:

Approvals:
- clean art: pending | approved-final | changes-requested | rejected
- author wording/date:

Integration:
- production WebP dimensions/weight:
- canonical asset replaced: yes/no
- temp sources removed from production tree: yes/no
- daily desktop/mobile:
- selected spread cards:
- saved spread:
- reading overview:
- past/present/future:
- final three-card composition:
- /qa/cards:
- lint/build:
- final status: integrated | deferred | rejected
```

## Batch completion

- Exactly five records exist.
- Each record has a final status.
- No unapproved asset replaced a canonical WebP.
- No old asset or rejected candidate remains beside production cards.
- All integrated cards passed every render context.
- Documentation reflects accepted visual decisions.
- Commit/deploy remains pending unless separately authorized.
