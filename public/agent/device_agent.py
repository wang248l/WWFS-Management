#!/usr/bin/env python3
"""WWFS办公室 设备小助手（2026-11-21 Wallace：总控台上看到所有电脑和手机，选一台让 Claude 在上面跑任务）。

每 30 秒去 management.wallacewang.ca 报到一次（主机名、系统、adb 看到的安卓手机、Claude 版本和登录状态）；
页面上派了任务，就在这台电脑上跑 `claude -p "<任务>"`，边跑边把输出传回去，页面上能看到；点取消会停掉。
只用 Python 标准库，Mac / Windows / Linux 通用。

  python device_agent.py pair            登记配对，打印 6 位短码，老板在「设备」页点批准，钥匙自动取回
  python device_agent.py run             常驻（launchd / 任务计划程序 调这个）
  python device_agent.py once            报到一次，打印看到的东西（调试用）

配置：~/.config/office/device.json  {"id":"surfacebook","name":"Surface Book","cwd":"C:\\\\Users\\\\..."}（可选）
钥匙：~/.config/office/token
"""
import json, os, platform, secrets, shutil, socket, subprocess, sys, threading, time, urllib.error, urllib.request

VERSION = "1.0"
BASE = os.environ.get("OFFICE_BASE", "https://management.wallacewang.ca")
HOME = os.path.expanduser("~")
CONF_DIR = os.path.join(HOME, ".config", "office")
TOKEN_FILE = os.environ.get("OFFICE_TOKEN_FILE", os.path.join(CONF_DIR, "token"))
CONF_FILE = os.path.join(CONF_DIR, "device.json")
LOG_FILE = os.path.join(CONF_DIR, "device_agent.log")
IS_WIN = os.name == "nt"
JOB_TIMEOUT = 60 * 60  # 一条任务最多 1 小时
NOWIN = 0x08000000 if IS_WIN else 0  # CREATE_NO_WINDOW：Windows 上别弹黑框


