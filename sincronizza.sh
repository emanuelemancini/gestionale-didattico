#!/bin/bash
# Copia i file src/ dal worktree più recente alla cartella principale

WORKTREES_DIR="$(dirname "$0")/.claude/worktrees"
DEST="$(dirname "$0")/src"

# Trova il worktree modificato più di recente
LATEST=$(ls -td "$WORKTREES_DIR"/*/src 2>/dev/null | head -1 | xargs dirname)

if [ -z "$LATEST" ]; then
  echo "❌ Nessun worktree trovato in $WORKTREES_DIR"
  exit 1
fi

echo "📁 Worktree trovato: $(basename "$LATEST")"
echo "🔄 Copia in corso..."

rsync -a --delete "$LATEST/src/" "$DEST/"

echo "✅ Sincronizzazione completata"
