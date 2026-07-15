import threading
import time
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import requests
import json
import hashlib
import os
import re

BASE = "https://api.vsphone.com/vsphone/api"

# --- Definisi Command / Macro ---
COMMANDS = {
    "1. Install": r"""input tap 479 250
sleep 10
input tap 625 2415
sleep 5
input tap 915 2657
sleep 5
input tap 207 770
sleep 3
input text https://statistic.topnod.com/TopNod.apk
sleep 3
input tap 599 385
sleep 3
input tap 1061 373
sleep 20
input tap 552 737
sleep 3
input tap 991 1624
sleep 6
input tap 1023 1621""",
    "2. Reso Baru": r"""wm size 720x1280
wm density 320
sleep 3
wm size 720x1280
wm density 320
sleep 3
wm size 1260x2800
wm density 560
sleep 3
wm size 1260x2800
wm density 560""",
    "3. Reff": r"""input tap 630 1328
sleep 2
input tap 80 2146
sleep 1
input tap 633 2408
sleep 6
input tap 550 1290
sleep 4
input tap 190 1425
sleep 3
input text {REFF_CODE}""",
    "4. Email": r"""input tap 350 800
sleep 3
DATA=$(curl -s "https://tempmailtopnod.vercel.app/api?action=new&provider=catchmail")
EMAIL=$(echo "$DATA" | sed -n 's/.*"email":"\([^"]*\)".*/\1/p')
input text "$EMAIL"
sleep 2
input tap 1050 1111
MAX_RETRY=20
RETRY=0
while [ $RETRY -lt $MAX_RETRY ]
do
    RESP=$(curl -s "https://tempmailtopnod.vercel.app/api?action=inbox&provider=catchmail&email=$EMAIL")
    SUBJECT=$(echo "$RESP" | sed -n 's/.*"subject":"\([^"]*\)".*/\1/p')
    OTP=$(echo "$SUBJECT" | grep -oE '[0-9]{6}')
    if [ -n "$OTP" ]; then
        input tap 400 1111
        sleep 3
        input text "$OTP"
        sleep 3
        input tap 600 1780
        break
    fi
    RETRY=$((RETRY+1))
    sleep 3
done
if [ $RETRY -ge $MAX_RETRY ]; then
    echo "OTP timeout"
fi""",
    "5. Email No Captcha": r"""input tap 350 800
sleep 1
DATA=$(curl -s "https://tempmailtopnod.vercel.app/api?action=new&provider=catchmail")
EMAIL=$(echo "$DATA" | sed -n 's/.*"email":"\([^"]*\)".*/\1/p')
input text "$EMAIL"
input tap 1050 1111
sleep 8
MAX_RETRY=10
RETRY=0
while [ "$RETRY" -lt "$MAX_RETRY" ]; do
    RESP=$(curl -s "https://tempmailtopnod.vercel.app/api?action=inbox&provider=catchmail&email=$EMAIL")
    SUBJECT=$(echo "$RESP" | sed -n 's/.*"subject":"\([^"]*\)".*/\1/p')
    OTP=$(echo "$SUBJECT" | grep -oE '[0-9]{6}')
    if [ -n "$OTP" ]; then
        input tap 400 1111
        sleep 2
        input text "$OTP"
        sleep 2
        input tap 600 1780
        break
    fi
    RETRY=$((RETRY+1))
    sleep 8
done
if [ "$RETRY" -ge "$MAX_RETRY" ]; then
    echo "OTP timeout"
fi""",
    "6. Password": r"""input tap 174 885
sleep 1.5
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 1.5
input tap 168 2576
sleep 1.5
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 1.5
input tap 219 1251
sleep 1.5
input tap 168 2576
sleep 1.5
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 1.5
input tap 168 2576
sleep 1.5
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 0.2
input tap 84 2004
sleep 1.5
input tap 1085 2567
sleep 1.5
input tap 100 2224
sleep 1
input tap 610 2538
sleep 1.5
input tap 1121 158
sleep 1
input tap 610 2538""",
    "7. Predictbudiman": r"""input tap 639 2156
sleep 10
input tap 358 2466
sleep 5
input tap 617 1555
sleep 3
input tap 916 542
sleep 3
input tap 623 1290
sleep 3
input tap 1059 1720
sleep 2
input tap 623 2563""",
    "8. Logout": r"""input tap 87 93
sleep 3
input tap 1065 2484
sleep 5
input tap 1149 138
sleep 3
input swipe 1212 2571 1200 336 2000
sleep 1
input tap 621 2571
sleep 2
input tap 900 2409"""
}

