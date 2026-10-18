#!/usr/bin/env python3
"""ContextKeeper: tells you when to /clear or /compact, and writes a handoff
to STATUS.md before you do, so the next session starts with full context.

One script, three Claude Code hook events (passed as the first argument):
  prompt  -> UserPromptSubmit: nudge when the session has grown large
  stop    -> Stop: once the session is very large, have Claude write a handoff
             to STATUS.md, then tell the user whether to /clear or /compact
  start   -> SessionStart: feed the last handoff into the new session

It never blocks your prompts and never fails a session: any error exits 0
silently. Standard library only; works on Windows (Git Bash), macOS, Linux.
"""
import datetime
import json
import os
import re
import sys

VERSION = "1.0.0"

DEFAULTS = {
    "enabled": True,
    # Thresholds are measured as GROWTH above the session's starting context
    # (system prompt + tools + CLAUDE.md), because that baseline can't be
    # cleared anyway. /clear removes exactly the growth.
    "nudge_growth": 50000,      # tokens of growth before the first nudge
    "handoff_growth": 80000,    # tokens of growth before the STATUS.md handoff
    "repeat_every": 40000,      # re-nudge / re-handoff every N more tokens
    "status_file": "STATUS.md",
    "todo_file": "TODO.md",
    "decisions_file": "DECISIONS.md",
    "handoff_heading": "## Session handoff (ContextKeeper)",
    "max_inject_chars": 6000,   # cap on handoff text fed into a new session
}

HOME = os.path.expanduser("~")
DATA_DIR = os.path.join(HOME, ".claude", "contextkeeper")
STATE_DIR = os.path.join(DATA_DIR, "state")
LOG_FILE = os.path.join(DATA_DIR, "RUNLOG.md")
SELF = os.path.abspath(__file__)


# ---------------------------------------------------------------- helpers
def out(obj):
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


def log(event, session, msg):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write("- %s | %s | %s | %s\n" % (ts, event, (session or "?")[:8], msg))
    except Exception:
        pass


def load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def project_dir(payload):
    return os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()


def load_config(proj):
    cfg = dict(DEFAULTS)
    for p in (os.path.join(HOME, ".claude", "contextkeeper.json"),
              os.path.join(proj, ".claude", "contextkeeper.json")):
        c = load_json(p)
        if isinstance(c, dict):
            cfg.update(c)
    return cfg


def is_global_copy():
    return os.path.normcase(os.path.dirname(SELF)) == os.path.normcase(
        os.path.join(HOME, ".claude", "hooks"))


def project_has_own_copy(proj):
    return os.path.isfile(os.path.join(proj, ".claude", "hooks", "contextkeeper.py"))


def state_path(session):
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", session or "unknown")
    return os.path.join(STATE_DIR, safe + ".json")


def load_state(session):
    return load_json(state_path(session)) or {}


def save_state(session, st):
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(state_path(session), "w", encoding="utf-8") as f:
            json.dump(st, f)
    except Exception:
        pass


def usage_total(u):
    return (int(u.get("input_tokens") or 0)
            + int(u.get("cache_creation_input_tokens") or 0)
            + int(u.get("cache_read_input_tokens") or 0)
            + int(u.get("output_tokens") or 0))


def main_assistant_usage(line):
    """Return total context tokens if this transcript line is a main-thread
    assistant message with usage, else None."""
    if '"assistant"' not in line or '"usage"' not in line:
        return None
    try:
        o = json.loads(line)
    except Exception:
        return None
    if o.get("type") != "assistant" or o.get("isSidechain"):
        return None
    u = (o.get("message") or {}).get("usage")
    if not isinstance(u, dict):
        return None
    t = usage_total(u)
    return t if t > 0 else None


def is_compact_boundary(line):
    if "compact_boundary" not in line and "isCompactSummary" not in line:
        return False
    try:
        o = json.loads(line)
    except Exception:
        return False
    return o.get("subtype") == "compact_boundary" or bool(o.get("isCompactSummary"))


def measure(transcript):
    """(baseline, current): context size at the first assistant turn since the
    last compaction, and at the latest one. None if not measurable yet."""
    if not transcript or not os.path.isfile(transcript):
        return None, None
    baseline = current = None
    try:
        with open(transcript, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                if is_compact_boundary(line):
                    baseline = current = None
                    continue
                t = main_assistant_usage(line)
                if t is not None:
                    if baseline is None:
                        baseline = t
                    current = t
    except Exception:
        return None, None
    return baseline, current


def band(growth, start, step):
    """0 below start, then 1, 2, 3... for every `step` tokens above it."""
    if growth < start:
        return 0
    return 1 + int((growth - start) // max(step, 1))


def k(n):
    return "%dk" % round(n / 1000.0)


# ---------------------------------------------------------------- events
def on_prompt(payload, cfg):
    session = payload.get("session_id")
    base, cur = measure(payload.get("transcript_path"))
    if cur is None:
        return
    growth = max(cur - base, 0)
    b = band(growth, cfg["nudge_growth"], cfg["repeat_every"])
    st = load_state(session)
    if b == 0 or b <= st.get("nudge_band", 0):
        return
    st["nudge_band"] = b
    save_state(session, st)
    log("nudge", session, "context %s (grew %s)" % (k(cur), k(growth)))
    out({
        "systemMessage": (
            "ContextKeeper: this session holds ~%s tokens of context (+%s since it "
            "started), and every turn re-reads all of it. Wrap up this task, then "
            "/clear for a new topic or /compact to keep going." % (k(cur), k(growth))),
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": (
                "ContextKeeper: session context is ~%s tokens (+%s since start). "
                "If this prompt is unrelated to the earlier work in this session, "
                "the user is better served by a fresh session: a STATUS.md handoff "
                "followed by /clear. Mentioning that in one line at the start of "
                "the reply is useful to the user." % (k(cur), k(growth))),
        },
    })


