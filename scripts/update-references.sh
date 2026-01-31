#!/bin/bash
# Update GSD and OMC references to latest versions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFS_DIR="$(dirname "$SCRIPT_DIR")/references"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ultra Planning - Update References"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

update_repo() {
    local name=$1
    local dir=$2

    if [[ -d "$dir/.git" ]]; then
        echo ""
        echo "▶ Updating $name..."
        cd "$dir"

        # Get current commit
        local before=$(git rev-parse --short HEAD)

        # Pull latest
        git fetch origin
        git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true

        # Get new commit
        local after=$(git rev-parse --short HEAD)

        if [[ "$before" == "$after" ]]; then
            echo "  ✓ Already up to date ($after)"
        else
            echo "  ✓ Updated: $before → $after"
            # Show recent changes
            git log --oneline -3 | sed 's/^/    /'
        fi
    else
        echo "⚠ $name: Not a git repo, skipping"
    fi
}

# Update each reference
update_repo "GSD (Get Shit Done)" "$REFS_DIR/get-shit-done"
update_repo "OMC (Oh My ClaudeCode)" "$REFS_DIR/oh-my-claudecode"
update_repo "OMO (Oh My OpenCode)" "$REFS_DIR/oh-my-opencode"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Update complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
