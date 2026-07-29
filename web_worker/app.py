import time
import requests
import json
import hashlib
import re
import threading
import os
import subprocess
import uuid
from flask import Flask, request, jsonify, render_template, session, redirect, url_for, make_response

app = Flask(__name__)
app.secret_key = "vsphone_super_secret_key_123"

BASE = "https://api.vsphone.com/vsphone/api"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMMANDS_FILE = os.path.join(BASE_DIR, "commands.json")
ACCESS_CODES_FILE = os.path.join(BASE_DIR, "access_codes.json")
USERS_FILE = os.path.join(BASE_DIR, "users.json")
ADMIN_PASSWORD = "imam2507"
COMMANDS = {}

def get_all_users():
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_all_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=4)

def get_all_codes():
    if not os.path.exists(ACCESS_CODES_FILE):
        return {}
    try:
        with open(ACCESS_CODES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_all_codes(codes):
    with open(ACCESS_CODES_FILE, "w", encoding="utf-8") as f:
        json.dump(codes, f, indent=4)

def get_valid_access_codes():
    codes_data = get_all_codes()
    valid_codes = []
    now = time.time()
    for code, info in codes_data.items():
        if info.get('expires_at') is None or info.get('expires_at') > now:
            valid_codes.append(code)
    # Default code fallback if none exist (for initial setup)
    if not codes_data:
        return ["TOPNOD2026"]
    return valid_codes

@app.before_request
def check_access_code():
    # Allow static and login routes
    allowed = ['login_code', 'static']
    if request.endpoint in allowed or request.path.startswith('/static/'):
        return
    
    # Check Admin API routes
    if request.path.startswith('/api/admin'):
        if not session.get('is_admin'):
            return jsonify({"success": False, "msg": "Unauthorized"})
        return

    # Check User routes
    if not session.get('is_authenticated'):
        return redirect(url_for('login_code'))



@app.route('/api/admin/generate', methods=['POST'])
def admin_generate():
    data = request.json
    code = data.get('code', '').strip()
    duration_hours = float(data.get('duration_hours', 24))
    if not code:
        return jsonify({"success": False, "msg": "Kode tidak boleh kosong"})
    
    codes = get_all_codes()
    codes[code] = {
        "created_at": time.time(),
        "expires_at": time.time() + (duration_hours * 3600) if duration_hours > 0 else None
    }
    save_all_codes(codes)
    return jsonify({"success": True})

@app.route('/api/admin/delete', methods=['POST'])
def admin_delete():
    code = request.json.get('code')
    codes = get_all_codes()
    if code in codes:
        del codes[code]
        save_all_codes(codes)
    return jsonify({"success": True})

@app.route('/api/admin/delete_user', methods=['POST'])
def admin_delete_user():
    username = request.json.get('username')
    users = get_all_users()
    if username in users:
        del users[username]
        save_all_users(users)
    return jsonify({"success": True})

@app.route('/api/admin/extend_user', methods=['POST'])
def admin_extend_user():
    username = request.json.get('username')
    duration_hours = int(request.json.get('duration_hours', 24))
    users = get_all_users()
    
    if username in users:
        current_expires = users[username].get('expires_at')
        now = time.time()
        
        # Jika akun sudah kedaluwarsa, mulai dari sekarang. Jika masih aktif, tambah dari waktu sisa.
        if current_expires is None:
            pass # Selamanya, tidak perlu diperpanjang
        else:
            base_time = current_expires if current_expires > now else now
            users[username]['expires_at'] = base_time + (duration_hours * 3600)
            save_all_users(users)
            
    return jsonify({"success": True})

def inject_master_session():
    try:
        session_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vsphone_session.json")
        if os.path.exists(session_file):
            with open(session_file, "r") as f:
                data = json.load(f)
                session["vsphone_token"] = data.get("token")
                session["vsphone_userid"] = data.get("userid")
    except:
        pass

@app.route('/login_code', methods=['GET', 'POST'])
def login_code():
    if request.method == 'POST':
        action = request.form.get('action', 'login')
        
        if action == 'admin':
            code = request.form.get('access_code', '').strip()
            if code == ADMIN_PASSWORD:
                session['is_admin'] = True
                session['is_authenticated'] = True
                inject_master_session()
                return redirect(url_for('login_code'))
            return render_template('login_code.html', error="Password Admin Salah!")
            
        elif action == 'register':
            username = request.form.get('username', '').strip()
            password = request.form.get('password', '').strip()
            access_code = request.form.get('access_code', '').strip()
            
            if not username or not password or not access_code:
                return render_template('login_code.html', error="Harap isi semua kolom pendaftaran!", register_active=True)
                
            users = get_all_users()
            if username in users:
                return render_template('login_code.html', error="Username sudah dipakai, pilih yang lain!", register_active=True)
                
            codes = get_all_codes()
            if access_code not in codes:
                return render_template('login_code.html', error="Kode Akses tidak valid!", register_active=True)
                
            code_info = codes[access_code]
            if code_info.get('used_by'):
                return render_template('login_code.html', error="Kode Akses sudah dipakai oleh user lain!", register_active=True)
                
            # Create user
            users[username] = {
                "password_hash": hashlib.sha256(password.encode()).hexdigest(),
                "expires_at": code_info.get('expires_at')
            }
            save_all_users(users)
            
            # Mark code as used
            codes[access_code]['used_by'] = username
            save_all_codes(codes)
            
            # Auto login removed, just show success message on login tab
            codes = get_all_codes()
            users = get_all_users()
            return render_template('login_code.html', 
                                   success_msg=f"Daftar berhasil! Silakan login menggunakan username '{username}'.", 
                                   register_active=False,
                                   codes=codes, users=users, now=time.time())
            
        elif action == 'login':
            username = request.form.get('username', '').strip()
            password = request.form.get('password', '').strip()
            
            users = get_all_users()
            if username not in users:
                return render_template('login_code.html', error="Username tidak ditemukan!")
                
            user_info = users[username]
            if user_info['password_hash'] != hashlib.sha256(password.encode()).hexdigest():
                return render_template('login_code.html', error="Password salah!")
                
            if user_info.get('expires_at') and user_info['expires_at'] < time.time():
                return render_template('login_code.html', error="Akun Anda sudah kedaluwarsa! Hubungi Admin.")
                
            session['is_admin'] = False
            session['is_authenticated'] = True
            session['username'] = username
            inject_master_session()
            return redirect(url_for('index'))
            
    codes = get_all_codes()
    users = get_all_users()
    return render_template('login_code.html', codes=codes, users=users, now=time.time())


def load_commands():
    global COMMANDS
    if os.path.exists(COMMANDS_FILE):
        try:
            with open(COMMANDS_FILE, "r", encoding="utf-8") as f:
                COMMANDS = json.load(f)
        except Exception as e:
            print(f"Error loading commands: {e}")

def save_commands():
    try:
        with open(COMMANDS_FILE, "w", encoding="utf-8") as f:
            json.dump(COMMANDS, f, indent=4)
    except Exception as e:
        print(f"Error saving commands: {e}")

def get_next_reff_from_file():
    ref_file = os.path.join(BASE_DIR, "ref.txt")
    if not os.path.exists(ref_file):
        return None
    try:
        with open(ref_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        import re
        for i, line in enumerate(lines):
            if "TRPH4_" in line and "UDAH" not in line.upper() and "DONE" not in line.upper():
                match = re.search(r"(TRPH4_[A-Z0-9]+)", line)
                if match:
                    code = match.group(1)
                    lines[i] = line.rstrip('\r\n') + " DONE\n"
                    with open(ref_file, "w", encoding="utf-8") as fw:
                        fw.writelines(lines)
                    return code
        return None
    except Exception as e:
        print(f"Error reading ref.txt: {e}")
        return None

load_commands()

class VsphoneAPI:
    def __init__(self, token=None, userid=None):
        self.session = requests.Session()
        self.headers = {
            "Content-Type":  "application/json",
            "Clienttype":    "web",
            "Appversion":    "2003602",
            "Requestsource": "wechat-miniapp",
            "Suppliertype":  "0"
        }
        if token and userid:
            self.headers["token"] = token
            self.headers["userid"] = userid
            self.is_logged_in = True
        else:
            self.is_logged_in = False

    def login(self, email, password):
        try:
            pwd_md5 = hashlib.md5(password.encode()).hexdigest()
            r = self.session.post(f"{BASE}/user/login",
                             json={"mobilePhone": email, "loginType": 1,
                                   "password": pwd_md5, "channel": "web"},
                             headers=self.headers, timeout=15)
            d = r.json()
            if d.get("code") != 200:
                return False, d.get("msg")
                
            self.headers["token"]  = d["data"]["token"]
            self.headers["userid"] = str(d["data"]["userId"])
            self.is_logged_in = True
            
            return True, {"token": self.headers["token"], "userid": self.headers["userid"]}
        except Exception as e:
            return False, str(e)

    def vcadb_exec(self, pad_code, adb_str, poll_timeout=60, check_abort=None):
        for retry in range(3):
            try:
                r = self.session.post(f"{BASE}/vcAdb/asyncAdb",
                                      json={"padCodes": [pad_code], "adbStr": adb_str},
                                      headers=self.headers, timeout=15)
                d = r.json()
                if d.get("code") != 200:
                    time.sleep(2)
                    continue
                    
                base_task_id = d["data"]
                deadline = time.time() + poll_timeout
                
                while time.time() < deadline:
                    for _ in range(4):
                        if check_abort and check_abort():
                            return False, "Aborted by user"
                        time.sleep(0.5)
                        
                    r2 = self.session.post(f"{BASE}/vcAdb/getAdbResult",
                                        json={"baseTaskId": base_task_id},
                                        headers=self.headers, timeout=15)
                    data = r2.json().get("data", "")
                    if not data: continue
                    try:
                        results = json.loads(data) if isinstance(data, str) else data
                        done = {item["padCode"]: item["taskStatus"] for item in results}
                        if pad_code in done:
                            st = done[pad_code]
                            if st == 3:
                                return True, "Success"
                            elif st == 4:
                                return False, "Failed (status 4)"
                    except Exception:
                        pass
                return False, "Timeout"
            except Exception as e:
                time.sleep(2)
                continue
        return False, "asyncAdb gagal setelah 3 percobaan" 

    def reset_pad(self, pad_code):
        try:
            r = self.session.post(f"{BASE}/padManage/padReset",
                             json={"padCodes": [pad_code]},
                             headers=self.headers, timeout=15)
            d = r.json()
            if d.get("code") == 200:
                return True, "API Reset OK"
            else:
                return self.vcadb_exec(pad_code, "am broadcast -a android.intent.action.MASTER_CLEAR -n android/com.android.server.MasterClearReceiver", poll_timeout=30)
        except Exception as e:
            return self.vcadb_exec(pad_code, "am broadcast -a android.intent.action.MASTER_CLEAR -n android/com.android.server.MasterClearReceiver", poll_timeout=30)

    def get_cloud_files(self):
        try:
            r = self.session.post(f"{BASE}/cloudFile/selectFilesByUserId",
                                  json={}, headers=self.headers, timeout=15)
            d = r.json()
            if d.get("code") == 200:
                files = d.get("data") or []
                apks = [f for f in files if f.get("fileName", "").lower().endswith(".apk")]
                return True, apks
            return False, d.get("msg")
        except Exception as e:
            return False, str(e)

    def install_cloud_apk(self, pad_code, apk_info):
        try:
            url = apk_info["downloadUrl"]
            file_name = apk_info.get("fileName", "app.apk")
            
            # Attempt 1: New API uploadFileV3
            payload = {
                "padCodes": [pad_code],
                "url": url,
                "autoInstall": True,
                "fileName": file_name
            }
            r = self.session.post(f"{BASE}/padApi/uploadFileV3", json=payload, headers=self.headers, timeout=15)
            d = r.json()
            if d.get("code") == 200:
                return True, "Install command sent via uploadFileV3 API"
            
            # Attempt 2: Transfer to Cloud Phone (Legacy API) + ADB Install
            task_list = [{
                "taskType": 10000,
                "padCode": pad_code,
                "equipmentId": "",
                "taskContent": json.dumps({
                    "downloadUrl": url,
                    "fileName": file_name,
                    "fileType": apk_info.get("fileType", 2),
                    "fileId": apk_info.get("fileId", 0)
                })
            }]
            r2 = self.session.post(f"{BASE}/padTask/addPadTaskByJiGuang", json={"taskList": task_list}, headers=self.headers, timeout=15)
            d2 = r2.json()
            if d2.get("code") == 200:
                # Force install the transferred file via ADB after a short delay
                install_cmd = f"sleep 5; for f in $(find /sdcard /data/local/tmp -name '{file_name}*'); do pm install -r $f; done"
                self.vcadb_exec(pad_code, install_cmd, poll_timeout=60)
                return True, "File transferred to cloud phone and install triggered"
            
            # Attempt 3: Direct ADB Download Fallback
            adb_str = f"curl -sL '{url}' -o /sdcard/Download/temp.apk || wget -qO /sdcard/Download/temp.apk '{url}'; pm install -r /sdcard/Download/temp.apk; rm /sdcard/Download/temp.apk"
            self.vcadb_exec(pad_code, adb_str, poll_timeout=60)
            
            return False, f"Install APIs failed. (ADB fallback executed)"
        except Exception as e:
            return False, str(e)


def get_api(session_obj=None):
    token = None
    userid = None
    if session_obj:
        token = session_obj.get("vsphone_token")
        userid = session_obj.get("vsphone_userid")
    else:
        from flask import session as fl_session
        token = fl_session.get("vsphone_token")
        userid = fl_session.get("vsphone_userid")
        
    if not token or not userid:
        try:
            session_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vsphone_session.json")
            if os.path.exists(session_file):
                with open(session_file, "r") as f:
                    data = json.load(f)
                    token = data.get("token")
                    userid = data.get("userid")
        except:
            pass
            
    return VsphoneAPI(token=token, userid=userid)

user_states = {}
user_logs = {}

def get_user_state(userid):
    if not userid:
        userid = "default"
    if userid not in user_states:
        user_states[userid] = {
            "pad_statuses": {},
            "abort_flags": {},
            "is_paused": False,
            "reff_queue": [],
            "batch_reff_map": {}
        }
    return user_states[userid]
queue_lock = threading.Lock()

def add_log(userid, msg):
    if not userid: return
    import datetime
    if userid not in user_logs:
        user_logs[userid] = []
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    user_logs[userid].append(f"[{timestamp}] {msg}")
    if len(user_logs[userid]) > 100:
        user_logs[userid].pop(0)


@app.route("/")
def index():
    if not session.get("is_authenticated") and not session.get("is_admin") and not session.get("username"):
        return redirect(url_for("login_code"))
    codes = get_all_codes()
    users = get_all_users()
    return render_template("index.html", session=session, codes=codes, users=users, now=time.time())

@app.route("/v2")
def index_v2():
    if not session.get("is_authenticated") and not session.get("is_admin") and not session.get("username"):
        return redirect(url_for("login_code"))
    codes = get_all_codes()
    users = get_all_users()
    return render_template("v2.html", session=session, codes=codes, users=users, now=time.time())

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('login_code'))

@app.route("/api/login", methods=["POST"])
def do_login():
    data = request.json
    email = data.get("email")
    pwd = data.get("password")
    temp_api = VsphoneAPI()
    success, result = temp_api.login(email, pwd)
    if success:
        session["vsphone_token"] = result["token"]
        session["vsphone_userid"] = result["userid"]
        return jsonify({"success": True, "msg": "Login OK"})
    else:
        return jsonify({"success": False, "msg": result})

@app.route("/api/cloud_files", methods=["GET"])
def api_get_cloud_files():
    api = get_api()
    success, data = api.get_cloud_files()
    if success:
        return jsonify({"success": True, "files": data})
    return jsonify({"success": False, "msg": data})

@app.route("/api/install_apk", methods=["POST"])
def api_install_cloud_apk():
    userid = session.get('vsphone_userid')
    state = get_user_state(userid)
    data = request.json
    pad_code = data.get("pad_code")
    apk_info = data.get("apk_info")
    
    state["abort_flags"][pad_code] = False
    if pad_code not in state["pad_statuses"]:
        state["pad_statuses"][pad_code] = "Idle"
        
    def _worker():
        token = session.get('vsphone_token')
        api = VsphoneAPI(token=token, userid=userid)
        state["pad_statuses"][pad_code] = "Installing..."
        success, msg = api.install_cloud_apk(pad_code, apk_info)
        if success:
            time.sleep(10) # Tunggu task dikirim dan diproses
            state["pad_statuses"][pad_code] = "Install Sent!"
        else:
            state["pad_statuses"][pad_code] = f"Error: {msg}"
        time.sleep(3)
        state["pad_statuses"][pad_code] = "Idle"
        
    threading.Thread(target=_worker, daemon=True).start()
    return jsonify({"success": True})

@app.route("/api/run", methods=["POST"])
def run_command():
    data = request.json
    pad_code = data.get("pad_code")
    cmd_name = data.get("cmd_name")
    reff_code = data.get("reff_code", "")
    wd_address = data.get("wd_address")
    account_index = data.get("account_index")
    
    try:
        loop_count = int(data.get("loop_count", 1))
    except:
        loop_count = 1
        
    token = session.get("vsphone_token")
    userid = session.get("vsphone_userid")
    
    state = get_user_state(userid)
    state["abort_flags"][pad_code] = False
    
    if pad_code not in state["pad_statuses"]:
        state["pad_statuses"][pad_code] = "Idle"
        
    def _worker():
        api = VsphoneAPI(token=token, userid=userid)
        state = get_user_state(userid)
        if cmd_name == "Full Auto":
            SEQUENCE = data.get("sequence", [])
            if not SEQUENCE:
                SEQUENCE = [
                    "4. Reff",
                    "5. Email",
                    "6. Password",
                    "7. Predict Sambo",
                    "8. Logout"
                ]
            current_reff = None
            for i in range(loop_count):
                for sq_cmd in SEQUENCE:
                    while state["is_paused"]:
                        if state["abort_flags"].get(pad_code, False):
                            state["pad_statuses"][pad_code] = "Idle"
                            return
                        state["pad_statuses"][pad_code] = "Paused..."
                        time.sleep(0.5)
                        
                    if state["abort_flags"].get(pad_code, False):
                        state["pad_statuses"][pad_code] = "Idle"
                        return
                        
                    state["pad_statuses"][pad_code] = f"[{i+1}/{loop_count}] {sq_cmd[:12]}..."
                    cmd_str = COMMANDS.get(sq_cmd, "")
                    if "{REFF_CODE}" in cmd_str:
                        batch_id = data.get("batch_id")
                        if batch_id:
                            with queue_lock:
                                current_reff = state["batch_reff_map"].get(batch_id)
                                if not current_reff and state["reff_queue"]:
                                    current_reff = state["reff_queue"].pop(0)
                                    state["batch_reff_map"][batch_id] = current_reff
                        else:
                            current_reff = reff_code
                            with queue_lock:
                                if state["reff_queue"]:
                                    current_reff = state["reff_queue"].pop(0)
                                    
                        if not current_reff:
                            state["pad_statuses"][pad_code] = "Error: Antrian Reff Kosong"
                            time.sleep(2)
                            state["pad_statuses"][pad_code] = "Idle"
                            return
                        cmd_str = cmd_str.replace("{REFF_CODE}", current_reff)
                        state["pad_statuses"][pad_code] = f"[{i+1}/{loop_count}] Menggunakan Reff: {current_reff[:10]}..."
                        
                    if "{WD_ADDRESS}" in cmd_str and wd_address:
                        cmd_str = cmd_str.replace("{WD_ADDRESS}", str(wd_address))
                    if "{ACCOUNT_INDEX}" in cmd_str and account_index is not None:
                        cmd_str = cmd_str.replace("{ACCOUNT_INDEX}", str(account_index))
                        
                    success, msg = api.vcadb_exec(pad_code, cmd_str, poll_timeout=90, check_abort=lambda: state["abort_flags"].get(pad_code, False))
                    
                    if state["abort_flags"].get(pad_code, False):
                        state["pad_statuses"][pad_code] = "Idle"
                        return
                        
                    if not success:
                        print(f"Error on {pad_code} during {sq_cmd}: {msg}")
                        add_log(userid, f"ERROR PAD {pad_code} pada {sq_cmd}: {msg}")
                        
                    if sq_cmd == "6. Password":
                        time.sleep(8) # 5 + 3 seconds delay
                    else:
                        time.sleep(4) # 1 + 3 seconds delay
                                        
                    if current_reff:
                        with queue_lock:
                            log_msg = f"{current_reff} DONE pada {pad_code}"
                            if log_msg not in [log.split('] ')[-1] for log in user_logs.get(userid, [])]:
                                add_log(userid, log_msg)
                            
            state["pad_statuses"][pad_code] = "Full Auto Done!"
            time.sleep(3)
            state["pad_statuses"][pad_code] = "Idle"
            return

        state["pad_statuses"][pad_code] = f"Running {cmd_name}..."
        if cmd_name == "Manual ADB":
            cmd_str = data.get("cmd_str", "")
        else:
            cmd_str = COMMANDS.get(cmd_name, "")
        
        if cmd_str == "SPECIAL_RESET_DEVICE":
            success, msg = api.reset_pad(pad_code)
            if success:
                state["pad_statuses"][pad_code] = "Reset Sent (Tunggu 2 menit)..."
                time.sleep(120)
                state["pad_statuses"][pad_code] = "Reset Selesai!"
            else:
                state["pad_statuses"][pad_code] = f"Error: {msg}"
            time.sleep(2)
            state["pad_statuses"][pad_code] = "Idle"
            return
            
        if "{REFF_CODE}" in cmd_str:
            current_reff = reff_code
            if not current_reff:
                state["pad_statuses"][pad_code] = "Error: Reff Kosong"
                time.sleep(2)
                state["pad_statuses"][pad_code] = "Idle"
                return
            cmd_str = cmd_str.replace("{REFF_CODE}", current_reff)
            
        success, msg = api.vcadb_exec(pad_code, cmd_str, poll_timeout=90, check_abort=lambda: state["abort_flags"].get(pad_code, False))
        
        if success:
            state["pad_statuses"][pad_code] = f"{cmd_name} Done!"
            add_log(userid, f"SUCCESS PAD {pad_code}: {cmd_name}")
        else:
            state["pad_statuses"][pad_code] = "Error Occurred"
            add_log(userid, f"ERROR PAD {pad_code} pada {cmd_name}: {msg}")
            
        time.sleep(2)
        state["pad_statuses"][pad_code] = "Idle"
        
    threading.Thread(target=_worker, daemon=True).start()
    return jsonify({"success": True})

@app.route("/api/stop", methods=["POST"])
def stop_command():
    data = request.json
    pad_code = data.get("pad_code")
    
    token = session.get("vsphone_token")
    userid = session.get("vsphone_userid")
    state = get_user_state(userid)
    state["abort_flags"][pad_code] = True
    
    def _worker():
        api = VsphoneAPI(token=token, userid=userid)
        state["pad_statuses"][pad_code] = "Stopping..."
        api.vcadb_exec(pad_code, "pkill sleep; pkill curl; killall sh", poll_timeout=10)
        state["pad_statuses"][pad_code] = "Idle"
        
    threading.Thread(target=_worker, daemon=True).start()
    return jsonify({"success": True})

@app.route("/api/pause", methods=["POST"])
def toggle_pause():
    userid = session.get('vsphone_userid')
    state = get_user_state(userid)
    state["is_paused"] = not state["is_paused"]
    return jsonify({"success": True, "is_paused": state["is_paused"]})

@app.route("/api/reboot", methods=["POST"])
def reboot():
    def restart():
        time.sleep(1)
        os._exit(0)
    threading.Thread(target=restart).start()
    return jsonify({"success": True})

@app.route("/api/stop-terminal", methods=["POST"])
def stop_terminal_api():
    def shutdown():
        time.sleep(1)
        try:
            parent_pid = os.getppid()
            if os.name == 'nt':
                os.system(f"taskkill /F /PID {parent_pid}")
            else:
                os.system(f"kill -9 {parent_pid}")
        except:
            pass
        os._exit(0)
    threading.Thread(target=shutdown).start()
    return jsonify({"success": True})

@app.route('/api/status', methods=['GET'])
def get_status():
    ref_file = os.path.join(BASE_DIR, "ref.txt")
    queue_list = []
    if os.path.exists(ref_file):
        try:
            with open(ref_file, "r", encoding="utf-8") as f:
                queue_list = [line.strip() for line in f if "TRPH4_" in line]
        except:
            pass

    # Count only codes that do not have DONE in them
    active_count = len([q for q in queue_list if "DONE" not in q.upper() and "UDAH" not in q.upper()])

    userid = session.get('vsphone_userid')
    state = get_user_state(userid)
    
    return jsonify({
        "statuses": state["pad_statuses"],
        "queue_count": active_count,
        "queue": queue_list,
        "done_log": user_logs.get(userid, [])
    })

@app.route('/api/queue', methods=['POST'])
def add_to_queue():
    userid = session.get('vsphone_userid')
    state = get_user_state(userid)
    data = request.json
    codes = data.get("codes", [])
    if isinstance(codes, str):
        codes = [c.strip() for c in codes.split('\n') if c.strip()]
    with queue_lock:
        state["reff_queue"].extend(codes)
    return jsonify({"success": True, "count": len(state["reff_queue"])})

@app.route('/api/queue/clear', methods=['POST'])
def clear_queue():
    userid = session.get('vsphone_userid')
    state = get_user_state(userid)
    with queue_lock:
        state["reff_queue"].clear()
    return jsonify({"success": True})

@app.route('/api/clear_batch_map', methods=['POST'])
def clear_batch_map():
    userid = session.get('vsphone_userid')
    state = get_user_state(userid)
    with queue_lock:
        state["batch_reff_map"].clear()
        if userid in user_logs:
            user_logs[userid].clear()
    return jsonify({"success": True})

@app.route('/api/commands', methods=['GET'])
def api_get_commands():
    load_commands()
    filtered_cmds = {k: v for k, v in COMMANDS.items() if k != "9. WD XLM BITGET"}
    return jsonify(filtered_cmds)

@app.route('/api/commands', methods=['POST'])
def api_save_commands():
    data = request.json
    cmd_name = data.get("cmd_name")
    script = data.get("script")
    if cmd_name and script is not None:
        COMMANDS[cmd_name] = script
        save_commands()
        return jsonify({"success": True})
    return jsonify({"success": False, "msg": "Invalid data"})

@app.route('/api/commands/restore', methods=['POST'])
def api_restore_commands():
    default_file = os.path.join(BASE_DIR, "commands_default.json")
    if os.path.exists(default_file):
        import shutil
        shutil.copy(default_file, COMMANDS_FILE)
        load_commands()
        return jsonify({"success": True})
    return jsonify({"success": False, "msg": "Default file not found"})

@app.route('/api/load_reff_txt', methods=['POST'])
def load_reff_txt():
    ref_file = os.path.join(BASE_DIR, "ref.txt")
    if not os.path.exists(ref_file):
        return jsonify({"success": False, "msg": "File ref.txt tidak ditemukan."})
        
    try:
        with open(ref_file, "r", encoding="utf-8") as f:
            content = f.read()
        # Extract all TRPH4_ codes
        import re
        codes = re.findall(r"TRPH4_[A-Z0-9]+", content)
        if codes:
            userid = session.get('vsphone_userid')
            state = get_user_state(userid)
            with queue_lock:
                state["reff_queue"].extend(codes)
            return jsonify({"success": True, "count": len(codes)})
        return jsonify({"success": False, "msg": "Tidak ada kode Reff valid (TRPH4_...) di ref.txt"})
    except Exception as e:
        return jsonify({"success": False, "msg": str(e)})



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3001)