HANDOFF_REASON = """ContextKeeper: this session's context is ~{cur} tokens (+{growth} since it started), so it is time to hand off before the user runs /clear or /compact. Before finishing, do this (keep it brief, no extra commentary):

1. In {status} at the project root (create it if missing), replace the section headed "{heading}" (or add it at the top, under the title) with a handoff a fresh session could resume from cold. Keep it under ~60 lines. Include:
   - Updated: {now}; branch and latest commit if this is a git repo
   - Goal of this session, in one or two lines
   - Done this session: what changed and which files
   - Current state: what works, what is broken, build/test status as last observed
   - In progress / open problems, with exact error messages where relevant
   - Next steps, numbered, specific enough to start on immediately
   - Gotchas learned (commands, paths, quirks) that would cost time to rediscover
   - Key files to read first
   Only state things observed in this session; mark anything unverified as unverified.
2. If tasks or decisions changed, update {todo} and {decisions} the same way (create them if missing). Keep CLAUDE.md lean; don't paste the handoff there.
3. Don't commit or push unless the user asked for commits in this session.
4. End your reply with one line recommending either /clear (the current task is done, or the next work is unrelated) or /compact (still mid-task and the details matter), and why."""


def on_stop(payload, cfg):
    session = payload.get("session_id")
    st = load_state(session)

    if payload.get("stop_hook_active"):
        # Claude just finished the handoff we asked for: tell the user.
        if st.get("handoff_pending"):
            st["handoff_pending"] = False
            save_state(session, st)
            log("handoff-done", session, "STATUS.md handoff written")
            out({"systemMessage": (
                "ContextKeeper: handoff saved to %s. Run /clear (new task) or "
                "/compact (same task); the next session picks it up automatically."
                % cfg["status_file"])})
        return

    base, cur = measure(payload.get("transcript_path"))
    if cur is None:
        return
    growth = max(cur - base, 0)
    b = band(growth, cfg["handoff_growth"], cfg["repeat_every"])
    if b == 0 or b <= st.get("handoff_band", 0):
        return
    st["handoff_band"] = b
    st["handoff_pending"] = True
    st["nudge_band"] = max(st.get("nudge_band", 0),
                           band(growth, cfg["nudge_growth"], cfg["repeat_every"]))
    save_state(session, st)
    log("handoff", session, "context %s (grew %s)" % (k(cur), k(growth)))
    out({"decision": "block", "reason": HANDOFF_REASON.format(
        cur=k(cur), growth=k(growth), status=cfg["status_file"],
        heading=cfg["handoff_heading"], todo=cfg["todo_file"], decisions=cfg["decisions_file"],
        now=datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))})


def extract_handoff(text, heading):
    lines = text.splitlines()
    start = None
    for i, l in enumerate(lines):
        if l.strip().lower() == heading.strip().lower():
            start = i
            break
    if start is None:
        return None
    level = len(heading) - len(heading.lstrip("#"))
    body = [lines[start]]
    for l in lines[start + 1:]:
        m = re.match(r"^(#+)\s", l)
        if m and len(m.group(1)) <= level:
            break
        body.append(l)
    return "\n".join(body).strip()


def on_start(payload, cfg):
    session = payload.get("session_id")
    source = payload.get("source", "startup")
    if source == "compact":
        st = load_state(session)
        st.update({"nudge_band": 0, "handoff_band": 0, "handoff_pending": False})
        save_state(session, st)
    proj = project_dir(payload)
    path = os.path.join(proj, cfg["status_file"])
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except Exception:
        return
    h = extract_handoff(text, cfg["handoff_heading"])
    if not h:
        return
    cap = int(cfg["max_inject_chars"])
    if len(h) > cap:
        h = h[:cap] + "\n...(truncated; the full handoff is in %s)" % cfg["status_file"]
    extra = [n for n in (cfg["todo_file"], cfg["decisions_file"]) if os.path.isfile(os.path.join(proj, n))]
    note = (" Related files in the project root: %s." % ", ".join(extra)) if extra else ""
    log("inject", session, "%s: handoff from %s (%d chars)" % (source, cfg["status_file"], len(h)))
    out({"hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": (
            "ContextKeeper: the previous session left this handoff in %s.%s\n\n%s"
            % (cfg["status_file"], note, h)),
    }})


def main():
    event = sys.argv[1] if len(sys.argv) > 1 else ""
    if event == "--version":
        print("ContextKeeper " + VERSION)
        return
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}
    proj = project_dir(payload)
    # A repo's own copy wins over the global one, so nothing fires twice.
    if is_global_copy() and project_has_own_copy(proj):
        return
    cfg = load_config(proj)
    if not cfg.get("enabled", True):
        return
    {"prompt": on_prompt, "stop": on_stop, "start": on_start}.get(
        event, lambda p, c: None)(payload, cfg)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # never break the user's session
        log("error", None, repr(e)[:200])
    sys.exit(0)