def log(*a):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + " ".join(str(x) for x in a)
    try:
        os.makedirs(CONF_DIR, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        if os.path.getsize(LOG_FILE) > 2_000_000:
            os.replace(LOG_FILE, LOG_FILE + ".1")
    except Exception:
        pass
    if sys.stdout:
        try:
            print(line, flush=True)
        except Exception:
            pass


def conf():
    try:
        with open(CONF_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def token():
    try:
        with open(TOKEN_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""


def post(path, body, tok=None, timeout=30):
    h = {"Content-Type": "application/json", "User-Agent": "wwfs-device-agent/" + VERSION}
    if tok:
        h["Authorization"] = "Bearer " + tok
    req = urllib.request.Request(BASE + path, method="POST", data=json.dumps(body).encode(), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def run(cmd, timeout=20):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, creationflags=NOWIN, encoding="utf-8", errors="replace")
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except Exception as e:
        return -1, str(e)


def find_adb():
    for c in [shutil.which("adb"), "/opt/homebrew/bin/adb", "/usr/local/bin/adb",
              os.path.join(HOME, "Library/Android/sdk/platform-tools/adb"),
              os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk", "platform-tools", "adb.exe"),
              os.path.join(HOME, "platform-tools", "adb.exe"), r"C:\platform-tools\adb.exe"]:
        if c and os.path.exists(c):
            return c
    return None


def find_claude():
    c = conf().get("claude")
    cands = [c] if c else []
    # Mac 上无人值守一律走 wwfs-claude（固定身份，不弹权限框，见 ~/ClaudeWorkspace/CLAUDE.md）
    cands += [os.path.join(HOME, ".local/bin/wwfs-claude"), shutil.which("claude"), os.path.join(HOME, ".local/bin/claude"),
              os.path.join(HOME, ".local", "bin", "claude.exe"), os.path.join(os.environ.get("APPDATA", ""), "npm", "claude.cmd")]
    for x in cands:
        if x and os.path.exists(x):
            return x
    return None


def phones():
    adb = find_adb()
    if not adb:
        return []
    rc, out = run([adb, "devices", "-l"])
    res = []
    for line in out.splitlines()[1:]:
        parts = line.split()
        if len(parts) < 2 or parts[0].startswith("*"):
            continue
        model = next((p.split(":", 1)[1] for p in parts[2:] if p.startswith("model:")), "")
        res.append({"serial": parts[0], "state": parts[1], "model": model})
    return res


_claude_cache = {"t": 0, "ver": "", "err": None}


def claude_status():
    """Claude 版本 + 有没有登录（10 分钟查一次，别每 30 秒都启动 claude）。"""
    if time.time() - _claude_cache["t"] < 600:
        return _claude_cache["ver"], _claude_cache["err"]
    exe = find_claude()
    ver, err = "", None
    if not exe:
        err = "这台电脑没装 Claude Code"
    else:
        rc, out = run([exe, "--version"])
        ver = out.strip().split(" ")[0] if rc == 0 else ""
        rc, out = run([exe, "auth", "status", "--json"], timeout=30)
        try:
            if not json.loads(out[out.index("{"):]).get("loggedIn"):
                err = "Claude 没登录（需要在这台电脑上登录一次）"
        except Exception:
            if rc != 0:
                err = "查不到 Claude 登录状态"
    _claude_cache.update(t=time.time(), ver=ver, err=err)
    return ver, err


def device_id():
    c = conf()
    return (c.get("id") or socket.gethostname().split(".")[0]).lower()


def heartbeat(tok):
    ver, err = claude_status()
    body = {"id": device_id(), "name": conf().get("name") or socket.gethostname().split(".")[0], "host": socket.gethostname(),
            "os": "windows" if IS_WIN else sys.platform, "phones": phones(), "claude": ver, "agent": VERSION,
            "cwd": conf().get("cwd") or HOME, "error": err}
    return post("/api/devices/heartbeat", body, tok)


def ailog(status, msg, why=None):
    """Mac 上顺手记 AI 工作日志（没有 ailog 就跳过）。"""
    exe = "/opt/homebrew/bin/ailog"
    if not os.path.exists(exe):
        return
    cmd = [exe, "--status", status, "--task", "其他", "--ip", "-", "--platform", "-", "--video", "设备任务", "--msg", msg[:200]]
    if why:
        cmd += ["--where", "device_agent", "--why", why[:200], "--fix", "看办公室「设备」页的输出"]
    run(cmd)


def kill_tree(p):
    try:
        if IS_WIN:
            run(["taskkill", "/T", "/F", "/PID", str(p.pid)])
        else:
            import signal
            os.killpg(p.pid, signal.SIGTERM)
            time.sleep(3)
            if p.poll() is None:
                os.killpg(p.pid, signal.SIGKILL)
    except Exception:
        p.kill()


def do_job(tok, job):
    exe = find_claude()
    jid = job["id"]
    if not exe:
        post("/api/devices/result", {"jobId": jid, "output": "这台电脑没装 Claude Code", "exitCode": 127, "done": True}, tok)
        return
    mode = job.get("mode") if job.get("mode") in ("auto", "plan", "acceptEdits") else "auto"
    cmd = [exe, "-p", job["prompt"], "--permission-mode", mode]
    cwd = conf().get("cwd") or HOME
    log("开始任务", jid, mode, job["prompt"][:80])
    buf, lock = [], threading.Lock()
    try:
        # 自己一个进程组，取消时连 claude 起的子进程一起停掉
        p = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                             text=True, encoding="utf-8", errors="replace",
                             creationflags=NOWIN | (0x00000200 if IS_WIN else 0), start_new_session=not IS_WIN)
    except Exception as e:
        post("/api/devices/result", {"jobId": jid, "output": f"启动 Claude 失败：{e}", "exitCode": 126, "done": True}, tok)
        return

    def reader():
        for line in p.stdout:
            with lock:
                buf.append(line)

    threading.Thread(target=reader, daemon=True).start()
    start, cancelled = time.time(), False
    while p.poll() is None:
        time.sleep(5)
        with lock:
            out = "".join(buf)
        try:
            st, j = post("/api/devices/result", {"jobId": jid, "output": out, "done": False}, tok)
            if j.get("cancelled"):
                cancelled = True
        except Exception:
            pass
        if cancelled or time.time() - start > JOB_TIMEOUT:
            kill_tree(p)
            break
    p.wait()
    time.sleep(0.5)
    with lock:
        out = "".join(buf)
    if not cancelled and time.time() - start > JOB_TIMEOUT:
        out += "\n[超过 1 小时，停掉了]"
    rc = p.returncode if not cancelled else -15
    if cancelled:
        out += "\n[页面上取消了]"
    for _ in range(5):
        try:
            post("/api/devices/result", {"jobId": jid, "output": out, "exitCode": rc, "done": True}, tok)
            break
        except Exception:
            time.sleep(10)
    log("任务结束", jid, "退出码", rc)
    ailog("ok" if rc == 0 else "fail", f"设备任务（{device_id()}）：{job['prompt'][:80]}", None if rc == 0 else f"退出码 {rc}：{out[-150:]}")


def loop():
    log("设备小助手启动", VERSION, device_id(), BASE)
    while True:
        tok = token()
        if not tok:
            log("还没有钥匙，先运行 pair")
            time.sleep(60)
            continue
        try:
            st, j = heartbeat(tok)
            if st == 401:
                log("钥匙被撤销或无效（401）")
                time.sleep(300)
                continue
            if st == 200 and j.get("queued"):
                st2, c = post("/api/devices/claim", {"id": device_id()}, tok)
                if c.get("job"):
                    do_job(tok, c["job"])
                    continue
        except Exception as e:
            log("报到失败", e)
        time.sleep(30)


def pair(wait_min=60):
    if token():
        st, _ = heartbeat(token())
        if st == 200:
            print("已经配对过了，钥匙有效。")
            return 0
    poll = secrets.token_hex(32)
    label = f"{conf().get('name') or socket.gethostname()}（设备小助手）"
    st, j = post("/api/pair/request", {"label": label, "poll": poll})
    if st != 200:
        print("登记失败：", st, j)
        return 1
    code = j["code"]
    print(f"\n  配对短码：{code}\n  打开 management.wallacewang.ca 的「设备」页，核对短码后点「批准」。\n", flush=True)
    for _ in range(wait_min * 6):
        time.sleep(10)
        st, j = post("/api/pair/poll", {"code": code, "poll": poll})
        if j.get("status") == "approved" and j.get("key"):
            os.makedirs(CONF_DIR, exist_ok=True)
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(j["key"])
            if not IS_WIN:
                os.chmod(TOKEN_FILE, 0o600)
            print("✅ 已批准，钥匙已保存。")
            heartbeat(j["key"])
            return 0
    print("等了一小时没批准，重新运行 pair。")
    return 1


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    if cmd == "pair":
        sys.exit(pair())
    if cmd == "once":
        print(json.dumps({"id": device_id(), "phones": phones(), "claude": claude_status(), "adb": find_adb(), "claude_exe": find_claude()}, ensure_ascii=False, indent=2))
        if token():
            print(heartbeat(token()))
        sys.exit(0)
    loop()
