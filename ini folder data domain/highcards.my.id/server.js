require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const { exec } = require('child_process');
const imaps = require('imap-simple');

async function getMicrosoftVerificationCode() {
    const config = {
        imap: {
            user: 'teleproyek2@gmail.com',
            password: 'hctz evao ogbb ijbx',
            host: 'imap.gmail.com',
            port: 993,
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false }
        }
    };
    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');
        for (let i = 0; i < 12; i++) {
            const searchCriteria = ['UNSEEN'];
            const fetchOptions = { bodies: [''], markSeen: true };
            const messages = await connection.search(searchCriteria, fetchOptions);
            if (messages && messages.length > 0) {
                for (const msg of messages) {
                    const part = msg.parts.find(p => p.which === '');
                    if (part) {
                        const text = String(part.body);
                        if (text.toLowerCase().includes('microsoft')) {
                            const match7 = text.match(/\b(\d{7})\b/);
                            if (match7) {
                                connection.end();
                                return match7[1];
                            }
                            const match4 = text.match(/(?:code|kode|sandi).*?\b(\d{4,6})\b/is);
                            if (match4) {
                                connection.end();
                                return match4[1];
                            }
                        }
                    }
                }
            }
            await new Promise(r => setTimeout(r, 5000));
        }
        connection.end();
        return null;
    } catch (e) {
        console.error('IMAP Error:', e);
        return null;
    }
}

async function fetchOtpViaImap(email, password, sessionName = 'default') {
    const config = {
        imap: {
            user: email,
            password: password,
            host: 'outlook.office365.com',
            port: 993,
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false }
        }
    };
    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');
        
        broadcastLog(`[Sistem] Koneksi IMAP berhasil. Mencari pesan terbaru...`, 'info', sessionName);
        
        const blacklist = ['232259', '232817', '232673', '142158', '175774', '160855', '160858', '000000', '725188'];
        
        for (let i = 0; i < 6; i++) {
            const searchCriteria = ['UNSEEN'];
            const fetchOptions = { bodies: ['TEXT'], markSeen: true };
            const messages = await connection.search(searchCriteria, fetchOptions);
            
            if (messages && messages.length > 0) {
                // Urutkan terbaru
                messages.sort((a, b) => new Date(b.attributes.date) - new Date(a.attributes.date));
                for (const msg of messages) {
                    const textPart = msg.parts.find(p => p.which === 'TEXT');
                    if (textPart) {
                        const text = String(textPart.body);
                        let m = text.match(/(?:verification|code|kode|sandi|otp)[^\d]{0,150}?\b(\d{6})\b/i);
                        if (m && !blacklist.includes(m[1])) {
                            connection.end();
                            return m[1];
                        }
                        let fallbacks = text.match(/\b\d{6}\b/g);
                        if (fallbacks) {
                            for (let f of fallbacks) {
                                if (!blacklist.includes(f)) {
                                    connection.end();
                                    return f;
                                }
                            }
                        }
                    }
                }
            }
            await new Promise(r => setTimeout(r, 2000)); // Tunggu 2 detik per iterasi
        }
        connection.end();
        return null;
    } catch (e) {
        broadcastLog(`[Sistem] IMAP ditolak (Auth Error/Basic Auth diblokir): ${e.message}`, 'error', sessionName);
        return null;
    }
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ACCESS_CODES_FILE = path.join(__dirname, 'Fitur_KodeAkses', 'access_codes.json');
const VMOS_CONFIG_FILE = path.join(__dirname, 'Fitur_InventMoney', 'vmos_config.json');

function getAccountsFile(sessionName = 'default') {
    return path.join(__dirname, 'Fitur_OutlookOTP', `accounts_${sessionName}.txt`);
}
function getValidAccountsFile(sessionName = 'default') {
    return path.join(__dirname, 'Fitur_OutlookOTP', `valid_accounts_${sessionName}.txt`);
}

function cleanProfileCache(sessionName, email) {
    if (!sessionName || !email) return;
    const profilePath = path.join(__dirname, 'profiles', sessionName, email);
    const cachePaths = [
        path.join(profilePath, 'Default', 'Cache'),
        path.join(profilePath, 'Default', 'Code Cache'),
        path.join(profilePath, 'Default', 'GPUCache'),
        path.join(profilePath, 'Default', 'Service Worker', 'CacheStorage'),
        path.join(profilePath, 'Default', 'Service Worker', 'ScriptCache'),
    ];
    cachePaths.forEach(p => {
        if (fs.existsSync(p)) {
            try {
                fs.rmSync(p, { recursive: true, force: true });
            } catch (e) {
                // Ignore if locked
            }
        }
    });
}

function authMiddleware(req, res, next) {
    const publicPaths = ['/login.html', '/api/login', '/style.css', '/app.js', '/favicon.ico'];
    if (publicPaths.includes(req.path) || req.path.startsWith('/api/logs') || !req.path.startsWith('/api')) {
        return next();
    }
    
    const authHeader = req.headers.authorization || req.query.token;
    let token = '';
    if (authHeader) {
        token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
    }
    
    if (!token) {
        return res.status(401).json({ error: 'Kode Akses diperlukan.' });
    }
    
    if (fs.existsSync(ACCESS_CODES_FILE)) {
        try {
            const codes = JSON.parse(fs.readFileSync(ACCESS_CODES_FILE, 'utf-8'));
            if (codes[token]) {
                req.sessionName = codes[token].sessionName;
                req.role = codes[token].role;
                return next();
            }
        } catch(e) {}
    }
    
    return res.status(401).json({ error: 'Kode Akses tidak valid.' });
}

app.use(authMiddleware);

function getVmosConfig(sessionName = 'default') {
    const file = path.join(__dirname, 'Fitur_InventMoney', `vmos_config_${sessionName}.json`);
    if (fs.existsSync(file)) {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch(e) {}
    }
    if (fs.existsSync(VMOS_CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(VMOS_CONFIG_FILE, 'utf-8'));
        } catch(e) {}
    }
    return { 
        email: '', password: '', machineId: '', enabled: false,
        emailX: '400', emailY: '600',
        submitX: '850', submitY: '600',
        otpX: '540', otpY: '600'
    };
}


        
async function vcadb_exec(command, config, token, userid, BASE) {
    try {
        const adbRes = await fetch(`${BASE}/vcAdb/asyncAdb`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Clienttype': 'web',
                'Appversion': '2003602',
                'Requestsource': 'wechat-miniapp',
                'Suppliertype': '0',
                'token': token,
                'userid': userid
            },
            body: JSON.stringify({
                padCodes: [config.machineId],
                adbStr: command
            })
        });
        const adbData = await adbRes.json();
        return adbData.code === 200;
    } catch (e) {
        return false;
    }
}

async function prepareInventMoney(email, config, token, userid, BASE) {
    broadcastLog(`[Worker 2] Memulai registrasi InventMoney untuk ${email}...`, 'info');
    
    // 1. Set Resolusi
    await vcadb_exec("wm size 720x1280 && wm density 360", config, token, userid, BASE);
    await sleep(2000);
    
    // 2. Buka Link Referral via X Browser
    await vcadb_exec(`am start -a android.intent.action.VIEW -d "https://app.inventmoney.com/r/OFXBR8SK"`, config, token, userid, BASE);
    broadcastLog(`[Worker 2] Menunggu 12 detik agar halaman web termuat...`, 'info');
    await sleep(12000);
    
    // 3. Tap kolom Email
    await vcadb_exec(`input tap ${config.emailX} ${config.emailY}`, config, token, userid, BASE);
    await sleep(1500);
    
    // 4. Ketik Email
    await vcadb_exec(`input text ${email}`, config, token, userid, BASE);
    await sleep(1500);
    
    // 5. Tap Submit
    await vcadb_exec(`input tap ${config.submitX} ${config.submitY}`, config, token, userid, BASE);
    await sleep(1000);
    
    // Tambahan ENTER untuk memastikan form terkirim
    await vcadb_exec("input keyevent 66", config, token, userid, BASE);
    
    broadcastLog(`[Worker 2] Submit ditekan. Menunggu OTP dari Worker 1...`, 'success');
}

