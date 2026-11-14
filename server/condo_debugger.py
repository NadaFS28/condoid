import bdb
import json
import os
import sys
import traceback

CMD_FD = 3
EVT_FD = 4

cmd_stream = os.fdopen(CMD_FD, "r", buffering=1)
evt_stream = os.fdopen(EVT_FD, "w", buffering=1)


def send_event(payload):
    try:
        evt_stream.write(json.dumps(payload, default=str) + "\n")
        evt_stream.flush()
    except Exception:
        pass


def safe_repr(val):
    try:
        r = repr(val)
        if len(r) > 200:
            r = r[:197] + "..."
        return r
    except Exception:
        return "<unrepresentable>"


def serialize_scope(scope_dict):
    items = []
    for k, v in scope_dict.items():
        if k.startswith("__") and k.endswith("__"):
            continue
        if callable(v) and getattr(v, "__module__", "") == "builtins":
            continue
        items.append({
            "name": str(k),
            "value": safe_repr(v),
            "type": type(v).__name__,
        })
    return items[:80]


class CondoDebugger(bdb.Bdb):
    def __init__(self, target_file, display_file, line_map, initial_bps, watches):
        super().__init__()
        self.target_file = os.path.abspath(target_file)
        self.display_file = display_file
        self.line_map = line_map
        self.watches = list(watches or [])
        self.pause_requested = False
        self.stopped = False
        for bp in initial_bps or []:
            self.set_break(self.target_file, int(bp))

    def map_file(self, filename):
        if os.path.abspath(filename) == self.target_file:
            return self.display_file
        return filename

    def map_line(self, filename, lineno):
        if os.path.abspath(filename) == self.target_file:
            return int(self.line_map.get(str(lineno), lineno))
        return lineno

    def user_line(self, frame):
        if self.stopped:
            self.set_quit()
            return

        fn = self.canonic(frame.f_code.co_filename)
        is_target = os.path.abspath(fn) == self.target_file
        hit_bp = self.break_here(frame)

        # Avoid stepping into python stdlib unless inside target file or explicitly stepped
        if not is_target and not hit_bp and not self.pause_requested:
            return

        self.pause_requested = False
        self.emit_paused_and_wait(frame)

    def emit_paused_and_wait(self, frame):
        stack, _ = self.get_stack(frame, None)
        frames_out = []
        for idx, (f, lineno) in enumerate(reversed(stack)):
            fn = f.f_code.co_filename
            if "condo_debugger.py" in fn or fn.endswith("bdb.py"):
                continue
            frames_out.append({
                "id": idx,
                "name": f.f_code.co_name,
                "file": self.map_file(fn),
                "line": self.map_line(fn, lineno),
            })

        cur_file = self.map_file(frame.f_code.co_filename)
        cur_line = self.map_line(frame.f_code.co_filename, frame.f_lineno)

        watch_results = []
        for expr in self.watches:
            try:
                val = eval(expr, frame.f_globals, frame.f_locals)
                watch_results.append({"expression": expr, "value": safe_repr(val)})
            except Exception as exc:
                watch_results.append({"expression": expr, "value": "", "error": str(exc)})

        send_event({
            "type": "paused",
            "file": cur_file,
            "line": cur_line,
            "frames": frames_out,
            "locals": serialize_scope(frame.f_locals),
            "globals": serialize_scope(frame.f_globals),
            "watchResults": watch_results,
        })

        while True:
            raw = cmd_stream.readline()
            if not raw:
                self.set_quit()
                return
            try:
                cmd = json.loads(raw.strip())
            except Exception:
                continue

            action = cmd.get("action")
            if action == "continue":
                self.set_continue()
                return
            elif action == "step_over":
                self.set_next(frame)
                return
            elif action == "step_into":
                self.set_step()
                return
            elif action == "step_out":
                self.set_return(frame)
                return
            elif action == "stop":
                self.stopped = True
                self.set_quit()
                return
            elif action == "set_breakpoints":
                self.clear_all_breaks()
                for bp in cmd.get("lines", []):
                    self.set_break(self.target_file, int(bp))
                send_event({"type": "breakpoints_updated", "lines": cmd.get("lines", [])})
            elif action == "set_watches":
                self.watches = list(cmd.get("expressions", []))
                watch_results = []
                for expr in self.watches:
                    try:
                        val = eval(expr, frame.f_globals, frame.f_locals)
                        watch_results.append({"expression": expr, "value": safe_repr(val)})
                    except Exception as exc:
                        watch_results.append({"expression": expr, "value": "", "error": str(exc)})
                send_event({"type": "watches_updated", "watchResults": watch_results})
            elif action == "eval":
                expr = cmd.get("expression", "")
                try:
                    val = eval(expr, frame.f_globals, frame.f_locals)
                    send_event({"type": "eval_result", "expression": expr, "value": safe_repr(val)})
                except SyntaxError:
                    try:
                        exec(expr, frame.f_globals, frame.f_locals)
                        send_event({"type": "eval_result", "expression": expr, "value": "Executed"})
                    except Exception as exc:
                        send_event({"type": "eval_result", "expression": expr, "error": str(exc)})
                except Exception as exc:
                    send_event({"type": "eval_result", "expression": expr, "error": str(exc)})


def main():
    config = json.loads(sys.argv[1])
    target_file = config["targetFile"]
    display_file = config["displayFile"]
    line_map = config.get("lineMap", {})
    breakpoints = config.get("breakpoints", [])
    watches = config.get("watches", [])
    stop_on_entry = config.get("stopOnEntry", False)

    dbg = CondoDebugger(target_file, display_file, line_map, breakpoints, watches)
    if stop_on_entry:
        dbg.pause_requested = True

    with open(target_file, "r", encoding="utf-8") as f:
        code_str = f.read()

    sys.path.insert(0, os.path.dirname(os.path.abspath(target_file)))
    globals_dict = {
        "__name__": "__main__",
        "__file__": target_file,
        "__builtins__": __builtins__,
    }

    send_event({"type": "started", "file": display_file})
    try:
        compiled = compile(code_str, target_file, "exec")
        dbg.run(compiled, globals_dict, globals_dict)
    except bdb.BdbQuit:
        pass
    except Exception:
        traceback.print_exc()
    finally:
        send_event({"type": "terminated"})


if __name__ == "__main__":
    main()
