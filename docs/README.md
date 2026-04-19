# Documentation

Project documentation for PI Report Writer.

## Design

Architecture and product design notes that guide implementation.

| Document | Summary |
| -------- | ------- |
| [Report composition layer](design/report-composition-layer.md) | Durable composition vs extracted facts, candidates, and snapshots; schema direction; rerun strategy |
| [Draft document model & preview/export](design/draft-document-model-preview-export.md) | Shared draft document model, server-side assembly, preview/print/export alignment |
| [Multi-subject rules & rerun behavior](design/multi-subject-rules-rerun-behavior.md) | Subject scoping, null attribution, stale/review-needed rules |

Start with the composition layer doc; the other two refine preview/export and multi-subject behavior on top of that model.