async function injectOtpToVMOS(otpCode) {
    const config = getVmosConfig();
    if (!config.enabled || !config.email || !config.password || !config.machineId) {
        return;
    }

    try {
        const BASE = 'https://api.vsphone.com/vsphone/api';
        const passMd5 = crypto.createHash('md5').update(config.password).digest('hex');

        const loginRes = await fetch(`${BASE}/user/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Clienttype': 'web',
                'Appversion': '2003602',
                'Requestsource': 'wechat-miniapp',
                'Suppliertype': '0'
            },
            body: JSON.stringify({
                mobilePhone: config.email,
                loginType: 1,
                password: passMd5,
                channel: "web"
            })
        });

        const loginData = await loginRes.json();
        if (loginData.code !== 200) return;

        const token = loginData.data.token;
        const userid = String(loginData.data.userId);

        // Tap OTP input box before injecting
        await vcadb_exec(`input tap ${config.otpX} ${config.otpY}`, config, token, userid, BASE);
        await sleep(1000);

        const success = await vcadb_exec(`input text ${otpCode}`, config, token, userid, BASE);
        
        if (success) {
            broadcastLog(`[VMOS] ✔️ Perintah Injeksi OTP (${otpCode}) berhasil terkirim ke Cloud Phone!`, 'success');
        } else {
            broadcastLog(`[VMOS] ❌ Gagal injeksi OTP`, 'error');
        }
    } catch (e) {
        broadcastLog(`[VMOS] ❌ Error menghubungi API VSPhone: ${e.message}`, 'error');
    }
}
// Server-Sent Events for logs
let clients = [];

let isMassLoginPaused = false;
let isMassLoginStopped = false;
let isMassLoginRunning = false;
let loopResumeResolve = null;
let resumeResolves = [];

function waitForLoopResume() {
    return new Promise(resolve => loopResumeResolve = resolve);
}

function waitForResume() {
    return new Promise(resolve => {
        resumeResolves.push(resolve);
    });
}

app.post('/api/pause', (req, res) => {
    isMassLoginPaused = true;
    broadcastLog("[Sistem] Proses akan dijeda setelah akun yang sedang berjalan selesai.", "warning");
    res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
    isMassLoginStopped = true;
    isMassLoginPaused = false;
    if (loopResumeResolve) {
        loopResumeResolve();
        loopResumeResolve = null;
    }
    broadcastLog("[Sistem] Proses dihentikan paksa oleh pengguna.", "error");
    res.json({ success: true });
});

app.post('/api/resume', (req, res) => {
    isMassLoginPaused = false;
    if (loopResumeResolve) {
        loopResumeResolve();
        loopResumeResolve = null;
    }
    if (resumeResolves.length > 0) {
        resumeResolves.forEach(resolve => resolve());
        resumeResolves = [];
    }
    res.json({ success: true });
});

function broadcastLog(message, type = 'info', sessionName = 'default') {
    const data = JSON.stringify({ type, message });
    clients.forEach(client => {
        if (client.role === 'admin' || client.sessionName === sessionName || sessionName === 'all') {
            client.res.write(`data: ${data}\n\n`);
        }
    });
    if (type === 'error') {
        console.error(`[${sessionName}] ${message}`);
    } else {
        console.log(`[${sessionName}] ${message}`);
    }
}

app.get('/api/logs', (req, res) => {
    const token = req.query.token;
    let sessionName = 'default';
    let role = 'user';
    if (token && fs.existsSync(ACCESS_CODES_FILE)) {
        try {
            const codes = JSON.parse(fs.readFileSync(ACCESS_CODES_FILE, 'utf-8'));
            if (codes[token]) {
                sessionName = codes[token].sessionName;
                role = codes[token].role;
            }
        } catch(e) {}
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    clients.push({ id: Date.now(), sessionName, role, res });
    
    req.on('close', () => {
        clients = clients.filter(client => client.res !== res);
    });
});

const otpHistory = [];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readAccounts(sessionName = 'default') {
    const file = getAccountsFile(sessionName);
    if (!fs.existsSync(file)) {
        return [];
    }
    const content = fs.readFileSync(file, 'utf-8');
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line && line.includes(':'))
        .map(line => {
            const [email, password] = line.split(':');
            return { email, password };
        });
}

async function checkActiveSession(account, sessionName = 'default') {
    const profilePath = path.join(__dirname, 'profiles', sessionName, account.email);
    let browserContext = null;
    try {
        cleanProfileCache(sessionName, account.email);
        browserContext = await chromium.launchPersistentContext(profilePath, {
            headless: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            args: ['--disable-features=PasswordManager', '--disk-cache-size=1', '--media-cache-size=1', '--disable-gpu-shader-disk-cache']
        });
        const page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();
        await page.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(2000);
        const currentUrl = page.url();
        if (currentUrl.includes('mail/0') || currentUrl.includes('inbox')) {
            return true;
        }
        return false;
    } catch (e) {
        return false;
    } finally {
        if (browserContext) {
            try {
                await browserContext.close();
            } catch(err){}
        }
        cleanProfileCache(sessionName, account.email);
    }
}

async function checkAccount(account, sessionName = 'default') {
    if (isMassLoginStopped) return;
    
    const log = (msg, type = 'info') => broadcastLog(msg, type, sessionName);
    
    log(`\n--- Memulai proses untuk ${account.email} ---`);
    const startTime = Date.now();
    let browserContext = null;

    let page = null;
    try {
        log(`[Worker 1] Membuka Outlook untuk ${account.email}...`);
        const sessionsDir = path.join(__dirname, 'sessions');
        if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
        const stateFile = path.join(sessionsDir, `${account.email}.json`);
        
        browserContext = await chromium.launch({
            headless: true,
            args: ['--disable-features=PasswordManager']
        });
        
        const context = await browserContext.newContext({
            storageState: fs.existsSync(stateFile) ? stateFile : undefined,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        page = await context.newPage();

        await page.addInitScript(() => {
            window.PublicKeyCredential = undefined;
        });

        await page.goto('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=9199bf20-a13f-4107-85dc-02114787ef48&scope=https%3A%2F%2Foutlook.office.com%2F.default%20openid%20profile%20offline_access&redirect_uri=https%3A%2F%2Foutlook.live.com%2Fmail%2F&client-request-id=b2d733a9-bbf3-0e1e-8e1d-e4ceeb94f9f5&response_mode=fragment&client_info=1&clidata=1&prompt=select_account&nonce=019e8c69-94fb-77a6-b3fc-618f9280f488&state=eyJpZCI6IjAxOWU4YzY5LTk0ZmEtNzdkMS1iYjM2LTZlMTBiMjg3MWUzYSIsIm1ldGEiOnsiaW50ZXJhY3Rpb25UeXBlIjoicmVkaXJlY3QifX0%3D%7CaHR0cHM6Ly9vdXRsb29rLmxpdmUuY29tL21haWwvP2N1bHR1cmU9ZW4tdXMmY291bnRyeT11cw&claims=%7B%22access_token%22%3A%7B%22xms_cc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&x-client-SKU=msal.js.browser&x-client-VER=5.8.0&response_type=code&code_challenge=hRJ6c5b95-hMMf_-LDA3IreIhrgr9kwg-JwH5dYnG4c&code_challenge_method=S256&cobrandid=ab0455a0-8d03-46b9-b18b-df2f57b9e44c&fl=dob%2Cflname%2Cwld', { waitUntil: 'domcontentloaded' });

        try {
            const signInBtn = page.locator('a[href*="LinkID=2125442"], a[data-task="signin"], a[aria-label="Sign in to Outlook"], a:has-text("Sign in"), text="Sign in"').first();
            await signInBtn.waitFor({ state: 'visible', timeout: 12000 });
            broadcastLog(`[Worker 2] Membantu menembus tembok, menekan tombol Sign in...`);
            await signInBtn.click();
            await sleep(4000);
            
            // Ambil tab terbaru (karena tombol Sign in terkadang membuka tab baru)
            const pages = context.pages();
            page = pages[pages.length - 1];
        } catch (e) {
            // Abaikan jika tidak ada tombol Sign in (berarti langsung masuk ke form login)
        }

        try {
            await page.waitForSelector('input[type="email"], input[name="loginfmt"], #i0116', { timeout: 15000 });
            await sleep(1000);
            await page.fill('input[type="email"], input[name="loginfmt"], #i0116', account.email);
            await sleep(500);
            await page.click('input[type="submit"], button[type="submit"], #idSIButton9');
            await sleep(2000);
        } catch (e) {
            if (page.url().includes('account-checkup') || page.url().includes('ar/cancel')) {
                broadcastLog(`[${account.email}] Akun terkena limit/terkunci (Account Checkup).`, 'error');
                return;
            }
            broadcastLog(`[${account.email}] Form email tidak muncul, mencoba lanjut ke Inbox...`, 'warning');
        }

        try {
            const hasError = await page.$('#usernameError');
            if (hasError) {
                 const errorText = await page.innerText('#usernameError');
                 if (errorText.trim().length > 0) {
                     broadcastLog(`[${account.email}] Gagal: ${errorText.trim()}`, 'error');
                     return;
                 }
            }
        } catch (e) {}

        for (let i = 0; i < 5; i++) {
            try {
                const btn = page.locator('span[role="button"]:has-text("Use your password"):visible, span[role="button"]:has-text("Gunakan sandi Anda"):visible, #idA_PWD_SwitchToPassword:visible').first();
                if (await btn.count() > 0) {
                    broadcastLog(`[${account.email}] Mem-bypass tembok verifikasi "Use your password"...`);
                    await btn.click();
                    await sleep(2000);
                    break;
                }
            } catch (e) {}
            await sleep(1500);
        }

        try {
            await page.waitForSelector('input[name="passwd"], input[type="password"]', { state: 'visible', timeout: 15000 });
            await sleep(1500);
            await page.fill('input[name="passwd"], input[type="password"]', account.password);
            await sleep(500);
            await page.click('input[type="submit"], button[type="submit"], #idSIButton9');
            await sleep(2000);
        } catch (e) {
            broadcastLog(`[${account.email}] Form password tidak muncul, mencoba lanjut...`, 'warning');
        }

        try {
            const hasPasswordError = await page.$('#passwordError');
            if (hasPasswordError) {
                if (account.password === 'masuk123') {
                    broadcastLog(`[${account.email}] Password "masuk123" salah! Mencoba ulang dengan "Masuk123"...`, 'warning');
                    await page.fill('input[name="passwd"], input[type="password"]', 'Masuk123');
                    await sleep(500);
                    await page.click('input[type="submit"], button[type="submit"], #idSIButton9');
                    await sleep(2000);
                    
                    const hasPasswordError2 = await page.$('#passwordError');
                    if (hasPasswordError2) {
                        broadcastLog(`[${account.email}] Password "Masuk123" juga salah!`, 'error');
                        return;
                    }
                } else {
                    broadcastLog(`[${account.email}] Password salah!`, 'error');
                    return;
                }
            }
        } catch (e) {}

        try {
            const staySignedIn = page.locator('text="Stay signed in?", text="Tetap masuk?"');
            if (await staySignedIn.isVisible({ timeout: 5000 })) {
                await page.click('#idSIButton9, input[value="Yes"], button:has-text("Yes"), button:has-text("Ya")');
                await sleep(2000);
            }
        } catch (e) {}

        try {
            const isVerification = page.locator('#idDiv_SAOTCS_Title');
            if (await isVerification.isVisible({ timeout: 2000 })) {
                 broadcastLog(`[${account.email}] Butuh verifikasi tambahan. Dilewati.`, 'warning');
                 return;
            }
        } catch (e) {}

        try {
            const privacyNotice = page.locator('text="A quick note about your Microsoft account"');
            if (await privacyNotice.isVisible({ timeout: 3000 })) {
                await page.click('button:has-text("Continue"), button:has-text("OK"), #idBtn_Accept');
                await sleep(2000);
            }
        } catch (e) {}

        broadcastLog(`[${account.email}] Mengarahkan ke Inbox...`);
        await page.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded' });
        
        if (page.url().includes('privacynotice')) {
            try {
                broadcastLog(`[${account.email}] Menyetujui Privacy Notice...`);
                await page.click('button:has-text("Continue"), button:has-text("OK"), #idBtn_Accept, button');
                await sleep(3000);
                await page.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded' });
            } catch (e) {}
        }

        await sleep(4000);

        // Verifikasi apakah benar-benar berhasil masuk ke Inbox
        const currentUrl = page.url();
        if (!currentUrl.includes('mail') && !currentUrl.includes('outlook.live.com')) {
            throw new Error('Gagal memuat halaman Inbox. Akun mungkin terblokir atau butuh verifikasi (Nomor HP/Captcha).');
        }

        log(`[+] [${account.email}] LOGIN SUKSES! Akun Valid.`, 'success');
        fs.appendFileSync(getValidAccountsFile(sessionName), `${account.email}:${account.password}\n`);

    } catch (err) {
        log(`[${account.email}] Membutuhkan verifikasi (Captcha/Nomor HP).`, 'warning');
        
        if (browserContext) {
            try { await context.storageState({ path: path.join(__dirname, 'sessions', `${account.email}.json`) }); } catch(e){}
            await browserContext.close();
            cleanProfileCache(sessionName, account.email);
        }

        log(`[${account.email}] Membuka browser mode Terlihat (Visible)...`, 'info');
        const profilePath = path.join(__dirname, 'profiles', sessionName, account.email);
        cleanProfileCache(sessionName, account.email);
        browserContext = await chromium.launchPersistentContext(profilePath, {
            headless: false,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            args: ['--disable-features=PasswordManager', '--disk-cache-size=1', '--media-cache-size=1', '--disable-gpu-shader-disk-cache']
        });
        
        page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();
        await page.goto('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=9199bf20-a13f-4107-85dc-02114787ef48&scope=https%3A%2F%2Foutlook.office.com%2F.default%20openid%20profile%20offline_access&redirect_uri=https%3A%2F%2Foutlook.live.com%2Fmail%2F&client-request-id=b2d733a9-bbf3-0e1e-8e1d-e4ceeb94f9f5&response_mode=fragment&client_info=1&clidata=1&prompt=select_account&nonce=019e8c69-94fb-77a6-b3fc-618f9280f488&state=eyJpZCI6IjAxOWU4YzY5LTk0ZmEtNzdkMS1iYjM2LTZlMTBiMjg3MWUzYSIsIm1ldGEiOnsiaW50ZXJhY3Rpb25UeXBlIjoicmVkaXJlY3QifX0%3D%7CaHR0cHM6Ly9vdXRsb29rLmxpdmUuY29tL21haWwvP2N1bHR1cmU9ZW4tdXMmY291bnRyeT11cw&claims=%7B%22access_token%22%3A%7B%22xms_cc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&x-client-SKU=msal.js.browser&x-client-VER=5.8.0&response_type=code&code_challenge=hRJ6c5b95-hMMf_-LDA3IreIhrgr9kwg-JwH5dYnG4c&code_challenge_method=S256&cobrandid=ab0455a0-8d03-46b9-b18b-df2f57b9e44c&fl=dob%2Cflname%2Cwld', { waitUntil: 'domcontentloaded' });

        try {
            log(`[Worker 2] Memasukkan email & password otomatis di browser manual...`);
            const emailInput = page.locator('input[type="email"], input[name="loginfmt"]');
            await emailInput.waitFor({ state: 'visible', timeout: 8000 });
            await emailInput.fill(account.email);
            await sleep(500);
            await page.click('input[type="submit"], button[type="submit"], #idSIButton9');
            await sleep(3000);
            
            const passInput = page.locator('input[name="passwd"], input[type="password"]');
            if (await passInput.isVisible({ timeout: 5000 })) {
                await passInput.fill(account.password);
                await sleep(500);
                await page.click('input[type="submit"], button[type="submit"], #idSIButton9');
                await sleep(3000);
            }
        } catch (e) {
            log(`[Worker 2] Info: Tidak dapat memasukkan kredensial otomatis (mungkin halaman sudah login atau butuh Captcha di awal).`);
        }

        log(`[${account.email}] PAUSE: Silakan selesaikan manual di browser. Jika sudah di kotak masuk, klik tombol 'Lanjutkan' di UI.`, 'warning');
        log(`ACTION:SHOW_RESUME`, 'action');
        
        await waitForResume();
        log(`[${account.email}] Melanjutkan proses pengecekan...`);

        try {
            await page.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded', timeout: 15000 });
            await sleep(3000);
            if (page.url().includes('mail/0')) {
                log(`[+] [${account.email}] LOGIN SUKSES via Manual!`, 'success');
                fs.appendFileSync(getValidAccountsFile(sessionName), `${account.email}:${account.password}\n`);
            } else {
                log(`[${account.email}] Gagal verifikasi manual. Dilewati.`, 'error');
            }
        } catch (e) {
            log(`[${account.email}] Timeout saat verifikasi manual.`, 'error');
        }
    } finally {
        if (browserContext) await browserContext.close();
        cleanProfileCache(sessionName, account.email);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`[${account.email}] Proses selesai dalam ${duration} detik.\n`);
    }
}

async function startLoginCheck(sessionName) {
    const log = (msg, type = 'info') => broadcastLog(msg, type, sessionName);
    
    if (isMassLoginRunning) {
        log("[Sistem] Antrian pengecekan login sedang berjalan.", "warning");
        return false;
    }
    isMassLoginRunning = true;
    isMassLoginStopped = false;
    isMassLoginPaused = false;
    
    // Jalankan automasi login di background
    (async () => {
        try {
            log("[Sistem] === MEMULAI LOG-IN SESI MASAL (BACKGROUND AUTOMATION) ===");
            let accounts = readAccounts(sessionName);
            if (accounts.length === 0) {
                log("[Sistem] File accounts.txt kosong atau tidak ada.", "error");
                isMassLoginRunning = false;
                return;
            }

            log(`[Sistem] Menemukan total ${accounts.length} akun. Memproses...`);

            const validFile = getValidAccountsFile(sessionName);
            for (const account of accounts) {
                if (isMassLoginStopped) {
                    log(`[Sistem] Pengecekan dihentikan secara paksa.`, 'error');
                    break;
                }

                while (isMassLoginPaused) {
                    log(`[Sistem] Pengecekan sedang dijeda...`, 'warning');
                    await waitForLoopResume();
                    log(`[Sistem] Melanjutkan antrian pengecekan login...`);
                }

                if (isMassLoginStopped) break;

                const profilePath = path.join(__dirname, 'profiles', sessionName, account.email);
                let hasSession = fs.existsSync(profilePath);
                let inValidFile = false;
                if (fs.existsSync(validFile)) {
                    const validContent = fs.readFileSync(validFile, 'utf-8');
                    inValidFile = validContent.split('\n').some(line => line.startsWith(account.email + ':'));
                }

                if (hasSession && inValidFile) {
                    log(`[Sistem] Memverifikasi apakah sesi ${account.email} masih aktif...`);
                    const isSessionActive = await checkActiveSession(account, sessionName);
                    if (isSessionActive) {
                        log(`[Sistem] Sesi ${account.email} masih aktif. Dilewati.`, 'success');
                        continue;
                    } else {
                        log(`[Sistem] Sesi ${account.email} kedaluwarsa. Melakukan login ulang...`, 'warning');
                    }
                }

                log(`[Sistem] Membuka browser untuk login: ${account.email}...`);
                await checkAccount(account, sessionName);
                await sleep(2000);
            }

            log("[Sistem] === PROSES LOG-IN SESI MASAL SELESAI ===", "success");
        } catch (e) {
            log(`[Sistem] Error during mass login check: ${e.message}`, 'error');
        } finally {
            isMassLoginRunning = false;
            // Broadcast ke frontend agar tombol kembali normal
            broadcastLog('[Selesai] Semua akun dicek', 'info', sessionName);
        }
    })();

    return true;
}

app.post('/api/run-login-check', async (req, res) => {
    const sessionName = req.sessionName;
    const started = await startLoginCheck(sessionName);
    if (started) {
        res.json({ success: true, message: "Login check started" });
    } else {
        res.json({ success: false, message: "Sudah berjalan" });
    }
});

app.get('/api/valid-accounts', (req, res) => {
    const sessionName = req.sessionName;
    const currentAccounts = readAccounts(sessionName);
    const emails = currentAccounts.map(acc => acc.email);
    res.json(emails);
});

app.post('/api/action', async (req, res) => {
    const { email, actionType, isHeadless: clientHeadless, otpService } = req.body;
    const sessionName = req.sessionName;
    const log = (msg, type = 'info') => broadcastLog(msg, type, sessionName);
    
    res.json({ success: true });

    log(`\n[Sistem] Membuka browser untuk: ${email}...`);
    
    const profilePathToOpen = path.join(__dirname, 'profiles', sessionName, email);
    
    // Cari password langsung dari accounts_[sessionName].txt
    const accounts = readAccounts(sessionName);
    const accObj = accounts.find(a => a.email === email);
    let selectedPassword = accObj ? accObj.password : "";

    if (!selectedPassword) {
        log(`[ERROR] Password tidak ditemukan untuk ${email} di accounts.txt!`, 'error');
        return;
    }

    // (IMAP dihapus, langsung gunakan Turbo Browser)

    let openContext = null;
    try {
        cleanProfileCache(sessionName, email);
        const isHeadless = clientHeadless !== undefined ? clientHeadless : (actionType === 'extract_otp' || actionType === 'extract_otp_test' || actionType === 'login_only');
        openContext = await chromium.launchPersistentContext(profilePathToOpen, {
            headless: isHeadless,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: null,
            args: ['--disable-features=PasswordManager', '--disk-cache-size=1', '--media-cache-size=1', '--disable-gpu-shader-disk-cache']
        });

        let openPage = openContext.pages().length > 0 ? openContext.pages()[0] : await openContext.newPage();
        
        if (isHeadless) {
            await openPage.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (['image', 'media', 'font'].includes(type)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });
        }

        log(`[Sistem] Menuju kotak masuk...`);
        await openPage.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded' });
        
        let targetState = null;
        for (let i = 0; i < 60; i++) {
            let currentUrl = openPage.url();
            if (currentUrl.includes('microsoft.com') || currentUrl.includes('microsoft-365')) {
                targetState = 'promo'; break;
            }
            if (currentUrl.includes('login.live.com') || currentUrl.includes('login.microsoftonline.com')) {
                targetState = 'login'; break;
            }
            if (await openPage.locator('div[role="option"], [aria-label*="Message list"]').isVisible().catch(()=>false)) {
                targetState = 'inbox'; break;
            }
            await sleep(1000);
        }

        if (targetState === 'promo') {
            log(`[Sistem] Halaman promo terdeteksi! Memaksa pindah ke halaman Login...`);
            await openPage.goto('https://login.live.com/', { waitUntil: 'domcontentloaded' });
            await sleep(2000);
            targetState = 'login';
        }
        
        let isLoginRequired = (targetState === 'login');
        if (!isLoginRequired && targetState !== 'inbox') {
            // Fallback check
            if (openPage.url().includes('login.live.com') || openPage.url().includes('login.microsoftonline.com')) {
                isLoginRequired = true;
            }
        }
        
        if (isLoginRequired) {
            broadcastLog(`[Sistem] Terdeteksi halaman login! Memasukkan password otomatis...`);
            try {
                const emailInput = openPage.locator('input[type="email"], input[name="loginfmt"], #i0116');
                await emailInput.waitFor({ state: 'visible', timeout: 10000 });
                await emailInput.fill(email);
                await openPage.click('input[type="submit"], button[type="submit"], #idSIButton9');
                await sleep(2000);
                
                // Check if account is blocked/not found
                const usernameError = await openPage.$('#usernameError');
                if (usernameError) {
                    const errText = await openPage.evaluate(el => el.innerText, usernameError);
                    if (errText && errText.trim() !== '') {
                        throw new Error(`Gagal lanjut ke password. Error Microsoft: ${errText.trim()}`);
                    }
                }
            } catch (e) {
                if (e.message.includes('Gagal lanjut ke password')) {
                    throw e; // Lemparkan error agar ditangkap blok luar
                }
                // Jika error timeout email input, abaikan (mungkin sudah di halaman password)
            }

            for (let i = 0; i < 5; i++) {
                try {
                    const btn = openPage.locator('span[role="button"]:has-text("Use your password"):visible, span[role="button"]:has-text("Gunakan sandi Anda"):visible, #idA_PWD_SwitchToPassword:visible').first();
                    if (await btn.count() > 0) {
                        broadcastLog(`[Sistem] Mem-bypass tembok verifikasi "Use your password"...`);
                        await btn.click();
                        await sleep(2000);
                        break;
                    }
                } catch (e) {}
                await sleep(1500);
            }

            let passInput;
            try {
                passInput = openPage.locator('input[name="passwd"], input[type="password"], #i0118');
                await passInput.waitFor({ state: 'visible', timeout: 8000 });
            } catch (err) {
                throw new Error("Gagal menemukan kolom password (Timeout). Akun mungkin terkunci, terblokir, atau membutuhkan verifikasi nomor HP.");
            }
            
            await passInput.fill(selectedPassword);
            await sleep(500);
            await openPage.evaluate(() => {
                const btn = document.querySelector('#idSIButton9') || document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                if (btn) btn.click();
            });
            broadcastLog(`[Sistem] Password berhasil disuntikkan!`);
            await sleep(2000);
            
            try {
                const hasPasswordError = await openPage.$('#passwordError');
                if (hasPasswordError) {
                    if (selectedPassword === 'masuk123') {
                        broadcastLog(`[Sistem] Password "masuk123" salah! Mencoba ulang dengan "Masuk123"...`, 'warning');
                        await passInput.fill('Masuk123');
                        await sleep(500);
                        await openPage.evaluate(() => {
                            const btn = document.querySelector('#idSIButton9') || document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                            if (btn) btn.click();
                        });
                        await sleep(2000);
                        
                        const hasPasswordError2 = await openPage.$('#passwordError');
                        if (hasPasswordError2) {
                            throw new Error(`Password salah! ("Masuk123" dan "masuk123" ditolak)`);
                        }
                    } else {
                        throw new Error(`Password salah! (${selectedPassword} ditolak)`);
                    }
                }
            } catch(e) {
                if (e.message && e.message.includes('Password salah')) {
                    throw e; // Lemparkan ke try-catch paling luar untuk menghentikan proses
                }
            }
            

            let nextAction = null;
            for (let i = 0; i < 15; i++) {
                let currentUrl = openPage.url();
                if (currentUrl.startsWith('https://outlook.live.com/mail')) { nextAction = 'inbox'; break; }
                if (currentUrl.includes('account.live.com/proofs')) { await sleep(3000); break; }
                if (currentUrl.includes('privacynotice')) { nextAction = 'privacy'; break; }
                if (await openPage.locator('#idSIButton9, input[value="Yes"], button:has-text("Yes")').isVisible()) { nextAction = 'kmsi'; break; }
                if (await openPage.locator('a[id="idBtn_Back"], a:has-text("Skip for now"), a:has-text("Lewati")').isVisible()) { nextAction = 'skip'; break; }
                await sleep(1000);
            }

            if (nextAction === 'skip') {
                broadcastLog(`[Sistem] Melewati pengingat keamanan (Skip for now)...`);
                await openPage.click('a[id="idBtn_Back"], a:has-text("Skip for now"), a:has-text("Lewati")', { noWaitAfter: true });
                await sleep(3000);
                if (await openPage.locator('#idSIButton9, input[value="Yes"], button:has-text("Yes")').isVisible({timeout: 3000})) {
                    await openPage.click('#idSIButton9, input[value="Yes"], button:has-text("Yes")', { noWaitAfter: true });
                    await sleep(3000);
                }
            } else if (nextAction === 'privacy') {
                broadcastLog(`[Sistem] Mem-bypass halaman Privacy Notice putih...`);
                await openPage.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded' });
                await sleep(3000);
            } else if (nextAction === 'kmsi') {
                broadcastLog(`[Sistem] Menyetujui 'Stay signed in?'...`);
                await openPage.click('#idSIButton9, input[value="Yes"], button:has-text("Yes")', { noWaitAfter: true });
                await sleep(3000);
            }
        }

        // CEK TEMBOK KEAMANAN TINGKAT 2 (Recovery Email)
        try {
            if (openPage.url().includes('account.live.com/proofs')) {
                broadcastLog(`[Worker] Terdeteksi Tembok Keamanan Tingkat 2. Mencoba bypass langsung ke kotak masuk...`, 'warning');
                await openPage.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded' });
                await sleep(3000);
            }
        } catch(e) {}

        // CEK SALAH SASARAN KE ACCOUNT DASHBOARD
        try {
            if (openPage.url().includes('account.microsoft.com')) {
                broadcastLog(`[Sistem] Terdampar di halaman profil Microsoft. Memaksa pindah ke Kotak Masuk...`, 'warning');
                await openPage.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded' });
                await sleep(3000);
            }
        } catch(e) {}

        let isInboxOpen = false;
        try {
            await openPage.waitForSelector('div[role="option"]', { state: 'visible', timeout: 8000 });
            isInboxOpen = true;
        } catch (e) {
            if (openPage.url().includes('mail/0') || openPage.url().includes('inbox')) {
                isInboxOpen = true;
            }
        }

        if (!isInboxOpen) {
            broadcastLog(`[!] Inbox belum terbuka. Akun mungkin terblokir atau membutuhkan verifikasi (Nomor HP/Captcha).`, 'warning');
            broadcastLog(`[INFO] Jendela browser dibiarkan terbuka. Silakan selesaikan login/verifikasi secara manual (Waktu: 5 Menit).`, 'info');
            try {
                await openPage.waitForSelector('div[role="option"]', { state: 'visible', timeout: 300000 });
                broadcastLog(`[SUKSES] Verifikasi manual berhasil! Kotak masuk berhasil dibuka!`, 'success');
                isInboxOpen = true;
            } catch (err) {
                broadcastLog(`[Sistem] Waktu tunggu manual habis. Menutup browser.`, 'error');
                await openContext.close();
                cleanProfileCache(sessionName, email);
                return;
            }
        } else {
            broadcastLog(`[SUKSES] Kotak masuk berhasil dibuka!`, 'success');
        }

        if (actionType === 'login_only') {
            broadcastLog(`[SUKSES] Sesi login untuk ${email} berhasil disimpan!`, 'success');
            broadcastLog(`[Sistem] Menutup browser dalam 5 detik...`);
            await sleep(5000);
            await openContext.close();
            cleanProfileCache(sessionName, email);
            return;
        }

        if (actionType === 'extract_otp_test') {
            broadcastLog(`[Sistem] [Test OTP] Menunggu daftar email termuat...`);
            
            let otpCode = null;
            let finalBodyText = "";
            
            for (let attempt = 0; attempt < 30; attempt++) {
                broadcastLog(`[Sistem] [Test OTP] Mencari pesan dari Google (Percobaan ${attempt + 1}/30)...`);
                
                // Cari email dari Google
                const googleEmailRow = openPage.locator('div[role="option"]:has-text("Google"), div[aria-label*="Google"]').first();
                if (await googleEmailRow.isVisible().catch(()=>false)) {
                    broadcastLog(`[Sistem] Ditemukan pesan dari Google! Mengklik pesan untuk membukanya...`);
                    await googleEmailRow.click();
                    await sleep(3000);
                    
                    // Ekstrak text dari message body
                    const msgBody = openPage.locator('div[aria-label="Message body"], div.ReadingPane, div.itemPartBody, div[role="document"], div[aria-label="Isi pesan"]').first();
                    let bodyText = "";
                    if (await msgBody.isVisible().catch(()=>false)) {
                        bodyText = await msgBody.innerText();
                    } else {
                        bodyText = await openPage.locator('body').innerText().catch(() => "");
                    }
                    finalBodyText = bodyText;
                    
                    let m = bodyText.match(/(?:verification|code|kode|sandi|otp)[^\d]{0,150}?\b(\d{6})\b/i);
                    if (m && m[1] !== '000000') {
                        otpCode = m[1];
                        broadcastLog(`[Sistem] OTP disadap dari DALAM isi pesan Google: ${otpCode}`);
                    } else {
                        let fallbacks = bodyText.match(/\b\d{6}\b/g);
                        if (fallbacks && fallbacks.length > 0) {
                            otpCode = fallbacks[0];
                            broadcastLog(`[Sistem] OTP ditemukan via brute-force isi pesan: ${otpCode}`);
                        }
                    }
                    
                    if (otpCode) break;
                }

                const refreshBtn = openPage.locator('button[title="Check for new messages"], button[title="Refresh"]').first();
                if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await refreshBtn.click();
                } else {
                    await openPage.keyboard.press('F5');
                }
                await sleep(5000);
            }

            if (otpCode) {
                otpHistory.push({ email: email, otp: otpCode, body: (finalBodyText || "").substring(0, 500), sessionName });
                log(`🔥 OTP GOOGLE DITEMUKAN: ${otpCode} 🔥`, 'success');
            } else {
                otpHistory.push({ email: email, otp: "Tidak ada", body: (finalBodyText || "").substring(0, 500), sessionName });
                log(`[!] Gagal menemukan OTP Google setelah 30x percobaan.`, 'warning');
            }
            
            log(`[Sistem] Menutup browser secara otomatis...`);
            await openContext.close();
            cleanProfileCache(sessionName, email);
        } else if (actionType === 'extract_otp') {
            broadcastLog(`[Sistem] Menunggu daftar email dimuat (WebSocket Sync)...`);
            
            const blacklist = ['232259', '232817', '232673', '142158', '175774', '160855', '160858', '000000', '725188'];
            
            const extractWithContext = (text) => {
                if (!text) return null;
                let m = text.match(/(?:verification|code|kode|sandi|otp)[^\d]{0,150}?\b(\d{6})\b/i);
                if (m && !blacklist.includes(m[1])) return m[1];
                let fallbacks = text.match(/\b\d{6}\b/g);
                if (fallbacks) {
                    for (let f of fallbacks) {
                        if (!blacklist.includes(f)) return f;
                    }
                }
                return null;
            };

            let otpCode = null;
            let finalBodyText = "";
            const serviceName = (otpService || 'topnod').toLowerCase();
            
            for (let attempt = 0; attempt < 30; attempt++) {
                broadcastLog(`[Sistem] Mencari OTP ${serviceName.toUpperCase()} (Percobaan ${attempt + 1}/30)...`);
                
                // STRATEGI 0: Buka Pesan Teratas (Paling Akurat untuk menghindari teks terpotong)
                const serviceRow = openPage.locator(`div[role="option"]:has-text("${serviceName}" i), div[aria-label*="${serviceName}" i], span:text-is("${serviceName}" i)`).first();
                if (await serviceRow.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await serviceRow.click();
                    await sleep(1500); // Tunggu animasi pesan terbuka
                    const bodyText = await openPage.locator('body').innerText().catch(() => "");
                    otpCode = extractWithContext(bodyText);
                    if (otpCode) {
                        broadcastLog(`[Sistem] OTP disadap dari Pesan ${serviceName.toUpperCase()} Teratas: ${otpCode}`);
                        finalBodyText = bodyText;
                        break;
                    }
                }

                // STRATEGI 1: Aria Label (Filter spesifik untuk layanan yang dipilih)
                const ariaLabels = await openPage.evaluate((svc) => {
                    return Array.from(document.querySelectorAll('[aria-label]'))
                        .map(el => el.getAttribute('aria-label'))
                        .filter(label => label.toLowerCase().includes(svc))
                        .join(' | ');
                }, serviceName);
                otpCode = extractWithContext(ariaLabels);
                if (otpCode) {
                    broadcastLog(`[Sistem] OTP disadap dari Aria-Label (Gambar 2): ${otpCode}`);
                    finalBodyText = ariaLabels;
                    break;
                }

                // STRATEGI 2: Message List
                const messageListLocator = openPage.locator('[aria-label="Message list" i], [aria-label="Daftar pesan" i], [role="listbox"]').first();
                if (await messageListLocator.isVisible().catch(()=>false)) {
                    let listText = await messageListLocator.innerText();
                    if (listText.toLowerCase().includes(serviceName)) {
                        otpCode = extractWithContext(listText);
                        if (otpCode) {
                            broadcastLog(`[Sistem] OTP disadap dari Teks Daftar Pesan (Gambar 2): ${otpCode}`);
                            finalBodyText = listText;
                            break;
                        }
                    }
                }
                
                // STRATEGI 3: Sapu bersih (Brutal)
                const allText = await openPage.locator('body').innerText().catch(() => "");
                if (allText.toLowerCase().includes(serviceName)) {
                    otpCode = extractWithContext(allText);
                    if (otpCode) {
                        broadcastLog(`[Sistem] OTP disadap dari Sapu Bersih Layar: ${otpCode}`);
                        finalBodyText = allText;
                        break;
                    }
                }

                // Jika belum ketemu, refresh dan tunggu
                const refreshBtn = openPage.locator('button[title="Check for new messages"], button[title="Refresh"]').first();
                if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await refreshBtn.click();
                } else {
                    await openPage.keyboard.press('F5');
                }
                await sleep(5000);
            }

            if (otpCode) {
                otpHistory.push({ email: email, otp: otpCode, body: (finalBodyText || "").substring(0, 500), sessionName });
                log(`🔥 OTP DITEMUKAN: ${otpCode} 🔥`, 'success');
            } else {
                otpHistory.push({ email: email, otp: "Tidak ada", body: (finalBodyText || "").substring(0, 500), sessionName });
                log(`[!] Gagal menemukan OTP 6-digit setelah 30x percobaan (150 detik).`, 'warning');
            }
            
            log(`[Sistem] Menutup browser secara otomatis...`);
            await openContext.close();
            cleanProfileCache(sessionName, email);
        } else {
            log(`[INFO] Biarkan UI ini terbuka selama Anda membaca email. Tutup browsernya sendiri jika sudah selesai.`);
        }
    } catch (e) {
        log(`[Sistem] Error saat membuka kotak masuk: ${e.message}`, 'error');
    } finally {
        if ((actionType === 'extract_otp' || actionType === 'extract_otp_test') && openContext) {
            try {
                await openContext.close();
            } catch(err){}
            cleanProfileCache(sessionName, email);
        }
    }
});

app.get('/api/otp-history', (req, res) => {
    const filtered = otpHistory.filter(item => item.sessionName === req.sessionName);
    res.json(filtered.map(item => ({ email: item.email, otp: item.otp, body: item.body })));
});

app.post('/api/flush-otp', (req, res) => {
    for (let i = otpHistory.length - 1; i >= 0; i--) {
        if (otpHistory[i].sessionName === req.sessionName) {
            otpHistory.splice(i, 1);
        }
    }
    res.json({ success: true });
});

app.post('/api/kill-browsers', (req, res) => {
    const sessionName = req.sessionName;
    const log = (msg, type = 'info') => broadcastLog(msg, type, sessionName);
    log("[Sistem] Mematikan paksa semua proses browser Chromium yang menyangkut...", "warning");
    exec('taskkill /F /IM chrome.exe /T', (error, stdout, stderr) => {
        if (error) {
            log(`[Sistem] Tidak ada proses browser yang menyangkut atau gagal mematikan: ${error.message}`, "info");
        } else {
            log(`[Sistem] Semua proses Chromium berhasil dibersihkan!`, "success");
        }
    });
    res.json({ success: true });
});

app.post('/api/ban-account', (req, res) => {
    const { email } = req.body;
    const sessionName = req.sessionName;
    const log = (msg, type = 'info') => broadcastLog(msg, type, sessionName);
    if (!email) return res.status(400).json({ error: "Email wajib diisi." });

    const accountsFile = getAccountsFile(sessionName);
    if (fs.existsSync(accountsFile)) {
        let lines = fs.readFileSync(accountsFile, 'utf-8').split('\n');
        let modified = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(email + ':') && !lines[i].trimEnd().endsWith('-BAN')) {
                lines[i] = lines[i].trimEnd() + '-BAN';
                modified = true;
                break; 
            }
        }
        if (modified) {
            fs.writeFileSync(accountsFile, lines.join('\n'));
            log(`[Sistem] Akun ${email} telah di-BAN.`, "warning");
            return res.json({ success: true });
        }
    }
    res.status(404).json({ error: "Akun tidak ditemukan atau sudah di-BAN." });
});

app.post('/api/add-accounts', (req, res) => {
    const { accounts: newAccounts } = req.body;
    const sessionName = req.sessionName;
    const log = (msg, type = 'info') => broadcastLog(msg, type, sessionName);
    
    if (!Array.isArray(newAccounts) || newAccounts.length === 0) {
        return res.status(400).json({ error: "Tidak ada akun yang valid untuk ditambahkan." });
    }
    
    const currentAccounts = readAccounts(sessionName);
    const existingEmails = new Set(currentAccounts.map(acc => acc.email));
    
    let addedCount = 0;
    let textToAppend = '';

    for (const acc of newAccounts) {
        if (!existingEmails.has(acc.email)) {
            textToAppend += `\n${acc.email}:${acc.password}`;
            existingEmails.add(acc.email);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        fs.appendFileSync(getAccountsFile(sessionName), textToAppend);
        log(`[Sistem] Berhasil menambahkan ${addedCount} akun baru.`, "success");
    } else {
        log(`[Sistem] Tidak ada akun baru yang ditambahkan (semua sudah ada).`, "warning");
    }
    
    res.json({ success: true, addedCount });
});

app.post('/api/flush-valid', (req, res) => {
    const sessionName = req.sessionName;
    try {
        fs.writeFileSync(getValidAccountsFile(sessionName), '');
        fs.writeFileSync(getAccountsFile(sessionName), '');
        
        const profilesDir = path.join(__dirname, 'profiles', sessionName);
        if (fs.existsSync(profilesDir)) {
            fs.rmSync(profilesDir, { recursive: true, force: true });
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



function generateRandomUsername() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let str = 'user';
    for(let i=0; i<6; i++) str += chars[Math.floor(Math.random() * chars.length)];
    return str;
}

app.post('/api/run-invent-register', async (req, res) => {
    const { email } = req.body;
    const sessionName = req.sessionName;
    const log = (msg, type = 'info') => broadcastLog(msg, type, sessionName);
    
    res.json({ success: true, message: "InventMoney registration started" });

    const config = getVmosConfig(sessionName);
    if (!config.enabled || !config.email || !config.password || !config.machineId) {
        log(`[ERROR] Konfigurasi VMOS belum lengkap. Silakan isi di Pengaturan.`, 'error');
        return;
    }

    log(`[Sistem] === MEMULAI INVENTMONEY HYBRID WORKER ===`);
    log(`[Sistem] Akun Target: ${email}`, 'info');

    try {
        const BASE = 'https://api.vsphone.com/vsphone/api';
        const passMd5 = crypto.createHash('md5').update(config.password).digest('hex');

        log(`[ADB] Menyambungkan ke VMOS...`);
        const loginRes = await fetch(`${BASE}/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Clienttype': 'web', 'Appversion': '2003602', 'Requestsource': 'wechat-miniapp', 'Suppliertype': '0' },
            body: JSON.stringify({ mobilePhone: config.email, loginType: 1, password: passMd5, channel: "web" })
        });
        const loginData = await loginRes.json();
        
        if (loginData.code !== 200) {
            log(`[ERROR] Gagal login VMOS API. Cek email/password VMOS.`, 'error');
            return;
        }

        const token = loginData.data.token;
        const userId = String(loginData.data.userId);

        const emailX = config.emailX || "400";
        const emailY = config.emailY || "600";
        const submitX = config.submitX || "850";
        const submitY = config.submitY || "600";
        const otpX = config.otpX || "540";
        const otpY = config.otpY || "600";
        const usernameX = config.usernameX || "500";
        const usernameY = config.usernameY || "700";

        // TAHAP 1: KETIK EMAIL VIA ADB
        log(`[ADB] Mengetuk kolom Email (X:${emailX}, Y:${emailY})`);
        await vcadb_exec(`input tap ${emailX} ${emailY}`, config, token, userId, BASE);
        await sleep(1500);

        log(`[ADB] Mengetikkan email: ${email}`);
        await vcadb_exec(`input text ${email}`, config, token, userId, BASE);
        await sleep(1500);

        log(`[ADB] Mengetuk tombol Submit (X:${submitX}, Y:${submitY})`);
        await vcadb_exec(`input tap ${submitX} ${submitY}`, config, token, userId, BASE);
        await sleep(2000);

        log(`[Sistem] Menunggu layar OTP di VMOS... Memulai Worker Outlook (PC)`);

        // TAHAP 2: BACA OTP VIA BROWSER (TURBO MODE)
        let otpFound = null;
        let openContext = null;

        const profilePathToOpen = path.join(__dirname, 'profiles', sessionName, email);
        if (!fs.existsSync(profilePathToOpen)) {
            log(`[ERROR] Sesi login untuk ${email} belum dibuat! Silakan lakukan 'Mengekstrak OTP' pada akun ini terlebih dahulu agar sistem melakukan login pertama kali.`, 'error');
        } else {
            try {
                    cleanProfileCache(sessionName, email);
                    openContext = await chromium.launchPersistentContext(profilePathToOpen, {
                        headless: true,
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        viewport: null,
                        args: ['--disable-features=PasswordManager', '--disk-cache-size=1', '--media-cache-size=1', '--disable-gpu-shader-disk-cache']
                    });
                    
                    let openPage = openContext.pages().length > 0 ? openContext.pages()[0] : await openContext.newPage();
                    
                    await openPage.route('**/*', (route) => {
                        const type = route.request().resourceType();
                        if (['image', 'media', 'font'].includes(type)) {
                            route.abort();
                        } else {
                            route.continue();
                        }
                    });

                    log(`[Worker 2] Membuka kotak masuk Outlook untuk mencari OTP TopNod...`);
                    await openPage.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded' });
                    
                    let targetState = null;
                    for (let i = 0; i < 60; i++) {
                        let currentUrl = openPage.url();
                        if (currentUrl.includes('microsoft.com') || currentUrl.includes('microsoft-365')) {
                            targetState = 'promo'; break;
                        }
                        if (currentUrl.includes('login.live.com') || currentUrl.includes('login.microsoftonline.com')) {
                            targetState = 'login'; break;
                        }
                        if (await openPage.locator('div[role="option"], [aria-label*="Message list"]').isVisible().catch(()=>false)) {
                            targetState = 'inbox'; break;
                        }
                        await sleep(1000);
                    }

                    if (targetState === 'promo') {
                        log(`[Worker 2] Halaman promo terdeteksi! Memaksa pindah ke halaman Login...`);
                        await openPage.goto('https://login.live.com/', { waitUntil: 'domcontentloaded' });
                        await sleep(2000);
                        targetState = 'login';
                    }

                    // CEK TEMBOK KEAMANAN TINGKAT 2 (Recovery Email)
                    try {
                        if (openPage.url().includes('account.live.com/proofs')) {
                            log(`[Worker 2] Terdeteksi Tembok Keamanan Tingkat 2. Mencoba bypass langsung ke kotak masuk...`, 'warning');
                            await openPage.goto('https://outlook.live.com/mail/0/inbox', { waitUntil: 'domcontentloaded' });
                            await sleep(3000);
                        }
                    } catch(e) {}
                    
                    for (let attempt = 0; attempt < 30; attempt++) {
                        log(`[Worker 2] Mencari email OTP TopNod (Percobaan ${attempt + 1}/30)...`);
                        
                        const emailPrivy = openPage.locator('div[aria-label*="topnod.com"], span:has-text("topnod.com"), span:has-text("TopNod")').first();
                        if (await emailPrivy.isVisible({ timeout: 5000 }).catch(() => false)) {
                            log(`[Worker 2] Email TopNod ditemukan! Membuka pesan...`, 'success');
                            await emailPrivy.click();
                            await sleep(3000);
                            
                            const otpLocator = openPage.locator('text=/\\b\\d{6}\\b/');
                            if (await otpLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
                                const rawText = await otpLocator.innerText();
                                const match = rawText.match(/\b\d{6}\b/);
                                if (match) {
                                    otpFound = match[0];
                                    break;
                                }
                            }
                        } else {
                            const refreshBtn = openPage.locator('button[title="Check for new messages"], button[title="Refresh"]').first();
                            if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                                await refreshBtn.click();
                            } else {
                                await openPage.keyboard.press('F5');
                            }
                        }
                        await sleep(5000);
                    }
                    
                    await openContext.close();
                    cleanProfileCache(sessionName, email);
                } catch (e) {
                    if (openContext) await openContext.close();
                    cleanProfileCache(sessionName, email);
                    log(`[ERROR] Terjadi kesalahan di Worker Outlook: ${e.message}`, 'error');
                }
            } // Tutup blok else fs.existsSync

        // TAHAP 3: KETIK OTP KE VMOS VIA ADB
        if (otpFound) {
            log(`[OTP] BERHASIL! Mendapatkan OTP: ${otpFound}`, 'success');
            
            log(`[ADB] Mengetuk kotak OTP pertama (X:${otpX}, Y:${otpY})`);
            await vcadb_exec(`input tap ${otpX} ${otpY}`, config, token, userId, BASE);
            await sleep(1500);

            log(`[ADB] Mengetikkan 6 digit OTP: ${otpFound}`);
            await vcadb_exec(`input text ${otpFound}`, config, token, userId, BASE);
            await sleep(3000);

            // TAHAP 4: KETIK USERNAME ACAK
            const randUser = generateRandomUsername();
            log(`[ADB] Membuat Username acak: ${randUser}`);
            
            log(`[ADB] Mengetuk kolom Username (X:${usernameX}, Y:${usernameY})`);
            await vcadb_exec(`input tap ${usernameX} ${usernameY}`, config, token, userId, BASE);
            await sleep(1500);

            log(`[ADB] Mengetik Username: ${randUser}`);
            await vcadb_exec(`input text ${randUser}`, config, token, userId, BASE);
            await sleep(1500);
            
            // Click submit again
            log(`[ADB] Mengetuk Submit (X:${submitX}, Y:${submitY})`);
            await vcadb_exec(`input tap ${submitX} ${submitY}`, config, token, userId, BASE);
            
            log(`[Sistem] === PENDAFTARAN SELESAI ===`, 'success');

        } else {
            log(`[ERROR] Gagal menemukan OTP setelah 30x percobaan.`, 'error');
        }

    } catch (e) {
        log(`[ERROR] Kegagalan sistem ADB: ${e.message}`, 'error');
    }
});

