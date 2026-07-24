import subprocess
import time
import platform
import threading

if platform.system() == "Windows":
    ADB_PATH = r"C:\Users\fajar\Downloads\php\libraries\adb.exe"
else:
    ADB_PATH = "adb"

logs = {}

def adb_command(command, log_key):
    global logs
    if log_key not in logs:
        logs[log_key] = []
    
    cmd = f'"{ADB_PATH}" {command}' if platform.system() == "Windows" else f'{ADB_PATH} {command}'
    try:
        logs[log_key].append(f"$ adb {command}")
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        out = result.stdout.strip()
        if out:
            logs[log_key].append(out)
        err = result.stderr.strip()
        if err:
            logs[log_key].append(err)
        return out
    except Exception as e:
        logs[log_key].append(f"Error: {e}")
        return str(e)

def log(log_key, msg):
    global logs
    if log_key not in logs:
        logs[log_key] = []
    logs[log_key].append(msg)

def pair_device(ip_port, code, log_key):
    return adb_command(f"pair {ip_port} {code}", log_key)

def connect_device(ip_port, log_key):
    return adb_command(f"connect {ip_port}", log_key)

def run_wd_script(ip_port, address, start_index, log_key):
    def worker():
        log(log_key, f"--- STARTING WD XLM FOR {ip_port} ---")
        log(log_key, f"Address: {address}, Index: {start_index}")
        
        def tap(x, y, jeda=1.0):
            log(log_key, f"Tapping ({x}, {y})")
            adb_command(f"-s {ip_port} shell input tap {x} {y}", log_key)
            time.sleep(jeda)
            
        def swipe(x1, y1, x2, y2, duration=500, jeda=1.0):
            log(log_key, f"Swiping ({x1},{y1}) to ({x2},{y2})")
            adb_command(f"-s {ip_port} shell input swipe {x1} {y1} {x2} {y2} {duration}", log_key)
            time.sleep(jeda)
            
        def text(txt, jeda=1.0):
            log(log_key, f"Input text: {txt}")
            adb_command(f"-s {ip_port} shell input text '{txt}'", log_key)
            time.sleep(jeda)
            
        def keyevent(k, jeda=1.0):
            log(log_key, f"Keyevent {k}")
            adb_command(f"-s {ip_port} shell input keyevent {k}", log_key)
            time.sleep(jeda)

        swipe(546, 820, 546, 500, 1000, 1.0)
        tap(164, 423, 6.6)
        tap(908, 2258, 1.8)
        tap(908, 2258, 1.6)
        swipe(560, 1630, 580, 2377, 300, 2.3)
        tap(212, 816, 3.2)
        tap(536, 1316, 2.4)
        tap(533, 2302, 1.9)
        tap(525, 631, 0.8)
        text(address, 1.7)
        tap(969, 888, 1.6)
        tap(518, 1452, 1.3)
        tap(541, 2307, 1.2)
        tap(800, 2156, 1.2)
        tap(530, 2307, 2.4)
        tap(982, 1106, 1.0)
        tap(531, 1676, 1.2)
        
        log(log_key, "Opening Google Authenticator...")
        adb_command(f"-s {ip_port} shell monkey -p com.google.android.apps.authenticator2 -c android.intent.category.LAUNCHER 1", log_key)
        time.sleep(2.5)
        
        tap(985, 2287, 1.4)
        tap(963, 2066, 1.2)
        tap(166, 320, 1.0)
        text(str(start_index), 0.8)
        tap(338, 508, 1.0)
        keyevent(279, 1.1)
        keyevent(4, 0.9)
        tap(536, 2279, 2.1)
        tap(983, 2256, 1.0)
        swipe(525, 2140, 556, 220, 1000, 0.6)
        swipe(525, 2140, 556, 220, 1000, 0.4)
        tap(535, 2285, 1.0)
        keyevent(187, 0.9)
        tap(851, 1329, 1.1)
        tap(920, 426, 0.6)
        tap(525, 2310, 1.2)
        tap(528, 1270, 1.1)
        tap(546, 2302, 0.9)
        
        # PIN 080808
        tap(546, 2258, 0.35)
        tap(546, 2127, 0.35)
        tap(546, 2258, 0.35)
        tap(546, 2127, 0.35)
        tap(546, 2258, 0.35)
        tap(546, 2127, 2.5)
        
        tap(536, 2302, 0.9)
        tap(946, 2027, 0.4)
        tap(797, 2233, 1.2)
        tap(495, 1093, 1.0)
        tap(531, 2302, 0.9)
        
        # PIN 080808 again
        tap(546, 2258, 0.35)
        tap(546, 2127, 0.35)
        tap(546, 2258, 0.35)
        tap(546, 2127, 0.35)
        tap(546, 2258, 0.35)
        tap(546, 2127, 4.0)
        
        tap(533, 2310, 1.9)
        
        # Backs
        keyevent(4, 0.7)
        keyevent(4, 0.7)
        keyevent(4, 0.7)
        keyevent(4, 0.7)
        keyevent(4, 0.7)
        
        tap(135, 500, 1.5)
        tap(1032, 145, 0.6)
        tap(773, 273, 0.9)
        tap(846, 1284, 5.5)
        
        log(log_key, "--- WD XLM FINISHED ---")

    threading.Thread(target=worker, daemon=True).start()

def get_logs(log_key):
    global logs
    # Return a copy to avoid concurrency issues during list modification
    return list(logs.get(log_key, []))
    
def clear_logs(log_key):
    global logs
    logs[log_key] = []
