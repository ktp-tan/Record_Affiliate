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
        sheetTabs: document.getElementById('sheetTabs'),
        clipLink: document.getElementById('clipLink'),
        shopLink: document.getElementById('shopLink'),
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

        // Sheet tabs
        dom.sheetTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.sheet-tab');
            if (!tab) return;

            document.querySelectorAll('.sheet-tab').forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            state.selectedSheet = tab.dataset.sheet;
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
    async function handleSubmit() {
        if (state.isSubmitting) return;

        const clipLink = dom.clipLink.value.trim();
        const shopLink = dom.shopLink.value.trim();

        if (!clipLink || !shopLink) {
            showToast('กรุณากรอกลิงก์ให้ครบทั้ง 2 ช่อง', 'error');
            return;
        }

        if (!state.scriptUrl) {
            showToast('กรุณาตั้งค่า Apps Script URL ก่อน', 'error');
            dom.settingsPanel.classList.add('open');
            return;
        }

        state.isSubmitting = true;
        dom.submitBtn.classList.add('loading');
        dom.submitBtn.disabled = true;

        try {
            const response = await fetch(state.scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    clipLink: clipLink,
                    shopLink: shopLink,
                    sheet: state.selectedSheet,
                }),
            });

            // With no-cors mode, we can't read the response
            // But the request will still go through
            // Show success state
            dom.submitBtn.classList.remove('loading');
            dom.submitBtn.classList.add('success');

            // Haptic feedback on mobile
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

            // Add to history
            addToHistory(clipLink, shopLink, state.selectedSheet);

            // Clear inputs
            dom.clipLink.value = '';
            dom.shopLink.value = '';

            // Blur active input to hide keyboard on mobile
            if (document.activeElement) document.activeElement.blur();

            showToast(`บันทึกลง "${state.selectedSheet}" สำเร็จ!`, 'success');

            // Reset button after delay
            setTimeout(() => {
                dom.submitBtn.classList.remove('success');
                updateSubmitButton();
            }, 2000);

        } catch (error) {
            dom.submitBtn.classList.remove('loading');
            showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
            updateSubmitButton();
        } finally {
            state.isSubmitting = false;
        }
    }

    // --- History Management ---
    function addToHistory(clipLink, shopLink, sheet) {
        const item = {
            clipLink,
            shopLink,
            sheet,
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
                return `
                    <div class="history-item">
                        <div class="history-item-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                        <div class="history-item-content">
                            <div class="history-item-sheet">${item.sheet}</div>
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

    // --- Start ---
    init();
})();
