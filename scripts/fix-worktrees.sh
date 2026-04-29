#!/usr/bin/env bash
# fix-worktrees.sh
#
# Detects and repairs orphan / stale entries in .git/worktrees/ that can
# block automation (checkout, branch creation, scheduled jobs).
#
# Why this exists:
#   The PESSY repo accumulates many ephemeral worktrees from agent runs
#   (.claude/worktrees/*, ~/.codex/worktrees/*). When their on-disk paths
#   disappear without `git worktree remove`, the git common-dir keeps
#   stale bookkeeping at .git/worktrees/<name>/ and `git checkout` of
#   that branch elsewhere fails.
#
# Behavior:
#   1. Lists every entry in .git/worktrees/.
#   2. For each, reads .git/worktrees/<name>/gitdir to get its declared
#      working-tree path.
#   3. If the path no longer exists on disk, the entry is stale.
#   4. Stale entries are reported, then `git worktree prune -v` removes
#      them in one shot.
#   5. Final `git worktree list` is printed for verification.
#
# Modes:
#   ./scripts/fix-worktrees.sh           # dry-run (default): report only
#   ./scripts/fix-worktrees.sh --apply   # actually run prune
#
# Safety:
#   - Never deletes the current worktree (git refuses).
#   - Never touches the main worktree's HEAD or branches.
#   - `git worktree prune` only removes bookkeeping, not files on disk.

set -euo pipefail

APPLY=0
if [[ "${1:-}" == "--apply" ]]; then
  APPLY=1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
COMMON_DIR="$(git rev-parse --git-common-dir 2>/dev/null || true)"

if [[ -z "${COMMON_DIR}" ]]; then
  echo "fix-worktrees: not inside a git repository" >&2
  exit 1
fi

WORKTREES_DIR="${COMMON_DIR}/worktrees"

if [[ ! -d "${WORKTREES_DIR}" ]]; then
  echo "fix-worktrees: no .git/worktrees directory at ${WORKTREES_DIR} — nothing to do."
  exit 0
fi

echo "fix-worktrees: scanning ${WORKTREES_DIR}"
total=0
stale=0
live=0

for entry in "${WORKTREES_DIR}"/*; do
  [[ -d "${entry}" ]] || continue
  total=$((total + 1))
  gitdir_file="${entry}/gitdir"
  if [[ ! -f "${gitdir_file}" ]]; then
    echo "  ! ${entry##*/}: missing gitdir file (treated as stale)"
    stale=$((stale + 1))
    continue
  fi
  declared_gitdir="$(< "${gitdir_file}")"
  declared_worktree="${declared_gitdir%/.git}"
  if [[ -d "${declared_worktree}" ]]; then
    live=$((live + 1))
  else
    stale=$((stale + 1))
    echo "  - ${entry##*/}: stale (${declared_worktree} not found)"
  fi
done

echo ""
echo "fix-worktrees: ${total} total, ${live} live, ${stale} stale"

if [[ ${stale} -eq 0 ]]; then
  echo "fix-worktrees: nothing to prune."
  exit 0
fi

if [[ ${APPLY} -eq 0 ]]; then
  echo ""
  echo "fix-worktrees: dry run. Re-run with --apply to prune the stale entries:"
  echo "  ./scripts/fix-worktrees.sh --apply"
  exit 0
fi

echo ""
echo "fix-worktrees: pruning stale entries..."
git worktree prune -v

echo ""
echo "fix-worktrees: post-prune state:"
git worktree list

echo ""
echo "fix-worktrees: done."