app.post('/api/test-netflix', async (req, res) => {
    broadcastLog(`[Sistem] Memulai Netflix Trial Hunter (Versi Awal - clearcookies)...`);
    res.json({ success: true, message: "Proses Netflix dimulai..." });

    try {
        // Menambahkan jurus Stealth: User Agent nyata, Anti-Automation flag
        let browser = await chromium.launch({
            headless: true,
            executablePath: 'C:\\Users\\fajar\\AppData\\Local\\Programs\\Opera\\opera.exe',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled' // Bypass WebDriver flag
            ]
        });
        
        let foundTrial = false;
        let successfulState = null;
        
        const clearCookiesUrl = 'https://www.netflix.com/clearcookies';
        const targetUrl = 'https://www.netflix.com/';

        for (let attempt = 0; attempt < 100; attempt++) {
            broadcastLog(`[Netflix] Percobaan ${attempt + 1}/100 | Mengunjungi netflix.com/clearcookies...`);
            
            // Menyuntikkan User Agent Chrome Windows asli
            let context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
            let page = await context.newPage();
            
            try {
                // 1. Kunjungi link clearcookies sesuai instruksi awal
                await page.goto(clearCookiesUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await sleep(5000); // Tunggu proses redirect atau muat selesai
                
                // 2. Jika tidak ter-redirect otomatis, pastikan kita di halaman utama
                if (!page.url().includes('netflix.com/id') && !page.url().includes('netflix.com/?')) {
                    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await sleep(5000);
                }
                
                // 3. Simulasi Gerak Manusia (Anti-Bot)
                broadcastLog(`[Netflix] Percobaan ${attempt + 1} | Membaca halaman layaknya manusia (scroll perlahan)...`);
                try {
                    // Jeda baca awal (2 - 3 detik)
                    await sleep(2000 + Math.random() * 1000);
                    
                    // Gerakan mouse acak melengkung halus
                    let startX = 200 + Math.random() * 100;
                    let startY = 300 + Math.random() * 100;
                    await page.mouse.move(startX, startY, { steps: 5 });
                    
                    // 3 kali tarikan scroll turun perlahan layaknya membaca paragraf
                    for(let i=0; i<3; i++) {
                        await page.mouse.wheel(0, 200 + Math.random() * 150); 
                        await sleep(1500 + Math.random() * 1500); // jeda baca agak lama (1.5 - 3 detik)
                    }
                    
                    // Scroll ke atas dengan tarikan lembut
                    for(let i=0; i<2; i++) {
                        await page.mouse.wheel(0, -(250 + Math.random() * 150)); 
                        await sleep(1000 + Math.random() * 1000);
                    }
                    await sleep(1000);
                } catch(e) {}
                
                const pageHtml = await page.content();
                const pageText = pageHtml.toLowerCase();
                
                const defaultPriceKeywords = ['rp54.000', 'rp 54.000', '54.000', '54,000', '54000', 'harga paket'];
                
                // 1. Verifikasi halaman termuat sempurna HANYA pada percobaan pertama
                if (attempt === 0) {
                    if (defaultPriceKeywords.some(kw => pageText.includes(kw))) {
                        broadcastLog(`[Netflix] Percobaan bot berhasil. Halaman termuat sempurna...`, 'success');
                    } else {
                        broadcastLog(`[Netflix] Halaman awal gagal memuat harga normal (mungkin terblokir bot/koneksi jelek).`, 'error');
                    }
                }
                
                // 2. Cari promo 0 Rupiah di setiap putaran
                const promoKeywords = [
                    'rp0', 'rp 0', '0 rupiah',
                    'try 7 days', 'try 14 days', 'try 30 days',
                    '7 days free', '14 days free', '30 days free',
                    '7 hari gratis', '14 hari gratis', '30 hari gratis',
                    'free trial', 'coba gratis', 'bulan gratis'
                ];
            
                if (promoKeywords.some(kw => pageText.includes(kw))) {
                    foundTrial = true;
                    broadcastLog(`[Netflix] 🔥 BINGO! DITEMUKAN PROMO PADA PERCOBAAN ${attempt + 1}!`, 'success');
                    
                    successfulState = await context.storageState();
                    await context.close();
                    break;
                } else {
                    broadcastLog(`[Netflix] Promo tidak muncul. Mengulangi...`, 'warning');
                }
            } catch (err) {
                broadcastLog(`[Netflix] Error / Timeout: ${err.message}`, 'error');
            }
            
            await context.close();
            await sleep(3000);
        }
        
        await browser.close();

        if (foundTrial && successfulState) {
            broadcastLog(`[Netflix] Menyiapkan browser klaim (Headful) untuk Anda...`);
            let visibleBrowser = await chromium.launch({
                headless: false,
                executablePath: 'C:\\Users\\fajar\\AppData\\Local\\Programs\\Opera\\opera.exe',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
            });
            let visibleContext = await visibleBrowser.newContext({ 
                storageState: successfulState,
                viewport: null
            });
            let visiblePage = await visibleContext.newPage();
            // Kunjungi halaman utama dengan kuki yang sudah mendapatkan promo
            await visiblePage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            broadcastLog(`[Netflix] Selesai! Silakan cek peramban yang terbuka.`, 'success');
        } else {
            broadcastLog(`[Netflix] Gagal menemukan Promo setelah 50 putaran.`, 'error');
        }
    } catch (e) {
        broadcastLog(`[Netflix] Error sistem: ${e.message}`, 'error');
    }
});

