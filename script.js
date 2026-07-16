// ============================================
// Record Affiliate - Main Script
// ============================================

(function () {
    'use strict';

    // --- State ---
    const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGVMrV_s00TIPZP9HflhLv6sxLbZcc-PUkRksYLhgE-ak2d1wPDPBi0Wc-zgKmS9GjvA/exec';

    const state = {
        scriptUrl: localStorage.getItem('appsScriptUrl') || DEFAULT_SCRIPT_URL,
        selectedSheet: 'Main Sheet',
        selectedItemType: '', // Selected type: Cookie, HighComs, or empty
        isSubmitting: false,
        history: JSON.parse(localStorage.getItem('submitHistory') || '[]'),
    };

    // --- DOM References ---
    const dom = {
        settingsPanel: document.getElementById('settingsPanel'),
        settingsToggle: document.getElementById('settingsToggle'),
        settingsContent: document.getElementById('settingsContent'),
        scriptUrlInput: document.getElementById('scriptUrl'),
        saveUrlBtn: document.getElementById('saveUrlBtn'),
        connectionStatus: document.getElementById('connectionStatus'),
        clipLink: document.getElementById('clipLink'),
        shopLink: document.getElementById('shopLink'),
        prodName: document.getElementById('prodName'),
        handToolsCheck: document.getElementById('handToolsCheck'),
        handToolsToggle: document.getElementById('handToolsToggle'),
        btnTypeCookie: document.getElementById('btnTypeCookie'),
        btnTypeHighComs: document.getElementById('btnTypeHighComs'),
        submitBtn: document.getElementById('submitBtn'),
        historyList: document.getElementById('historyList'),
        clearHistoryBtn: document.getElementById('clearHistoryBtn'),
        toastContainer: document.getElementById('toastContainer'),
        bgParticles: document.getElementById('bgParticles'),
    };

    // --- Initialize ---
    function init() {
        createParticles();
        setupEventListeners();
        loadSavedUrl();
        renderHistory();
        updateSubmitButton();
    }

    // --- Detect Mobile ---
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 640;

    // --- Background Particles ---
    function createParticles() {
        const colors = [
            'rgba(99, 102, 241, 0.3)',
            'rgba(139, 92, 246, 0.25)',
            'rgba(168, 85, 247, 0.2)',
            'rgba(99, 102, 241, 0.15)',
        ];

        // Fewer particles on mobile for better battery life
        const count = isMobile ? 8 : 20;

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            const size = Math.random() * 4 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.animationDuration = `${Math.random() * 15 + 10}s`;
            particle.style.animationDelay = `${Math.random() * 10}s`;
            dom.bgParticles.appendChild(particle);
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        // Settings toggle
        dom.settingsToggle.addEventListener('click', () => {
            dom.settingsPanel.classList.toggle('open');
        });

        // Save URL
        dom.saveUrlBtn.addEventListener('click', saveScriptUrl);
        dom.scriptUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveScriptUrl();
        });

        // Paste buttons
        document.querySelectorAll('.btn-paste').forEach((btn) => {
            btn.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    const target = document.getElementById(btn.dataset.target);
                    target.value = text;
                    target.dispatchEvent(new Event('input'));

                    // Auto-focus next input for faster workflow on mobile
                    if (btn.dataset.target === 'clipLink') {
                        dom.shopLink.focus();
                    } else {
                        // Blur to hide keyboard after last field
                        target.blur();
                    }

                    // Haptic feedback on mobile
                    if (navigator.vibrate) navigator.vibrate(30);

                    // Quick feedback animation
                    btn.style.color = 'var(--success)';
                    setTimeout(() => {
                        btn.style.color = '';
                    }, 600);
                } catch (err) {
                    // Fallback: focus the input so user can long-press to paste
                    const target = document.getElementById(btn.dataset.target);
                    target.focus();
                    showToast('กดค้างที่ช่องเพื่อวางลิงก์', 'error');
                }
            });
        });

        // Input change -> update submit button
        dom.clipLink.addEventListener('input', updateSubmitButton);
        dom.shopLink.addEventListener('input', updateSubmitButton);

        // Hand Tools checkbox state change fallback for styling
        if (dom.handToolsCheck && dom.handToolsToggle) {
            dom.handToolsCheck.addEventListener('change', () => {
                if (dom.handToolsCheck.checked) {
                    dom.handToolsToggle.classList.add('checked');
                } else {
                    dom.handToolsToggle.classList.remove('checked');
                }
            });
        }

        // Item Type selection buttons (Cookie & HighComs)
        const typeButtons = [dom.btnTypeCookie, dom.btnTypeHighComs];
        typeButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.value;
                    
                    // If already selected, toggle it off
                    if (state.selectedItemType === value) {
                        state.selectedItemType = '';
                        btn.classList.remove('active');
                    } else {
                        // Select this one, deselect the other
                        state.selectedItemType = value;
                        typeButtons.forEach(b => {
                            if (b) {
                                if (b === btn) {
                                    b.classList.add('active');
                                } else {
                                    b.classList.remove('active');
                                }
                            }
                        });
                    }
                    
                    // Haptic feedback
                    if (navigator.vibrate) navigator.vibrate(25);
                });
            }
        });

        // Auto-extract name when link is pasted/typed
        dom.shopLink.addEventListener('input', () => {
            const val = dom.shopLink.value.trim();
            if (!val) return;

            // 1. If it's Shopee/Lazada copy-paste text (containing space/newline/etc. - Shopee App copy)
            if (val.includes(' ') || val.includes('[') || val.includes('\n')) {
                const parsed = parsePastedProductInput(val);
                if (parsed) {
                    dom.shopLink.value = parsed.url;
                    dom.prodName.value = parsed.name;
                    updateSubmitButton();
                    renderKeywordSuggestions(parsed.name); // Generate suggested keyword badges
                    showToast('ดึงชื่อสินค้าและลิงก์เรียบร้อย!', 'success');
                }
            }
            // 2. If it's a clean Shopee/Lazada URL, fetch from Apps Script backend dynamically
            else if (isValidProductUrl(val)) {
                fetchNameFromBackend(val);
            }
        });

        // Submit
        dom.submitBtn.addEventListener('click', handleSubmit);

        // Clear history
        dom.clearHistoryBtn.addEventListener('click', () => {
            state.history = [];
            localStorage.setItem('submitHistory', '[]');
            renderHistory();
            showToast('ล้างประวัติเรียบร้อย', 'success');
        });

        // Keyboard shortcut: Ctrl/Cmd + Enter to submit
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (!dom.submitBtn.disabled && !state.isSubmitting) {
                    handleSubmit();
                }
            }
        });
    }

    // --- Save Script URL ---
    function saveScriptUrl() {
        const url = dom.scriptUrlInput.value.trim();
        if (!url) {
            showToast('กรุณาใส่ URL ของ Apps Script', 'error');
            return;
        }

        if (!url.startsWith('https://script.google.com/')) {
            showToast('URL ไม่ถูกต้อง ต้องเป็น Google Apps Script URL', 'error');
            return;
        }

        state.scriptUrl = url;
        localStorage.setItem('appsScriptUrl', url);
        updateConnectionStatus(true);
        showToast('บันทึก URL สำเร็จ!', 'success');
        updateSubmitButton();

        // Close settings after save
        setTimeout(() => {
            dom.settingsPanel.classList.remove('open');
        }, 500);
    }

    // --- Load Saved URL ---
    function loadSavedUrl() {
        if (state.scriptUrl) {
            dom.scriptUrlInput.value = state.scriptUrl;
            updateConnectionStatus(true);
        } else {
            // Auto-open settings if no URL saved
            dom.settingsPanel.classList.add('open');
        }
    }

    // --- Update Connection Status ---
    function updateConnectionStatus(connected) {
        const statusEl = dom.connectionStatus;
        if (connected) {
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'เชื่อมต่อแล้ว';
        } else {
            statusEl.classList.remove('connected');
            statusEl.querySelector('.status-text').textContent = 'ยังไม่ได้ตั้งค่า';
        }
    }

    // --- Update Submit Button ---
    function updateSubmitButton() {
        const hasClipLink = dom.clipLink.value.trim() !== '';
        const hasShopLink = dom.shopLink.value.trim() !== '';
        const hasUrl = state.scriptUrl !== '';

        dom.submitBtn.disabled = !(hasClipLink && hasShopLink && hasUrl);
    }

    // --- Handle Submit ---
    function handleSubmit() {
        if (state.isSubmitting) return;

        const clipLink = dom.clipLink.value.trim();
        const shopLink = dom.shopLink.value.trim();
        const prodName = dom.prodName.value.trim();
        const isHandTools = dom.handToolsCheck.checked;

        if (!clipLink || !shopLink) {
            showToast('กรุณากรอกลิงก์ให้ครบทั้ง 2 ช่อง', 'error');
            return;
        }

        if (!state.scriptUrl) {
            showToast('กรุณาตั้งค่า Apps Script URL ก่อน', 'error');
            dom.settingsPanel.classList.add('open');
            return;
        }

        // Lock submit to prevent double click
        state.isSubmitting = true;

        // แนบ itemType เข้าไปใน prodName ด้วยตัวคั่น ||| (วิธีนี้ส่งได้ 100% เพราะ prodName ส่งสำเร็จทุกครั้ง)
        let finalProdName = prodName;
        if (state.selectedItemType) {
            finalProdName = prodName + '|||' + state.selectedItemType;
        }

        // 1. Send data to Google Sheets in the background (Non-blocking)
        fetch(state.scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
                clipLink: clipLink,
                shopLink: shopLink,
                prodName: finalProdName,
                handTools: isHandTools,
                sheet: state.selectedSheet,
            }),
        }).catch(error => {
            console.error('Background send error:', error);
            showToast('ส่งข้อมูลล้มเหลว กรุณาตรวจสอบอินเทอร์เน็ต', 'error');
        });

        // 2. Immediate UI response (No waiting!)
        dom.submitBtn.classList.add('success');

        // Haptic feedback on mobile
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

        // Add to history instantly (displaying product name if available)
        const sheetLabel = isHandTools ? '🔧 Hand Tools' : state.selectedSheet;
        addToHistory(clipLink, shopLink, sheetLabel, prodName);

        showToast('บันทึกประวัติแล้ว กำลังส่งไป Google Sheets...', 'success');

        // Clear inputs instantly
        dom.clipLink.value = '';
        dom.shopLink.value = '';
        dom.prodName.value = '';
        dom.handToolsCheck.checked = false;
        if (dom.handToolsToggle) dom.handToolsToggle.classList.remove('checked');
        
        // Reset item type selection
        state.selectedItemType = '';
        if (dom.btnTypeCookie) dom.btnTypeCookie.classList.remove('active');
        if (dom.btnTypeHighComs) dom.btnTypeHighComs.classList.remove('active');
        
        const suggestionsContainer = document.getElementById('keywordSuggestions');
        if (suggestionsContainer) suggestionsContainer.innerHTML = '';

        // Blur active input to hide keyboard on mobile
        if (document.activeElement) document.activeElement.blur();

        // Reset button state after 1 second so they can quickly submit the next one
        setTimeout(() => {
            dom.submitBtn.classList.remove('success');
            state.isSubmitting = false;
            updateSubmitButton();
        }, 1000);
    }

    // --- History Management ---
    function addToHistory(clipLink, shopLink, sheet, prodName) {
        const item = {
            clipLink,
            shopLink,
            sheet,
            prodName: prodName || '',
            timestamp: new Date().toISOString(),
        };

        state.history.unshift(item);

        // Keep only last 20 entries
        if (state.history.length > 20) {
            state.history = state.history.slice(0, 20);
        }

        localStorage.setItem('submitHistory', JSON.stringify(state.history));
        renderHistory();
    }

    function renderHistory() {
        if (state.history.length === 0) {
            dom.historyList.innerHTML = `
                <div class="history-empty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <p>ยังไม่มีประวัติการบันทึก</p>
                </div>
            `;
            return;
        }

        dom.historyList.innerHTML = state.history
            .map((item) => {
                const time = formatTime(item.timestamp);
                const displayTitle = item.prodName ? `🏷️ ${item.prodName}` : item.sheet;
                return `
                    <div class="history-item">
                        <div class="history-item-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                        <div class="history-item-content">
                            <div class="history-item-sheet">${displayTitle}</div>
                            <div class="history-item-links">
                                <div class="history-item-link"><span>🎬</span> ${truncateUrl(item.clipLink)}</div>
                                <div class="history-item-link"><span>🛒</span> ${truncateUrl(item.shopLink)}</div>
                            </div>
                        </div>
                        <div class="history-item-time">${time}</div>
                    </div>
                `;
            })
            .join('');
    }

    // --- Toast Notifications ---
    function showToast(message, type = 'success') {
        const icon =
            type === 'success'
                ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
                : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `${icon}<span>${message}</span>`;

        dom.toastContainer.appendChild(toast);

        // Auto remove after 3.5 seconds
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // --- Utilities ---
    function parsePastedProductInput(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const urlMatch = text.match(urlRegex);
        
        if (urlMatch) {
            const url = urlMatch[0];
            let name = "";
            
            // Try to find name in brackets [Product Name]
            const bracketMatch = text.match(/\[(.*?)\]/);
            if (bracketMatch) {
                name = bracketMatch[1];
            } else {
                // Otherwise take everything before the URL
                let beforeUrl = text.split(url)[0].trim();
                if (beforeUrl) {
                    // 1. Remove prefixes
                    const prefixes = [
                        /^ลองดู\s*/i,
                        /^ลองเข้ามาดูสินค้า\s*/i,
                        /^ช้อปเลย!\s*/i,
                        /^แนะนำ\s*/i,
                        /^รีวิว\s*/i,
                        /^พิกัด\s*/i
                    ];
                    for (const pref of prefixes) {
                        beforeUrl = beforeUrl.replace(pref, "");
                    }

                    // 2. Cut off at suffixes
                    const suffixes = [
                        ' ในราคา',
                        ' ลดราคา',
                        ' เหลือ ',
                        ' ซื้อได้ในแอป',
                        ' ที่ Shopee',
                        ' ที่ Lazada',
                        ' ช้อปเลย',
                        ' สนใจสั่งซื้อ',
                        ' พิกัด'
                    ];
                    
                    let cleanName = beforeUrl;
                    for (const suff of suffixes) {
                        if (cleanName.includes(suff)) {
                            cleanName = cleanName.split(suff)[0];
                        }
                    }
                    
                    name = cleanName.trim();
                }
            }
            
            return { url, name: name.substring(0, 100) }; // limit length
        }
        return null;
    }

    function truncateUrl(url) {
        if (url.length > 50) {
            return url.substring(0, 47) + '...';
        }
        return url;
    }

    function formatTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'เมื่อกี้';
        if (diffMins < 60) return `${diffMins} นาที`;
        if (diffHours < 24) return `${diffHours} ชม.`;

        return date.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
        });
    }

    // --- Keyword Suggestions ---
    function generateKeywordSuggestions(title) {
        if (!title) return [];
        
        // Remove English, numbers, and special characters
        const cleanTitle = title
            .replace(/[A-Za-z0-9]/g, ' ')
            .replace(/[^\u0e00-\u0e7f\s]/g, ' ');
            
        const segments = cleanTitle.split(/\s+/).filter(s => s.length >= 2);
        const junkWords = ['ลองดู', 'ของแท้', 'พร้อมส่ง', 'ลดราคา', 'ราคา', 'ที่', 'ใน', 'แบบ', 'ของ', 'และ', 'หรือ', 'ที่นี่', 'เลย'];
        const keywords = [];
        const seen = new Set();
        
        for (const seg of segments) {
            if (seg.length >= 3 && !junkWords.includes(seg) && !seen.has(seg)) {
                keywords.push(seg);
                seen.add(seg);
            }
        }
        
        return keywords.slice(0, 5); // Return up to 5 suggested keywords
    }

    function renderKeywordSuggestions(title) {
        const container = document.getElementById('keywordSuggestions');
        if (!container) return;
        
        container.innerHTML = '';
        const keywords = generateKeywordSuggestions(title);
        
        if (keywords.length === 0) return;
        
        keywords.forEach(kw => {
            const badge = document.createElement('div');
            badge.className = 'keyword-badge';
            badge.textContent = kw;
            badge.addEventListener('click', () => {
                dom.prodName.value = kw;
                updateSubmitButton();
                if (navigator.vibrate) navigator.vibrate(20); // Small haptic tap
            });
            container.appendChild(badge);
        });
    }

    // --- Dynamic Name Fetching Helpers ---
    let fetchTimeout = null;
    function fetchNameFromBackend(url) {
        if (!state.scriptUrl) return;
        
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }

        // Show loading state
        dom.prodName.value = '';
        dom.prodName.placeholder = '⏳ กำลังดึงชื่อสินค้าอัตโนมัติ...';
        dom.prodName.disabled = true;

        // Debounce to prevent multiple API requests
        if (fetchTimeout) clearTimeout(fetchTimeout);
        
        fetchTimeout = setTimeout(() => {
            const fetchUrl = `${state.scriptUrl}?action=extractName&url=${encodeURIComponent(cleanUrl)}`;
            fetch(fetchUrl)
                .then(res => res.json())
                .then(data => {
                    if (data && data.status === 'success' && data.productName) {
                        dom.prodName.value = data.productName;
                        dom.prodName.placeholder = 'ชื่อสินค้า (ดึงให้อัตโนมัติจากลิงก์ที่วาง)';
                        renderKeywordSuggestions(data.productName);
                        showToast('ดึงชื่อสินค้าสำเร็จ!', 'success');
                    } else {
                        dom.prodName.placeholder = 'ไม่สามารถดึงชื่อสินค้าได้ กรุณาพิมพ์เอง';
                    }
                    dom.prodName.disabled = false;
                    updateSubmitButton();
                })
                .catch(err => {
                    console.error('Fetch name error:', err);
                    dom.prodName.placeholder = 'ไม่สามารถดึงชื่อสินค้าได้ กรุณาพิมพ์เอง';
                    dom.prodName.disabled = false;
                    updateSubmitButton();
                });
        }, 600); // 600ms debounce
    }

    function isValidProductUrl(str) {
        if (!str) return false;
        const s = str.trim().toLowerCase();
        const hasDomain = s.includes('shopee.co.th') || s.includes('shope.ee') || s.includes('lazada.co.th') || s.includes('s.lazada.co.th');
        return hasDomain && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('www.') || s.indexOf('/') !== -1);
    }

    // --- Start ---
    init();
})();
