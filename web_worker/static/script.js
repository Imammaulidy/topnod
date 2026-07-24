document.addEventListener("DOMContentLoaded", () => {
    let commands = [];
    let padsList = [];
    let pollingInterval = null;
    let prevStatuses = {};
    let globalWasRunning = false;

    // Immediately show admin buttons if IS_ADMIN is set
    if (typeof IS_ADMIN !== 'undefined' && IS_ADMIN) {
        if(document.getElementById("btn-edit-scripts")) document.getElementById("btn-edit-scripts").style.display = "block";
        if(document.getElementById("btn-reboot-terminal")) document.getElementById("btn-reboot-terminal").style.display = "block";
        if(document.getElementById("btn-stop-terminal")) document.getElementById("btn-stop-terminal").style.display = "block";
        if(document.getElementById("btn-logout-panel")) document.getElementById("btn-logout-panel").style.display = "block";
    }

    function playBell() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    }

    const loginSection = document.getElementById("login-section");
    const dashboardSection = document.getElementById("dashboard-section");
    const loginStatus = document.getElementById("login-status");
    const padsGrid = document.getElementById("pads-grid");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const padsText = document.getElementById("pads-text");
    const rememberMe = document.getElementById("remember-me");
    
    // Load from localStorage
    if (localStorage.getItem("vsphone_email")) {
        emailInput.value = localStorage.getItem("vsphone_email");
    }
    if (localStorage.getItem("vsphone_password")) {
        passwordInput.value = localStorage.getItem("vsphone_password");
    }
    if (localStorage.getItem("vsphone_pads")) {
        padsText.value = localStorage.getItem("vsphone_pads");
    }
    if (localStorage.getItem("vsphone_remember") === "false") {
        rememberMe.checked = false;
    }
    
    const reffInput = document.getElementById("batch-reff-input");
    if (localStorage.getItem("vsphone_reff") && reffInput) {
        reffInput.value = localStorage.getItem("vsphone_reff");
    }
    if (reffInput) {
        reffInput.addEventListener("input", (e) => {
            localStorage.setItem("vsphone_reff", e.target.value);
        });
    }
    
    // Fetch Commands
    fetch("/api/commands")
        .then(res => res.json())
        .then(data => {
            commands = data.commands ? data.commands : Object.keys(data);
            
            // Urutkan berdasarkan angka di awal string
            commands.sort((a, b) => {
                const numA = parseInt(a.match(/^\d+/) ? a.match(/^\d+/)[0] : 0);
                const numB = parseInt(b.match(/^\d+/) ? b.match(/^\d+/)[0] : 0);
                return numA - numB;
            });
            
            const batchContainer = document.getElementById("batch-buttons-container");
            const reffInput = document.getElementById("batch-reff-input");
            
            commands.forEach(cmd => {
                const wrapper = document.createElement("div");
                wrapper.style.display = "flex";
                wrapper.style.alignItems = "stretch";
                wrapper.style.gap = "0";
                wrapper.style.flex = "1 1 auto";
                wrapper.style.margin = "5px";

                const chkLabel = document.createElement("label");
                chkLabel.style.display = "flex";
                chkLabel.style.alignItems = "center";
                chkLabel.style.padding = "0 10px";
                chkLabel.style.backgroundColor = "rgba(0,0,0,0.3)";
                chkLabel.style.border = "1px solid var(--border-color)";
                chkLabel.style.borderRight = "none";
                chkLabel.style.borderTopLeftRadius = "8px";
                chkLabel.style.borderBottomLeftRadius = "8px";
                chkLabel.style.cursor = "pointer";

                const chk = document.createElement("input");
                chk.type = "checkbox";
                chk.className = "batch-sequence-chk";
                chk.value = cmd;
                // Default checked matching original hardcoded sequence
                const defaultSeq = ["4. Reff", "5. Email", "6. Password", "7. Predict Sambo", "8. Logout"];
                if (defaultSeq.includes(cmd)) {
                    chk.checked = true;
                }

                chkLabel.appendChild(chk);

                const btn = document.createElement("button");
                btn.textContent = cmd;
                btn.className = "run-btn";
                btn.style.margin = "0";
                btn.style.flex = "1";
                btn.style.borderTopLeftRadius = "0";
                btn.style.borderBottomLeftRadius = "0";

                btn.onclick = () => {
                    const globalReff = document.getElementById("batch-reff-input") ? document.getElementById("batch-reff-input").value : "";
                    const batchId = Date.now().toString();
                    padsList.forEach(pad => {
                        const selectEl = document.getElementById(`select-${pad}`);
                        
                        const adbChk = document.getElementById(`adb-${pad}`);
                        if (adbChk && !adbChk.checked) return;
                        
                        if(selectEl) {
                            selectEl.value = cmd;
                            if(window.toggleReffInput) window.toggleReffInput(pad);
                        }
                        
                        const padReffEl = document.getElementById(`reff-${pad}`);
                        let padReffValue = padReffEl && padReffEl.value.trim() ? padReffEl.value.trim() : globalReff;
                        
                        fetch("/api/run", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ pad_code: pad, cmd_name: cmd, reff_code: padReffValue, loop_count: 1, batch_id: batchId })
                        });
                    });
                };
                wrapper.appendChild(chkLabel);
                wrapper.appendChild(btn);
                batchContainer.appendChild(wrapper);
                
                if (cmd.includes("Reff")) {
                    const batchReffContainer = document.getElementById("batch-reff-container");
                    if (batchReffContainer) {
                        batchReffContainer.style.display = "flex";
                    }
                }
            });
        });

    // Login
    document.getElementById("btn-login").addEventListener("click", () => {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const padsText = document.getElementById("pads-text").value;
        
        padsList = padsText.split("\n")
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(line => line.length > 0);
            
        if (!email || !password || padsList.length === 0) {
            loginStatus.textContent = "Mohon isi Email, Password, dan minimal 1 PAD.";
            loginStatus.style.color = "var(--danger)";
            return;
        }

        loginStatus.textContent = "Logging in...";
        loginStatus.style.color = "var(--primary)";
        
        fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                loginStatus.textContent = "Login Sukses! Memuat PADs...";
                loginStatus.className = "status-success";
                
                // Save or clear localStorage
                if (rememberMe.checked) {
                    localStorage.setItem("vsphone_email", email);
                    localStorage.setItem("vsphone_password", password);
                    localStorage.setItem("vsphone_pads", padsText);
                    localStorage.setItem("vsphone_remember", "true");
                } else {
                    localStorage.removeItem("vsphone_email");
                    localStorage.removeItem("vsphone_password");
                    localStorage.removeItem("vsphone_pads");
                    localStorage.setItem("vsphone_remember", "false");
                }
                
                setTimeout(() => {
                    loginSection.classList.add("hidden");
                    dashboardSection.classList.remove("hidden");
                    document.getElementById("btn-logout-panel").style.display = "block";
                    
                    if (typeof IS_ADMIN !== 'undefined' && IS_ADMIN) {
                        if(document.getElementById("btn-edit-scripts")) document.getElementById("btn-edit-scripts").style.display = "block";
                        if(document.getElementById("btn-reboot-terminal")) document.getElementById("btn-reboot-terminal").style.display = "block";
                        if(document.getElementById("btn-stop-terminal")) document.getElementById("btn-stop-terminal").style.display = "block";
                    } else {
                        if(document.getElementById("btn-edit-scripts")) document.getElementById("btn-edit-scripts").style.display = "none";
                        if(document.getElementById("btn-reboot-terminal")) document.getElementById("btn-reboot-terminal").style.display = "none";
                        if(document.getElementById("btn-stop-terminal")) document.getElementById("btn-stop-terminal").style.display = "none";
                    }

                    padsGrid.innerHTML = "";
                    renderPads();
                    startPolling();
                }, 1000);
            } else {
                loginStatus.textContent = "Gagal: " + data.msg;
                loginStatus.style.color = "var(--danger)";
            }
        })
        .catch(err => {
            loginStatus.textContent = "Error network";
            loginStatus.style.color = "var(--danger)";
        });
    });

    // Logout Panel
    document.getElementById("btn-logout-panel").addEventListener("click", () => {
        localStorage.removeItem("vsphone_remember");
        localStorage.removeItem("vsphone_email");
        localStorage.removeItem("vsphone_password");
        localStorage.removeItem("vsphone_pads");
        
        emailInput.value = "";
        passwordInput.value = "";
        padsText.value = "";
        rememberMe.checked = false;
        
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        
        dashboardSection.classList.add("hidden");
        loginSection.classList.remove("hidden");
        loginStatus.textContent = "";
        document.getElementById("btn-logout-panel").style.display = "none";
    });
    
    // Reboot Terminal
    const btnRebootTerminal = document.getElementById("btn-reboot-terminal");
    if (btnRebootTerminal) {
        btnRebootTerminal.addEventListener("click", () => {
            if (confirm("Yakin ingin me-reboot Server Terminal? Koneksi web akan terputus sesaat.")) {
                fetch("/api/reboot", { method: "POST" })
                    .then(() => {
                        alert("Server sedang di-reboot. Halaman akan dimuat ulang otomatis dalam 3 detik.");
                        setTimeout(() => location.reload(), 3000);
                    })
                    .catch(() => {
                        setTimeout(() => location.reload(), 3000);
                    });
            }
        });
    }

    // Stop Terminal
    const btnStopTerminal = document.getElementById("btn-stop-terminal");
    if (btnStopTerminal) {
        btnStopTerminal.addEventListener("click", () => {
            if (confirm("Yakin ingin MEMATIKAN Server Terminal secara permanen? Anda harus membukanya manual di PC/Termux nanti.")) {
                fetch("/api/stop-terminal", { method: "POST" })
                    .then(() => {
                        alert("Server telah dimatikan. Halaman ini sudah tidak terhubung lagi.");
                    })
                    .catch(() => {
                        alert("Server telah dimatikan. Halaman ini sudah tidak terhubung lagi.");
                    });
            }
        });
    }

    // Auto Login Check
    if (localStorage.getItem("vsphone_remember") === "true" && emailInput.value && passwordInput.value && padsText.value) {
        setTimeout(() => {
            document.getElementById("btn-login").click();
        }, 300);
    }
    
    // Global Selection Logic
    const selectAllCheckbox = document.getElementById("global-select-all");
    const btnInvertSelection = document.getElementById("btn-invert-selection");
    const selectionCounter = document.getElementById("selection-counter");

    window.updateSelectionCounter = function() {
        if (!padsList) return;
        const checkboxes = document.querySelectorAll(".pad-checkbox");
        let count = 0;
        checkboxes.forEach(chk => { if (chk.checked) count++; });
        if (selectionCounter) selectionCounter.textContent = `${count} Selected`;
        if (selectAllCheckbox) selectAllCheckbox.checked = (count === padsList.length && padsList.length > 0);
    };

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener("change", (e) => {
            const checkboxes = document.querySelectorAll(".pad-checkbox");
            checkboxes.forEach(chk => chk.checked = e.target.checked);
            updateSelectionCounter();
        });
    }

    if (btnInvertSelection) {
        btnInvertSelection.addEventListener("click", () => {
            const checkboxes = document.querySelectorAll(".pad-checkbox");
            checkboxes.forEach(chk => chk.checked = !chk.checked);
            updateSelectionCounter();
        });
    }

    // Manual Add PAD
    const btnManualAddPad = document.getElementById("btn-manual-add-pad");
    const manualAddPadInput = document.getElementById("manual-add-pad-input");
    if (btnManualAddPad && manualAddPadInput) {
        btnManualAddPad.addEventListener("click", () => {
            const newPad = manualAddPadInput.value.trim();
            if (!newPad) return;
            if (padsList.includes(newPad)) {
                alert("Kode PAD sudah ada di daftar!");
                return;
            }
            padsList.push(newPad);
            padsText.value = padsList.join('\n');
            if (rememberMe.checked) {
                localStorage.setItem("vsphone_pads", padsText.value);
            }
            renderPads();
            updateSelectionCounter();
            manualAddPadInput.value = "";
        });
    }



    // Render PADs
    function renderPads() {
        padsList.forEach((pad, index) => {
            let card = document.getElementById(`pad-card-${pad}`);
            if (!card) {
                const shortName = pad.length >= 6 ? pad.slice(-6) : pad;
                card = document.createElement("div");
                card.id = `pad-card-${pad}`;
                card.className = "pad-card";
                
                let optionsHtml = `<option value="Full Auto">-- Full Auto --</option>` + commands.map(cmd => `<option value="${cmd}">${cmd}</option>`).join("");
                
                card.innerHTML = `
                    <div class="pad-header">
                        <div style="display: flex; flex-direction: column;">
                            <span class="pad-title">PAD ${index + 1}</span>
                            <span class="pad-code" onclick="editPad('${pad}')" style="cursor: pointer;" title="Klik untuk Edit Kode PAD">${shortName} <span style="font-size:0.7em;">&#9998;</span></span>
                            <div class="pad-status" id="status-${pad}" style="margin-top: 5px; text-align: left; min-height: unset;">Idle</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label style="font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="adb-${pad}" class="pad-checkbox" checked onchange="updateSelectionCounter()"> ADB On
                            </label>
                            <span onclick="deletePad('${pad}')" style="cursor: pointer; color: #ef4444; font-size: 1.2rem; font-weight: bold; line-height: 1;" title="Hapus PAD">&times;</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                        <input type="text" id="manual-adb-${pad}" placeholder="Manual ADB..." style="flex: 1; padding: 6px; font-size: 0.8rem; background: rgba(0,0,0,0.3); color: white; border: 1px solid #f59e0b; border-radius: 4px; font-family: monospace; min-width: 0;">
                        <button onclick="runManualAdb('${pad}')" style="background-color: #f59e0b; color: white; border: none; border-radius: 4px; padding: 0 10px; font-weight: bold; cursor: pointer; font-size: 0.8rem; flex: 0 0 auto; width: auto;" title="Run Manual ADB">&gt;</button>
                    </div>

                    <select id="select-${pad}" onchange="toggleReffInput('${pad}')">
                        ${optionsHtml}
                    </select>
                    <input type="text" id="reff-${pad}" class="pad-reff-input" placeholder="Kode Reff" style="display:none;" />
                    <button class="run-btn" onclick="runCommand('${pad}')">Run</button>
                    <button class="stop-btn" onclick="stopCommand('${pad}')">Terminate</button>
                `;
                padsGrid.appendChild(card);
                if(window.toggleReffInput) window.toggleReffInput(pad);
            }
        });
        updateSelectionCounter();
    }

    // Edit PAD
    window.editPad = function(oldPad) {
        let newPad = prompt("Edit Kode PAD:", oldPad);
        if (!newPad) return;
        newPad = newPad.trim();
        if (newPad === oldPad) return;
        if (padsList.includes(newPad)) {
            alert("Kode PAD sudah ada di daftar!");
            return;
        }

        // Save current states
        const states = {};
        padsList.forEach(p => {
            states[p] = {
                adb: document.getElementById(`adb-${p}`)?.checked,
                sel: document.getElementById(`select-${p}`)?.value,
                reff: document.getElementById(`reff-${p}`)?.value
            };
        });

        // Update arrays & DOM texts
        const idx = padsList.indexOf(oldPad);
        if (idx !== -1) {
            padsList[idx] = newPad;
            states[newPad] = states[oldPad];
        }

        const padsText = document.getElementById("pads-text");
        if (padsText) padsText.value = padsList.join('\n');
        const rememberMe = document.getElementById("remember-me");
        if (rememberMe && rememberMe.checked) {
            localStorage.setItem("vsphone_pads", padsList.join('\n'));
        }

        // Re-render
        const padsGrid = document.getElementById("pads-grid");
        if (padsGrid) {
            padsGrid.innerHTML = "";
            renderPads();
            
            // Restore states
            padsList.forEach(p => {
                if (states[p]) {
                    const adb = document.getElementById(`adb-${p}`);
                    if (adb) adb.checked = states[p].adb;
                    
                    const sel = document.getElementById(`select-${p}`);
                    if (sel) {
                        sel.value = states[p].sel;
                        if(window.toggleReffInput) window.toggleReffInput(p);
                    }
                    
                    const reff = document.getElementById(`reff-${p}`);
                    if (reff) reff.value = states[p].reff;
                }
            });
        }
    }

    // Delete PAD
    window.deletePad = function(pad) {
        if (!confirm(`Hapus PAD ${pad}?`)) return;
        padsList = padsList.filter(p => p !== pad);
        
        const padsText = document.getElementById("pads-input");
        const rememberMe = document.getElementById("remember-me");
        if (padsText) {
            padsText.value = padsList.join('\n');
            if (rememberMe && rememberMe.checked) {
                localStorage.setItem("vsphone_pads", padsText.value);
            }
        }
        
        const card = document.getElementById(`pad-card-${pad}`);
        if (card) card.remove();
        
        padsList.forEach((p, i) => {
            const c = document.getElementById(`pad-card-${p}`);
            if (c) {
                const title = c.querySelector(".pad-title");
                if (title) title.textContent = `PAD ${i + 1}`;
            }
        });
        updateSelectionCounter();
    }

    // Toggle Reff Input visibility
    window.toggleReffInput = function(pad) {
        const selectEl = document.getElementById(`select-${pad}`);
        const reffEl = document.getElementById(`reff-${pad}`);
        if (selectEl && reffEl) {
            if (selectEl.value.includes("3. Reff")) {
                reffEl.style.display = "block";
            } else {
                reffEl.style.display = "none";
            }
        }
    }

    // Toggle ADB On/Off
    window.toggleAdb = function(pad) {
        const chk = document.getElementById(`adb-${pad}`);
        const statusEl = document.getElementById(`status-${pad}`);
        if (!chk.checked) {
            stopCommand(pad);
            if (statusEl) {
                statusEl.textContent = "ADB Off";
                statusEl.className = "pad-status status-error";
            }
        } else {
            if (statusEl) {
                statusEl.textContent = "Idle";
                statusEl.className = "pad-status";
            }
        }
    }

    // Run Manual ADB Single
    window.runManualAdb = function(pad) {
        const inputEl = document.getElementById(`manual-adb-${pad}`);
        if (!inputEl || !inputEl.value.trim()) return;
        
        fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pad_code: pad,
                cmd_name: "Manual ADB",
                reff_code: "",
                loop_count: 1,
                custom_command: inputEl.value.trim()
            })
        });
        
        inputEl.value = ""; // clear after running
    }

    // Run Command Single
    window.runCommand = function(pad) {
        // Allow solo running even if ADB toggle is off for batch actions
        
        const cmdName = document.getElementById(`select-${pad}`).value;
        const globalReff = document.getElementById("batch-reff-input").value;
        const padReff = document.getElementById(`reff-${pad}`).value.trim();
        const reffCode = padReff ? padReff : globalReff;
        const loopInput = document.getElementById("batch-loop-input");
        const loopCount = loopInput ? parseInt(loopInput.value) || 1 : 1;
        
        fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pad_code: pad, cmd_name: cmdName, reff_code: reffCode, loop_count: loopCount })
        });
    }

    // Stop Command Single
    window.stopCommand = function(pad) {
        fetch("/api/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pad_code: pad })
        });
    }

    // Batch Actions
    const btnFullAuto = document.getElementById("btn-batch-full-auto");
    const loopInput = document.getElementById("batch-loop-input");
    
    if (btnFullAuto) {
        btnFullAuto.addEventListener("click", () => {
            const checkboxes = document.querySelectorAll(".batch-sequence-chk:checked");
            const sequence = Array.from(checkboxes).map(c => c.value);
            if (sequence.length === 0) {
                alert("Pilih minimal 1 aksi (centang checkbox) untuk Full Auto!");
                return;
            }

            const globalReff = document.getElementById("batch-reff-input").value;
            const loopCount = loopInput ? parseInt(loopInput.value) || 1 : 1;
            const batchId = Date.now().toString();
            
            fetch("/api/clear_batch_map", { method: "POST" })
            .then(() => {
                padsList.forEach(pad => {
                    const adbChk = document.getElementById(`adb-${pad}`);
                    if (adbChk && !adbChk.checked) return;
                    
                    const padReffEl = document.getElementById(`reff-${pad}`);
                    const padReffValue = padReffEl && padReffEl.value.trim() ? padReffEl.value.trim() : globalReff;
                    
                    fetch("/api/run", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pad_code: pad, cmd_name: "Full Auto", sequence: sequence, reff_code: padReffValue, loop_count: loopCount, batch_id: batchId })
                    });
                });
            });
        });
    }

    // (Removed redundant batchContainer logic)

    const btnLoadTxt = document.getElementById("btn-load-txt");
    if (btnLoadTxt) {
        btnLoadTxt.addEventListener("click", () => {
            fetch("/api/load_reff_txt", { method: "POST" })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        alert(`Berhasil memuat ${data.count} kode Reff dari ref.txt!`);
                    } else {
                        alert(`Gagal: ${data.msg}`);
                    }
                });
        });
    }

    const btnPauseAuto = document.getElementById("btn-batch-pause");
    if (btnPauseAuto) {
        btnPauseAuto.addEventListener("click", () => {
            fetch("/api/pause", { method: "POST" })
                .then(res => res.json())
                .then(data => {
                    if (data.is_paused) {
                        btnPauseAuto.textContent = "▶";
                        btnPauseAuto.style.backgroundColor = "#10b981"; // green for resume
                        
                        // Show notification toast
                        const toast = document.createElement("div");
                        toast.textContent = "Sesi batch action (Full Auto) telah di JEDA.";
                        toast.style.position = "fixed";
                        toast.style.bottom = "20px";
                        toast.style.right = "20px";
                        toast.style.backgroundColor = "#f59e0b";
                        toast.style.color = "#fff";
                        toast.style.padding = "10px 20px";
                        toast.style.borderRadius = "5px";
                        toast.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
                        toast.style.zIndex = "9999";
                        document.body.appendChild(toast);
                        setTimeout(() => toast.remove(), 3000);
                        
                    } else {
                        btnPauseAuto.textContent = "⏸";
                        btnPauseAuto.style.backgroundColor = "#3b82f6"; // blue for pause
                        
                        const toast = document.createElement("div");
                        toast.textContent = "Sesi batch action DILANJUTKAN.";
                        toast.style.position = "fixed";
                        toast.style.bottom = "20px";
                        toast.style.right = "20px";
                        toast.style.backgroundColor = "#10b981";
                        toast.style.color = "#fff";
                        toast.style.padding = "10px 20px";
                        toast.style.borderRadius = "5px";
                        toast.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
                        toast.style.zIndex = "9999";
                        document.body.appendChild(toast);
                        setTimeout(() => toast.remove(), 3000);
                    }
                });
        });
    }

    const btnBatchTerminate = document.getElementById("btn-batch-terminate");
    if (btnBatchTerminate) {
        btnBatchTerminate.addEventListener("click", () => {
            padsList.forEach(pad => {
                fetch("/api/stop", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pad_code: pad })
                });
            });
        });
    }

    // Polling Status
    function startPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
            fetch("/api/status")
                .then(res => res.json())
                .then(data => {
                    const statuses = data.statuses || data;
                    const queueCount = data.queue_count || 0;
                    
                    const queueCountDisplay = document.getElementById("queue-count-display");
                    if (queueCountDisplay) {
                        queueCountDisplay.textContent = `Sisa Antrian Reff: ${queueCount}`;
                    }
                    
                    const qList = document.getElementById("queue-list-dropdown");
                    const queueData = data.queue;
                    if (qList && queueData !== undefined) {
                        qList.innerHTML = "";
                        if (queueData.length === 0) {
                            const opt = document.createElement("option");
                            opt.textContent = "Antrian Kosong";
                            qList.appendChild(opt);
                        } else {
                            queueData.forEach((item, index) => {
                                const opt = document.createElement("option");
                                opt.textContent = `${index + 1}. ${item}`;
                                opt.style.backgroundColor = "#0f172a";
                                opt.style.color = "#f8fafc";
                                qList.appendChild(opt);
                            });
                        }
                    }
                    
                    const logContainer = document.getElementById("reff-log-container");
                    if (logContainer && data.done_log) {
                        const logsHtml = data.done_log.map(log => `<div>${log}</div>`).join("");
                        if (logContainer.innerHTML !== logsHtml) {
                            logContainer.innerHTML = logsHtml;
                            logContainer.scrollTop = logContainer.scrollHeight;
                        }
                    }

                    for (const pad in statuses) {
                        const statusEl = document.getElementById(`status-${pad}`);
                        if (statusEl) {
                            statusEl.innerText = statuses[pad];
                            statusEl.className = "pad-status";
                            const st = statuses[pad];
                            if (st.includes("Running") || st.includes("Menunggu") || st.includes("Menggunakan")) {
                                statusEl.classList.add("status-running");
                            } else if (st.includes("Done")) {
                                statusEl.classList.add("status-done");
                            }
                            else if (st.includes("Error") || st.includes("Sibuk") || st.includes("Kosong")) {
                                statusEl.classList.add("status-error");
                            }
                        }
                    }

                    const anyRunning = Object.values(statuses).some(s => s !== "Idle" && !s.includes("Done") && !s.includes("Error Occurred"));
                    if (globalWasRunning && !anyRunning) {
                        const globalBell = document.getElementById("global-bell");
                        if (globalBell && globalBell.checked) {
                            playBell();
                        }
                    }
                    globalWasRunning = anyRunning;
                })
                .catch(err => console.error("Polling error", err));
        }, 1500);
    }
    
    // --- Manual ADB Logic ---
    const btnManualAdb = document.getElementById("btn-manual-adb");
    const manualAdbInput = document.getElementById("manual-adb-input");
    
    if (btnManualAdb && manualAdbInput) {
        btnManualAdb.onclick = () => {
            const cmdStr = manualAdbInput.value.trim();
            if (!cmdStr) {
                alert("Masukkan perintah ADB terlebih dahulu!");
                return;
            }
            
            padsList.forEach(pad => {
                const adbChk = document.getElementById(`adb-${pad}`);
                if (adbChk && !adbChk.checked) return;
                
                fetch("/api/run", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pad_code: pad, cmd_name: "Manual ADB", cmd_str: cmdStr })
                });
            });
            
            manualAdbInput.value = "";
        };
    }

    // --- Script Editor Logic ---
    let currentCommands = {};
    const btnEditScripts = document.getElementById("btn-edit-scripts");
    const editorModal = document.getElementById("editor-modal");
    const editorSelect = document.getElementById("editor-select");
    const editorTextarea = document.getElementById("editor-textarea");
    const btnCloseEditor = document.getElementById("btn-close-editor");
    const btnSaveEditor = document.getElementById("btn-save-editor");

    if (btnEditScripts) {
        btnEditScripts.onclick = async () => {
            try {
                const res = await fetch("/api/commands");
                currentCommands = await res.json();
                
                editorSelect.innerHTML = "";
                const sortedCmds = Object.keys(currentCommands).sort((a, b) => {
                    const numA = parseInt(a.match(/^\d+/) ? a.match(/^\d+/)[0] : 0);
                    const numB = parseInt(b.match(/^\d+/) ? b.match(/^\d+/)[0] : 0);
                    return numA - numB;
                });
                
                sortedCmds.forEach(cmd => {
                    const opt = document.createElement("option");
                    opt.value = cmd;
                    opt.textContent = cmd;
                    editorSelect.appendChild(opt);
                });
                
                if (Object.keys(currentCommands).length > 0) {
                    editorTextarea.value = currentCommands[Object.keys(currentCommands)[0]];
                }
                editorModal.style.display = "flex";
            } catch (err) {
                alert("Failed to load scripts: " + err);
            }
        };
    }

    if (editorSelect) {
        editorSelect.onchange = () => {
            const cmd = editorSelect.value;
            editorTextarea.value = currentCommands[cmd] || "";
        };
    }

    if (btnCloseEditor) {
        btnCloseEditor.onclick = () => {
            editorModal.style.display = "none";
        };
    }

    if (btnSaveEditor) {
        btnSaveEditor.onclick = async () => {
            const cmdName = editorSelect.value;
            const scriptContent = editorTextarea.value;
            try {
                const res = await fetch("/api/commands", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ cmd_name: cmdName, script: scriptContent })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Script untuk '${cmdName}' berhasil disimpan!`);
                    currentCommands[cmdName] = scriptContent;
                } else {
                    alert("Gagal menyimpan script!");
                }
            } catch (err) {
                alert("Error saving script: " + err);
            }
        };
    }
    
    // Restore Default Script
    const btnRestoreDefault = document.getElementById("btn-restore-default");
    if (btnRestoreDefault) {
        btnRestoreDefault.addEventListener("click", () => {
            if (confirm("Perhatian! Tindakan ini akan mereset SEMUA script ke pengaturan pabrik (default bawaan instalasi awal). Apakah Anda yakin?")) {
                btnRestoreDefault.textContent = "Restoring...";
                fetch("/api/commands/restore", {
                    method: "POST"
                })
                .then(res => res.json())
                .then(data => {
                    btnRestoreDefault.textContent = "Restore Default";
                    if (data.success) {
                        alert("Berhasil mengembalikan script ke versi Default (Pabrik)!");
                        location.reload(); 
                    } else {
                        alert("Gagal merestore script default.");
                    }
                })
                .catch(err => {
                    console.error(err);
                    btnRestoreDefault.textContent = "Restore Default";
                    alert("Terjadi kesalahan jaringan.");
                });
            }
        });
    }
    // --- Reff Extractor Logic ---
    const btnExtractor = document.getElementById("btn-extractor");
    const extractorModal = document.getElementById("extractor-modal");
    const btnCloseExtractor = document.getElementById("btn-close-extractor");
    const btnExtractAction = document.getElementById("btn-extract-action");
    const extractorInput = document.getElementById("extractor-input");
    const extractorOutput = document.getElementById("extractor-output");
    const btnCopyExtractor = document.getElementById("btn-copy-extractor");
    const btnAddQueue = document.getElementById("btn-add-queue");
    const btnClearQueue = document.getElementById("btn-clear-queue");
    const btnAddBulkQueue = document.getElementById("btn-add-bulk-queue");
    const bulkReffTextarea = document.getElementById("bulk-reff-textarea");

    if (btnClearQueue) {
        btnClearQueue.addEventListener("click", () => {
            if (confirm("Hapus semua antrian Reff?")) {
                fetch("/api/queue/clear", { method: "POST" });
            }
        });
    }
    
    if (btnAddBulkQueue && bulkReffTextarea) {
        btnAddBulkQueue.addEventListener("click", () => {
            const content = bulkReffTextarea.value.trim();
            if (!content) return;
            
            fetch("/api/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codes: content })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    bulkReffTextarea.value = "";
                }
            })
            .catch(err => {
                console.error("Bulk error:", err);
                alert("Gagal menambahkan antrian Reff.");
            });
        });
    }

    if (btnExtractor) {
        btnExtractor.addEventListener("click", () => {
            extractorModal.style.display = "flex";
            extractorInput.value = "";
            extractorOutput.value = "";
            btnCopyExtractor.style.display = "none";
            if (btnAddQueue) btnAddQueue.style.display = "none";
        });
    }

    if (btnCloseExtractor) {
        btnCloseExtractor.addEventListener("click", () => {
            extractorModal.style.display = "none";
        });
    }

    if (btnExtractAction) {
        btnExtractAction.addEventListener("click", () => {
            const text = extractorInput.value;
            // Regex to find TRPH4_ followed by alphanumeric characters
            const regex = /TRPH4_[A-Z0-9]+/g;
            const matches = text.match(regex);
            
            if (matches && matches.length > 0) {
                // Return original matched codes joined by newline
                extractorOutput.value = matches.join("\n");
                btnCopyExtractor.style.display = "block";
                if (btnAddQueue) btnAddQueue.style.display = "block";
                btnCopyExtractor.textContent = "Copy Hasil";
                if (btnAddQueue) btnAddQueue.textContent = "Kirim ke Antrian";
            } else {
                extractorOutput.value = "Tidak ada kode Reff (TRPH4_...) yang ditemukan.";
                btnCopyExtractor.style.display = "none";
                if (btnAddQueue) btnAddQueue.style.display = "none";
            }
        });
    }

    if (btnAddQueue) {
        btnAddQueue.addEventListener("click", () => {
            const codes = extractorOutput.value.split("\n").filter(c => c.trim().startsWith("TRPH4_"));
            if (codes.length > 0) {
                fetch("/api/queue", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ codes: codes })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        btnAddQueue.textContent = `Berhasil dikirim (${codes.length})!`;
                        setTimeout(() => { 
                            btnAddQueue.textContent = "Kirim ke Antrian";
                            extractorModal.style.display = "none";
                        }, 1500);
                    }
                });
            }
        });
    }

    if (btnCopyExtractor) {
        btnCopyExtractor.addEventListener("click", () => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(extractorOutput.value).then(() => {
                    btnCopyExtractor.textContent = "Copied!";
                    setTimeout(() => { btnCopyExtractor.textContent = "Copy Hasil"; }, 2000);
                }).catch(() => {
                    extractorOutput.select();
                    document.execCommand("copy");
                    btnCopyExtractor.textContent = "Copied!";
                    setTimeout(() => { btnCopyExtractor.textContent = "Copy Hasil"; }, 2000);
                });
            } else {
                extractorOutput.select();
                document.execCommand("copy");
                btnCopyExtractor.textContent = "Copied!";
                setTimeout(() => { btnCopyExtractor.textContent = "Copy Hasil"; }, 2000);
            }
        });
    }

    // --- Cloud APK Install Logic ---
    const btnOpenCloudApk = document.getElementById("btn-open-cloud-apk");
    const cloudApkModal = document.getElementById("cloud-apk-modal");
    const btnCloseCloudApk = document.getElementById("btn-close-cloud-apk");
    const btnInstallCloudApk = document.getElementById("btn-install-cloud-apk");
    const cloudApkSelect = document.getElementById("cloud-apk-select");
    
    let loadedApks = [];

    if (btnOpenCloudApk) {
        btnOpenCloudApk.addEventListener("click", () => {
            cloudApkModal.style.display = "flex";
            cloudApkSelect.innerHTML = '<option value="">Mengambil data APK dari server...</option>';
            btnInstallCloudApk.disabled = true;
            
            fetch("/api/cloud_files")
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.files && data.files.length > 0) {
                        loadedApks = data.files;
                        cloudApkSelect.innerHTML = "";
                        loadedApks.forEach((apk, idx) => {
                            const sizeMb = (apk.fileSize / 1024 / 1024).toFixed(1);
                            const opt = document.createElement("option");
                            opt.value = idx;
                            opt.textContent = `${apk.fileName} (${sizeMb} MB)`;
                            cloudApkSelect.appendChild(opt);
                        });
                        btnInstallCloudApk.disabled = false;
                    } else {
                        cloudApkSelect.innerHTML = '<option value="">Tidak ada APK di Cloud Storage</option>';
                        btnInstallCloudApk.disabled = true;
                    }
                })
                .catch(err => {
                    cloudApkSelect.innerHTML = '<option value="">Gagal memuat data APK</option>';
                    btnInstallCloudApk.disabled = true;
                });
        });
    }

    if (btnCloseCloudApk) {
        btnCloseCloudApk.addEventListener("click", () => {
            cloudApkModal.style.display = "none";
        });
    }

    if (btnInstallCloudApk) {
        btnInstallCloudApk.addEventListener("click", () => {
            const selectedIdx = cloudApkSelect.value;
            if (selectedIdx === "") return;
            const apkInfo = loadedApks[selectedIdx];
            
            let selectedCount = 0;
            padsList.forEach(pad => {
                const adbChk = document.getElementById(`adb-${pad}`);
                if (adbChk && !adbChk.checked) return;
                selectedCount++;
                
                fetch("/api/install_apk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pad_code: pad, apk_info: apkInfo })
                });
            });
            
            if (selectedCount > 0) {
                alert(`Perintah Install APK '${apkInfo.fileName}' dikirim ke ${selectedCount} PAD.`);
                cloudApkModal.style.display = "none";
            } else {
                alert("Tidak ada PAD yang dipilih (centang ADB On).");
            }
        });
    }

});