class VsphoneAPI:
    def __init__(self):
        self.session = requests.Session()
        self.headers = {
            "Content-Type":  "application/json",
            "Clienttype":    "web",
            "Appversion":    "2003602",
            "Requestsource": "wechat-miniapp",
            "Suppliertype":  "0"
        }

    def login(self, email, password):
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
        return True, "Login OK"

    def vcadb_exec(self, pad_code, adb_str, poll_timeout=60):
        try:
            r = self.session.post(f"{BASE}/vcAdb/asyncAdb",
                                  json={"padCodes": [pad_code], "adbStr": adb_str},
                                  headers=self.headers, timeout=15)
            d = r.json()
            if d.get("code") != 200:
                return False, f"asyncAdb gagal: {d}"
                
            base_task_id = d["data"]
            deadline = time.time() + poll_timeout
            
            while time.time() < deadline:
                time.sleep(2)
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
            return False, str(e)

def run_adb_worker(api, pad_code, cmd_name, status_var, reff_code=""):
    status_var.set(f"Running {cmd_name}...")
    cmd_str = COMMANDS[cmd_name]
    
    if "{REFF_CODE}" in cmd_str:
        cmd_str = cmd_str.replace("{REFF_CODE}", reff_code)
        
    success, msg = api.vcadb_exec(pad_code, cmd_str, poll_timeout=90)
    
    if success:
        status_var.set(f"{cmd_name} Done!")
    else:
        status_var.set("Error Occurred")
        print(f"Error on {pad_code}: {msg}")
        
    time.sleep(2)
    status_var.set("Idle")

class AdbManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("VSPhone API Multi-Worker Panel")
        self.root.attributes('-topmost', True)
        self.api = VsphoneAPI()
        self.pad_status_vars = {}
        
        self.main_frame = ttk.Frame(root, padding=5)
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        
        settings_frame = ttk.LabelFrame(self.main_frame, text="Login VSPhone & Data PAD", padding=5)
        settings_frame.pack(fill=tk.X, pady=(0, 5))
        
        # --- Sub-frame Login ---
        login_frame = ttk.Frame(settings_frame)
        login_frame.grid(row=0, column=0, sticky=tk.N, padx=5)
        
        ttk.Label(login_frame, text="Email:").grid(row=0, column=0, sticky=tk.E, padx=5, pady=1)
        self.email_var = tk.StringVar(value="ajaydiskets@gmail.com")
        ttk.Entry(login_frame, textvariable=self.email_var, width=25).grid(row=0, column=1, sticky=tk.W, pady=1)
        
        ttk.Label(login_frame, text="Password:").grid(row=1, column=0, sticky=tk.E, padx=5, pady=1)
        self.pass_var = tk.StringVar(value="Kingsstone45")
        ttk.Entry(login_frame, textvariable=self.pass_var, show="*", width=25).grid(row=1, column=1, sticky=tk.W, pady=1)
        
        self.login_btn = ttk.Button(login_frame, text="Login & Load PADs", command=self.do_login_and_load)
        self.login_btn.grid(row=2, column=1, sticky=tk.W, pady=2)
        
        self.login_status_label = ttk.Label(login_frame, text="")
        self.login_status_label.grid(row=3, column=0, columnspan=2, sticky=tk.W, pady=2)
        
        # --- Sub-frame PADs ---
        pads_frame = ttk.Frame(settings_frame)
        pads_frame.grid(row=0, column=1, sticky=tk.N, padx=15)
        
        ttk.Label(pads_frame, text="Kode PAD:").grid(row=0, column=0, sticky=tk.NE, padx=2, pady=1)
        self.pads_text = scrolledtext.ScrolledText(pads_frame, width=22, height=10)
        self.pads_text.grid(row=0, column=1, sticky=tk.NW, pady=1)
        
        default_pads = (
            "1. APP5BU4R71W6CIS1\n"
            "2. ACP66R7QM18JD5KS\n"
            "3. APP2510288HATY3C\n"
            "4. ATP5CP53SIW4YX35\n"
            "5. ATP250821VY19LFB\n"
            "6. ATP250820MKF0J96\n"
            "7. APP5BK4M19GODTT8\n"
            "8. ATP25080747GH0NK\n"
            "9. ACP61C5D13OXOHLE\n"
            "10. APP61459652OGLEL"
        )
        self.pads_text.insert(tk.END, default_pads)
        
        # --- Sub-frame Batch ---
        batch_frame = ttk.LabelFrame(settings_frame, text="Batch Action", padding=2)
        batch_frame.grid(row=0, column=2, sticky=tk.N, padx=15)
        
        cmds = list(COMMANDS.keys())
        current_row = 0
        for cmd in cmds:
            ttk.Button(batch_frame, text=cmd, command=lambda cmd=cmd: self.execute_cmd_batch(cmd)).grid(row=current_row, column=0, padx=2, pady=0, sticky=tk.EW)
            current_row += 1
            if cmd == "3. Reff":
                self.reff_var = tk.StringVar(value="masukan kode ref")
                ttk.Entry(batch_frame, textvariable=self.reff_var, width=15).grid(row=current_row, column=0, padx=2, pady=0, sticky=tk.EW)
                current_row += 1
                
        ttk.Separator(batch_frame, orient=tk.HORIZONTAL).grid(row=current_row, column=0, sticky=tk.EW, pady=3)
        current_row += 1
        ttk.Button(batch_frame, text="Terminate All", command=self.stop_cmd_batch).grid(row=current_row, column=0, padx=2, pady=0, sticky=tk.EW)
            
        self.devices_frame = ttk.Frame(self.main_frame)
        self.devices_frame.pack(fill=tk.BOTH, expand=True)

    def do_login_and_load(self):
        email = self.email_var.get().strip()
        pwd = self.pass_var.get().strip()
        pads_input = self.pads_text.get("1.0", tk.END).strip().split("\n")
        
        pads = []
        for p in pads_input:
            p = p.strip()
            if p:
                cleaned_p = re.sub(r'^\d+\.\s*', '', p)
                pads.append(cleaned_p)
        
        if not email or not pwd:
            self.login_status_label.config(text="Error: Email/Password kosong!", foreground="red")
            return
            
        if not pads:
            self.login_status_label.config(text="Error: Masukkan min. 1 PAD!", foreground="red")
            return
            
        self.login_status_label.config(text="Logging in...", foreground="blue")
        self.login_btn.config(state=tk.DISABLED)
        self.root.update()
        
        success, msg = self.api.login(email, pwd)
        self.login_btn.config(state=tk.NORMAL)
        
        if not success:
            self.login_status_label.config(text="Login Gagal!", foreground="red")
            return
            
        self.login_status_label.config(text="Login Sukses!", foreground="green")
        
        self.render_pad_panels(pads)

    def render_pad_panels(self, pads):
        for widget in self.devices_frame.winfo_children():
            widget.destroy()
            
        self.pad_status_vars.clear()
        
        max_cols = 5
        for idx, pad_code in enumerate(pads):
            r = idx // max_cols
            c = idx % max_cols
            short_name = pad_code[-6:] if len(pad_code) >= 6 else pad_code
            frame = ttk.LabelFrame(self.devices_frame, text=f"PAD {idx+1}\n{short_name}", padding=5)
            frame.grid(row=r, column=c, padx=3, pady=3, sticky=tk.N)
            
            status_var = tk.StringVar(value="Idle")
            self.pad_status_vars[pad_code] = status_var
            
            combo_var = tk.StringVar(value=list(COMMANDS.keys())[0])
            combo = ttk.Combobox(frame, textvariable=combo_var, values=list(COMMANDS.keys()), state="readonly", width=12)
            combo.pack(pady=2, fill=tk.X)
            
            ttk.Button(frame, text="Run", 
                       command=lambda c=pad_code, sv=status_var, cv=combo_var: self.execute_cmd(c, cv.get(), sv)).pack(pady=2, fill=tk.X)
            
            ttk.Button(frame, text="Terminate", 
                       command=lambda c=pad_code, sv=status_var: self.stop_cmd(c, sv)).pack(pady=2, fill=tk.X)
            
            ttk.Label(frame, textvariable=status_var, foreground="blue", width=16, anchor=tk.CENTER).pack(pady=2)
            
    def stop_cmd(self, pad_code, status_var):
        def _stop():
            status_var.set("Stopping...")
            # Menghentikan paksa proses sleep atau curl agar loop script langsung berhenti
            self.api.vcadb_exec(pad_code, "pkill sleep; pkill curl; killall sh", poll_timeout=10)
            status_var.set("Idle")
        threading.Thread(target=_stop, daemon=True).start()

    def execute_cmd(self, pad_code, cmd_name, status_var):
        reff = getattr(self, "reff_var", tk.StringVar()).get()
        thread = threading.Thread(target=run_adb_worker, args=(self.api, pad_code, cmd_name, status_var, reff), daemon=True)
        thread.start()

    def stop_cmd_batch(self):
        if not self.pad_status_vars:
            messagebox.showinfo("Info", "Silakan Login & Load PADs terlebih dahulu.")
            return
        for pad_code, status_var in self.pad_status_vars.items():
            self.stop_cmd(pad_code, status_var)

    def execute_cmd_batch(self, cmd_name):
        if not self.pad_status_vars:
            messagebox.showinfo("Info", "Silakan Login & Load PADs terlebih dahulu.")
            return
            
        reff = getattr(self, "reff_var", tk.StringVar()).get()
        for pad_code, status_var in self.pad_status_vars.items():
            thread = threading.Thread(target=run_adb_worker, args=(self.api, pad_code, cmd_name, status_var, reff), daemon=True)
            thread.start()

if __name__ == "__main__":
    root = tk.Tk()
    app = AdbManagerApp(root)
    root.mainloop()