app.post('/api/test-amazon', async (req, res) => {
    broadcastLog(`[Amazon] Membuka Prime Video di peramban Opera Anda...`);
    res.json({ success: true, message: "Proses Amazon dimulai..." });
    try {
        require('child_process').exec(`start opera "https://www.primevideo.com/" || start "" "https://www.primevideo.com/"`);
        broadcastLog(`[Amazon] Selesai! Silakan cek peramban Anda untuk mendaftar.`, 'success');
    } catch (e) {
        broadcastLog(`[Amazon] Error: ${e.message}`, 'error');
    }
});

app.post('/api/test-spotify', async (req, res) => {
    broadcastLog(`[Spotify] Membuka Spotify Premium di peramban Opera Anda...`);
    res.json({ success: true, message: "Proses Spotify dimulai..." });
    try {
        require('child_process').exec(`start opera "https://www.spotify.com/id-id/premium/" || start "" "https://www.spotify.com/id-id/premium/"`);
        broadcastLog(`[Spotify] Selesai! Silakan cek peramban Anda untuk mendaftar.`, 'success');
    } catch (e) {
        broadcastLog(`[Spotify] Error: ${e.message}`, 'error');
    }
});

app.post('/api/test-gemini', async (req, res) => {
    broadcastLog(`[Gemini] Membuka Gemini Advanced di peramban Opera Anda...`);
    res.json({ success: true, message: "Proses Gemini dimulai..." });
    try {
        // Membuka halaman pendaftaran Google Workspace (Gemini Business)
        require('child_process').exec(`start opera "https://workspace.google.com/u/0/signup/upgrade/compare" || start "" "https://workspace.google.com/u/0/signup/upgrade/compare"`);
        broadcastLog(`[Gemini] Selesai! Silakan cek peramban Anda untuk mendaftar.`, 'success');
    } catch (e) {
        broadcastLog(`[Gemini] Error: ${e.message}`, 'error');
    }
});

