# Claude Code Hook 設定

## 概要

`.claude.local/settings.local.json` に PostToolUse Hook を設定し、
Edit / Write ツール使用後に自動で型チェック・Lint を実行する。

## 設定内容

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "input=$(cat); f=$(echo \"$input\" | node -e \"const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.stdout.write((d.tool_input||{}).file_path||'')\" 2>/dev/null); case \"$f\" in */frontend/*) (cd frontend && npm run type-check && npm run lint) 2>/dev/null ;; */backend/*) (cd backend && npm run build) 2>/dev/null ;; esac; exit 0",
            "statusMessage": "型チェック・Lint実行中...",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

## 動作

| 編集対象 | 実行コマンド |
|---------|------------|
| `frontend/**` | `npm run type-check` → `npm run lint` |
| `backend/**` | `npm run build`（NestJS型チェック兼ビルド確認） |

## 前提

- `frontend/package.json` に `type-check: tsc --noEmit` スクリプトが必要（#1 で追加済み）
- jq 不要（Node.js で JSON パース）
