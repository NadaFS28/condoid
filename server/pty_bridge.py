import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios

def set_winsize(fd, rows, cols):
    try:
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except Exception:
        pass

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "bash"
    cwd = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    python_exec = sys.argv[3] if len(sys.argv) > 3 else "python3"

    cmd = [python_exec, "-i"] if mode == "python" else ["/bin/bash", "--noprofile", "--norc", "-i"]
    if mode == "bash":
        os.environ["PS1"] = "\\[\\033[36m\\]condo\\[\\033[0m\\]:\\[\\033[34m\\]\\w\\[\\033[0m\\]$ "
    os.environ["TERM"] = "xterm-256color"

    pid, master_fd = pty.fork()
    if pid == 0:
        os.chdir(cwd)
        os.execvp(cmd[0], cmd)
        sys.exit(1)

    set_winsize(master_fd, 24, 90)

    stdin_fd = sys.stdin.fileno()
    stdout_fd = sys.stdout.fileno()

    # Use FD 3 if available for resize JSON commands
    ctrl_fd = None
    try:
        os.fstat(3)
        ctrl_fd = 3
    except OSError:
        ctrl_fd = None

    watch_fds = [master_fd, stdin_fd] + ([ctrl_fd] if ctrl_fd is not None else [])

    while True:
        try:
            rlist, _, _ = select.select(watch_fds, [], [])
        except InterruptedError:
            continue

        if master_fd in rlist:
            try:
                data = os.read(master_fd, 4096)
            except OSError:
                break
            if not data:
                break
            os.write(stdout_fd, data)

        if stdin_fd in rlist:
            try:
                data = os.read(stdin_fd, 4096)
            except OSError:
                break
            if not data:
                break
            os.write(master_fd, data)

        if ctrl_fd is not None and ctrl_fd in rlist:
            try:
                raw = os.read(ctrl_fd, 1024)
            except OSError:
                watch_fds = [master_fd, stdin_fd]
                ctrl_fd = None
                continue
            if not raw:
                watch_fds = [master_fd, stdin_fd]
                ctrl_fd = None
                continue
            for line in raw.decode("utf-8", errors="ignore").splitlines():
                if not line.strip():
                    continue
                try:
                    msg = json.loads(line)
                    if msg.get("type") == "resize":
                        set_winsize(master_fd, int(msg.get("rows", 24)), int(msg.get("cols", 80)))
                    elif msg.get("type") == "signal":
                        os.kill(pid, signal.SIGINT)
                except Exception:
                    pass

    try:
        os.kill(pid, signal.SIGTERM)
    except Exception:
        pass

if __name__ == "__main__":
    main()