app.post('/api/login', (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Kode akses wajib diisi.' });
    }
    if (fs.existsSync(ACCESS_CODES_FILE)) {
        try {
            const codes = JSON.parse(fs.readFileSync(ACCESS_CODES_FILE, 'utf-8'));
            if (codes[code]) {
                return res.json({ 
                    success: true, 
                    token: code, 
                    sessionName: codes[code].sessionName, 
                    role: codes[code].role 
                });
            }
        } catch(e) {}
    }
    return res.status(401).json({ error: 'Kode akses tidak valid.' });
});

// Admin generate new access code
app.post('/api/admin/generate-code', (req, res) => {
    if (req.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak.' });
    }
    const { sessionName } = req.body;
    if (!sessionName) {
        return res.status(400).json({ error: 'Nama sesi wajib diisi.' });
    }
    
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    const newCode = `KEY-${sessionName.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${rand}`;
    
    let codes = {};
    if (fs.existsSync(ACCESS_CODES_FILE)) {
        try {
            codes = JSON.parse(fs.readFileSync(ACCESS_CODES_FILE, 'utf-8'));
        } catch(e) {}
    }
    
    codes[newCode] = {
        sessionName: sessionName,
        role: 'user'
    };
    
    try {
        fs.writeFileSync(ACCESS_CODES_FILE, JSON.stringify(codes, null, 2));
        res.json({ success: true, code: newCode, sessionName });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin get all codes
app.get('/api/admin/codes', (req, res) => {
    if (req.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak.' });
    }
    if (fs.existsSync(ACCESS_CODES_FILE)) {
        try {
            const codes = JSON.parse(fs.readFileSync(ACCESS_CODES_FILE, 'utf-8'));
            return res.json(codes);
        } catch(e) {}
    }
    res.json({});
});

// Admin delete code
app.post('/api/admin/delete-code', (req, res) => {
    if (req.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak.' });
    }
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Kode wajib diisi.' });
    }
    if (code === 'imam2507') {
        return res.status(400).json({ error: 'Tidak dapat menghapus Master Admin Key.' });
    }
    if (fs.existsSync(ACCESS_CODES_FILE)) {
        try {
            const codes = JSON.parse(fs.readFileSync(ACCESS_CODES_FILE, 'utf-8'));
            if (codes[code]) {
                delete codes[code];
                fs.writeFileSync(ACCESS_CODES_FILE, JSON.stringify(codes, null, 2));
                return res.json({ success: true });
            }
        } catch(e) {}
    }
    res.status(404).json({ error: 'Kode tidak ditemukan.' });
});

// AI Copilot declarations
const readProjectFileDeclaration = {
    name: 'readProjectFile',
    description: 'Membaca konten suatu berkas di dalam direktori proyek berdasarkan relative path.',
    parameters: {
        type: 'OBJECT',
        properties: {
            relativePath: {
                type: 'STRING',
                description: 'Relative path berkas, contoh: "public/index.html" atau "server.js"'
            }
        },
        required: ['relativePath']
    }
};

const writeProjectFileDeclaration = {
    name: 'writeProjectFile',
    description: 'Menulis atau mengedit berkas di dalam direktori proyek berdasarkan relative path dan isi berkas.',
    parameters: {
        type: 'OBJECT',
        properties: {
            relativePath: {
                type: 'STRING',
                description: 'Relative path berkas, contoh: "public/app.js"'
            },
            content: {
                type: 'STRING',
                description: 'Isi lengkap berkas yang ingin ditulis'
            }
        },
        required: ['relativePath', 'content']
    }
};

const executeProjectCommandDeclaration = {
    name: 'executeProjectCommand',
    description: 'Menjalankan perintah command line di dalam direktori proyek VPS.',
    parameters: {
        type: 'OBJECT',
        properties: {
            command: {
                type: 'STRING',
                description: 'Perintah shell untuk dieksekusi, contoh: "npm run build" atau "dir"'
            }
        },
        required: ['command']
    }
};

// Map tool implementations
const aiTools = {
    readProjectFile: async ({ relativePath }) => {
        try {
            const absolutePath = path.resolve(__dirname, relativePath);
            if (!absolutePath.startsWith(__dirname)) {
                return { error: 'Akses ditolak: File di luar direktori proyek tidak diizinkan.' };
            }
            if (!fs.existsSync(absolutePath)) {
                return { error: `File tidak ditemukan: ${relativePath}` };
            }
            const content = fs.readFileSync(absolutePath, 'utf-8');
            return { content };
        } catch(e) {
            return { error: e.message };
        }
    },
    writeProjectFile: async ({ relativePath, content }) => {
        try {
            const absolutePath = path.resolve(__dirname, relativePath);
            if (!absolutePath.startsWith(__dirname)) {
                return { error: 'Akses ditolak: Tidak dapat menulis file di luar direktori proyek.' };
            }
            fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
            fs.writeFileSync(absolutePath, content, 'utf-8');
            return { success: true, message: `File ${relativePath} berhasil ditulis.` };
        } catch(e) {
            return { error: e.message };
        }
    },
    executeProjectCommand: async ({ command }) => {
        try {
            const execPromise = require('util').promisify(exec);
            const { stdout, stderr } = await execPromise(command, { cwd: __dirname, timeout: 30000 });
            return { stdout, stderr };
        } catch(e) {
            return { error: e.message };
        }
    }
};

app.post('/api/admin/ai-agent', async (req, res) => {
    if (req.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak.' });
    }
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt wajib diisi.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di berkas .env server.' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            tools: [{
                functionDeclarations: [
                    readProjectFileDeclaration,
                    writeProjectFileDeclaration,
                    executeProjectCommandDeclaration
                ]
            }]
        });

        let chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: 'Anda adalah Antigravity, asisten AI pemrograman premium yang terintegrasi di dashboard admin. Anda memiliki kemampuan untuk mengedit file dan menjalankan command di dalam proyek untuk membantu Admin memutakhirkan proyek. Selalu gunakan bahasa Indonesia yang sopan. Jika menampilkan isi berkas yang berisi daftar baris (seperti berkas akun), tampilkan isinya secara lengkap dan rapi baris demi baris menggunakan format text biasa atau markdown code block.' }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Baik, saya mengerti. Saya akan menyajikan isi berkas secara lengkap dan rapi baris demi baris menggunakan format teks atau code block sesuai instruksi Anda.' }]
                }
            ]
        });

        const getFunctionCalls = (resObj) => {
            if (!resObj || !resObj.response) return [];
            if (typeof resObj.response.functionCalls === 'function') {
                return resObj.response.functionCalls() || [];
            }
            return resObj.response.functionCalls || [];
        };

        let response = await chat.sendMessage(prompt);
        let functionCalls = getFunctionCalls(response);
        const actionsTaken = [];

        // Loop to execute function calls sequentially (max 10 iterations to prevent infinite loop)
        for (let i = 0; i < 10; i++) {
            if (!functionCalls || functionCalls.length === 0) {
                break;
            }

            const responseParts = [];
            for (const call of functionCalls) {
                const { name, args } = call;
                actionsTaken.push({ name, args });

                // Execute local function
                const fn = aiTools[name];
                let result = {};
                if (fn) {
                    result = await fn(args);
                } else {
                    result = { error: `Fungsi ${name} tidak ditemukan.` };
                }

                responseParts.push({
                    functionResponse: {
                        name,
                        response: result
                    }
                });
            }

            // Send back function outputs to the model
            const resultResponse = await chat.sendMessage(responseParts);
            functionCalls = getFunctionCalls(resultResponse);
            response = resultResponse;
        }

        res.json({
            success: true,
            response: response.response.text(),
            actions: actionsTaken
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/restart-server', (req, res) => {
    if (req.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak.' });
    }
    res.json({ success: true, message: 'Server sedang memproses restart terminal Node.js...' });
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});


function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Toolbox Server running at http://${localIP}:${PORT}`);
    // exec(`start http://${localIP}:${PORT}`);
});

// Fitur mengetik "re" di terminal untuk merestart server
process.stdin.on('data', (data) => {
    const input = data.toString().trim().toLowerCase();
    if (input === 're') {
        console.log('\n[Sistem] Memulai ulang server Node.js dari perintah terminal...\n');
        process.exit(1);
    }
});
