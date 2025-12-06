# 自己進化型 社内QAシステム - CLAUDE.md

## プロジェクト概要

遺伝的アルゴリズム（GA）の概念をLLMに応用し、ユーザーフィードバックに基づいてナレッジベース（Markdown）を自律的に改善・最適化するQAシステム。

### 技術スタック
- **LLM**: Vertex AI Gemini 3.0 Pro
- **Search/RAG**: Vertex AI Agent Builder (Google Drive Data Store)
- **Evaluation**: Vertex AI Evaluation (AutoSxS: Pairwise)
- **Orchestration**: Cloud Workflows
- **Database**: Firestore
- **Storage**: Google Drive
- **Trigger**: Cloud Scheduler

### 主要コンセプト
- **遺伝子 (Genotype)**: Markdownファイルのテキストデータ
- **表現型 (Phenotype)**: そのMarkdownを参照して生成された「回答」
- **適応度 (Fitness)**: Vertex AI Evaluationによる評価スコア

### ディレクトリ構造
```
ga_vertex_qa_system/
├── siyou.md              # 基本設計書
├── doc/                  # 詳細ドキュメント
├── _docs/                # 設計判断記録
└── .claude_workflow/     # タスク管理
```

---

## Agent Orchestration

**Must**: All tasks must pass through the orchestrator workflow before execution.

### Core Principle

**Do NOT use pre-defined abstract agents.** Instead:
1. Create specialized agents from actual task requirements
2. Integrate existing agents when synergy improves outcomes
3. Let the agent pool evolve through continuous improvement

### Workflow

```
Task Received
     ↓
Scan pool/ for existing agents
     ↓
Calculate coverage rate against task requirements
     ↓
┌─────────────────────────────────────────────────────┐
│ Coverage 90%+  → Use existing agent                 │
│ Coverage 60-90% → Create integrated agent           │
│ Coverage <60%  → Create new specialized agent       │
└─────────────────────────────────────────────────────┘
     ↓
Execute task with selected/created agent
     ↓
Update manifests/ with metrics
     ↓
Promote to elite/ if qualified
```

### Directory Structure

```
.claude/agents/
├── orchestrator.md        # Orchestrator definition (read first)
├── _template.md           # Template for new agents
├── manifests/             # Skill sheets (metadata + metrics)
│   └── {agent-name}.yaml
└── pool/                   # Agent pool
    ├── specialized/        # Task-specific agents (newly created)
    ├── integrated/         # Merged agents (1st/2nd Gen Integration)
    └── elite/              # Hyper-Elite agents (proven performers)
```

### Decision Matrix

| Coverage Rate | Action | Save Location |
|---------------|--------|---------------|
| **90%+** | Use existing agent directly | - |
| **60-90%** | Merge source agents into integrated agent | `pool/integrated/` |
| **Below 60%** | Create new specialized agent | `pool/specialized/` |

### Agent Creation Rules

When creating a new agent:

1. **Copy `_template.md`** structure
2. **Define in YAML frontmatter**:
   ```yaml
   ---
   name: task-domain-specialist
   description: One-line description
   tools: Read, Grep, Glob, Edit, Write, Bash
   model: opus
   ---
   ```
3. **Write detailed system prompt** in body
4. **Create skill sheet** in `manifests/{agent-name}.yaml`
5. **Save agent** to appropriate `pool/` subdirectory

### Integration Rules

When merging agents:

1. **Identify source agents** with partial coverage
2. **Combine capabilities**, eliminate redundancy
3. **Resolve conflicts** between source agents
4. **Record lineage** in skill sheet `parent_agents` field
5. **Save to `pool/integrated/merged-{source1}-{source2}.md`**

### Evolution Tracking

After every task execution, update the agent's skill sheet:

```yaml
metrics:
  usage_count: 5        # Increment
  success_rate: 0.85    # (successes / usage_count)
  last_used: 2025-01-15 # Current date
```

### Elite Promotion

An agent qualifies for elite status when:
- `usage_count >= 5`
- `success_rate >= 0.8`

Action: Move from `specialized/` or `integrated/` to `elite/`

### Reference Files

- `.claude/agents/orchestrator.md` - Full orchestrator logic
- `.claude/agents/_template.md` - Agent definition template
- `.claude/agents/manifests/_template.yaml` - Skill sheet template

---

## Quick Reference

| Situation | Action |
|-----------|--------|
| New task received | Scan `pool/`, calculate coverage |
| Perfect match exists | Use existing agent |
| Partial matches | Create integrated agent |
| No good match | Create specialized agent |
| Task completed | Update `manifests/` metrics |
| High-performing agent | Promote to `elite/` |

---

## プロジェクト固有のルール

### 進化アルゴリズム関連
- 突然変異 (Mutation): ドキュメント書き換え
- 交叉 (Crossover): 複数ドキュメントの統合
- 評価 (Evaluation): AutoSxSによるペアワイズ評価

### GCP連携
- Vertex AI Gemini 3.0 Pro を使用
- Google Drive をナレッジベースとして使用
- Firestore でフィードバック・履歴を管理

### 設計ドキュメント
- 基本設計書: `siyou.md`
- 詳細ドキュメント: `doc/`
