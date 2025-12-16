/**
 * FluxPlayer Pro - UI Manager Module
 * Handles all DOM manipulations, event listeners, and visual updates.
 * This module acts as the "View" in the architecture.
 */

export const UIManager = {
    handlers: {},

    /**
     * Initialize UI components
     */
    init() {
        // Remove Splash Screen
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.classList.add('fade-out');
                setTimeout(() => splash.remove(), 1000);
            }
        }, 1500);

        // Initialize Icons
        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * Bind Events to Controllers
     */
    bindEvents(handlers) {
        this.handlers = handlers;

        // --- 1. Modals & Onboarding ---
        this._bindClick('btn-settings', () => this.toggleModal('settings-modal', true));
        this._bindClick('btn-close-settings', () => this.toggleModal('settings-modal', false));
        this._bindClick('btn-start-app', () => handlers.onStartApp && handlers.onStartApp());
        
        // Close modal on backdrop click
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.onclick = (e) => {
                if(e.target.id === 'settings-modal') this.toggleModal('settings-modal', false);
            };
        }

        // --- 2. History Actions ---
        this._bindClick('btn-history', () => {
            const list = document.getElementById('history-list');
            if (list) {
                list.parentElement.scrollIntoView({ behavior: 'smooth' });
                this.highlightElement(list.parentElement);
            }
        });
        this._bindClick('btn-clear-history', () => handlers.onClearHistory && handlers.onClearHistory());

        // --- 3. File Inputs ---
        this._setupFileInput('video-input', 'video-dz', handlers.onVideoSelect);
        this._bindClick('btn-browse-main', () => document.getElementById('video-input')?.click());
        
        this._setupFileInput('sub-input', 'sub-dz', handlers.onSubtitleSelect);

        // Global drag on player
        this._setupDragDrop('player-wrapper', handlers.onVideoSelect);

        // --- 4. Settings Inputs ---
        
        // Font Size
        this._bindInput('input-font-size', (val) => {
            const label = document.getElementById('size-val');
            if(label) label.innerText = `${val}px`;
            handlers.onSettingChange('fontSize', val);
        });

        // Font Family (Buttons logic)
        const fontBtns = document.querySelectorAll('.font-btn');
        fontBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                fontBtns.forEach(b => b.classList.remove('active', 'border-blue-500', 'text-blue-500', 'bg-blue-500/10'));
                btn.classList.add('active', 'border-blue-500', 'text-blue-500', 'bg-blue-500/10');
                
                // Trigger handler
                const font = btn.dataset.font;
                handlers.onSettingChange('fontFamily', font);
            });
        });

        // Colors
        this._bindInput('input-text-color', (val) => handlers.onSettingChange('textColor', val));
        this._bindInput('input-bg-color', (val) => handlers.onSettingChange('bgColor', val));
        
        // Opacity
        this._bindInput('input-bg-opacity', (val) => {
            const label = document.getElementById('opacity-val');
            if(label) label.innerText = `${val}%`;
            handlers.onSettingChange('bgOpacity', val);
        });
        
        this._bindClick('btn-reset-settings', () => handlers.onSettingsReset && handlers.onSettingsReset());
    },

    /**
     * Renders the list of active subtitles with delete buttons
     * @param {Array} tracks - Array of track objects
     */
    renderSubtitleList(tracks) {
        const container = document.getElementById('loaded-subs-container');
        const dzLabel = document.getElementById('sub-label');
        
        if (!container) return;
        
        container.innerHTML = ''; // Clear current list

        if (tracks.length === 0) {
            if (dzLabel) {
                dzLabel.innerText = "Drag & drop .srt or .vtt";
                dzLabel.className = "text-xs text-slate-500";
            }
            return;
        }

        // Update Dropzone label
        if (dzLabel) {
            dzLabel.innerText = `${tracks.length} subtitle(s) loaded`;
            dzLabel.className = "text-xs text-purple-400 font-bold";
        }

        // Render List
        tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = "subtitle-item flex items-center justify-between p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50 group hover:border-purple-500/50 transition-colors";
            
            item.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden">
                    <i data-lucide="message-square" class="w-3.5 h-3.5 text-purple-500 flex-shrink-0"></i>
                    <span class="text-xs text-slate-300 font-mono truncate select-none">${track.label}</span>
                </div>
                <button class="btn-remove-sub p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Remove Subtitle">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
            `;

            // Bind Remove Click
            const removeBtn = item.querySelector('.btn-remove-sub');
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.handlers.onSubtitleRemove) {
                    this.handlers.onSubtitleRemove(index);
                }
            };

            container.appendChild(item);
        });

        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * Renders Watch History (Static/Informational)
     */
    renderHistory(history) {
        const list = document.getElementById('history-list');
        const badge = document.getElementById('history-badge');
        
        if (!list) return;

        // Badge Logic
        if (badge) {
            if (history.length > 0) badge.classList.remove('hidden');
            else badge.classList.add('hidden');
        }

        if (history.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center h-32 text-slate-600 gap-2">
                    <i data-lucide="clock" class="w-8 h-8 opacity-20"></i>
                    <p class="text-xs">No history yet</p>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        list.innerHTML = history.map(h => {
            const minutes = Math.floor(h.time / 60);
            const seconds = Math.floor(h.time % 60);
            const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
            const dateStr = new Date(h.lastPlayed).toLocaleDateString();
            
            return `
            <div class="p-3 bg-slate-800/30 hover:bg-slate-800/60 rounded-xl border border-slate-700/30 hover:border-slate-600 transition-all group select-none">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="text-xs font-bold text-slate-300 group-hover:text-white truncate w-full" title="${h.name}">${h.name}</h4>
                </div>
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-1.5 bg-slate-900/50 px-1.5 py-0.5 rounded text-[10px] text-slate-400 font-mono">
                        <i data-lucide="play-circle" class="w-3 h-3 text-blue-500"></i>
                        <span>Stopped at ${timeStr}</span>
                    </div>
                    <span class="text-[10px] text-slate-600">${dateStr}</span>
                </div>
            </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * Updates "Now Playing" UI
     */
    updateNowPlaying(file) {
        const nameEl = document.getElementById('current-video-name');
        const metaEl = document.getElementById('current-video-meta');
        const labelEl = document.getElementById('video-label');
        const zoneEl = document.getElementById('video-dz');

        if (nameEl) nameEl.innerText = file.name;
        if (metaEl) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            metaEl.innerHTML = `<i data-lucide="hard-drive" class="w-3 h-3"></i> ${sizeMB} MB • Local File`;
        }

        if (labelEl) {
            labelEl.innerText = file.name;
            labelEl.className = "text-xs text-blue-400 font-bold truncate";
        }
        
        if (zoneEl) {
            zoneEl.classList.add('border-blue-500/50', 'bg-blue-500/5');
        }
        
        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * Syncs Settings UI with State
     */
    syncSettings(settings) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('input-font-size', settings.fontSize);
        setVal('input-text-color', settings.textColor);
        setVal('input-bg-color', settings.bgColor);
        setVal('input-bg-opacity', settings.bgOpacity);

        // Update Labels
        const sizeLabel = document.getElementById('size-val');
        if (sizeLabel) sizeLabel.innerText = `${settings.fontSize}px`;
        
        const opacityLabel = document.getElementById('opacity-val');
        if (opacityLabel) opacityLabel.innerText = `${settings.bgOpacity}%`;

        // Update Font Buttons
        const fontBtns = document.querySelectorAll('.font-btn');
        fontBtns.forEach(btn => {
            if (btn.dataset.font === settings.fontFamily) {
                btn.classList.add('active', 'border-blue-500', 'text-blue-500', 'bg-blue-500/10');
            } else {
                btn.classList.remove('active', 'border-blue-500', 'text-blue-500', 'bg-blue-500/10');
            }
        });
    },

    /**
     * Modal Control
     */
    toggleModal(modalId, show) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        const panel = modal.firstElementChild;
        
        if (show) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => {
                modal.classList.remove('opacity-0');
                if(panel) {
                    panel.classList.remove('scale-95');
                    panel.classList.add('scale-100');
                }
            });
        } else {
            modal.classList.add('opacity-0');
            if(panel) {
                panel.classList.remove('scale-100');
                panel.classList.add('scale-95');
            }
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    },

    /**
     * Toast Notification
     */
    showToast(message) {
        const wrapper = document.getElementById('player-wrapper');
        if (!wrapper) return;

        const toast = document.createElement('div');
        toast.className = 'absolute top-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl z-50 animate-bounce pointer-events-none border border-white/10 flex items-center gap-2';
        toast.innerHTML = `<i data-lucide="info" class="w-3 h-3 text-blue-500"></i> ${message}`;
        
        wrapper.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    highlightElement(element) {
        if (!element) return;
        element.classList.add('ring-2', 'ring-blue-500');
        setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500'), 1500);
    },

    // --- Internal Helpers ---

    _bindClick(id, handler) {
        const el = document.getElementById(id);
        if (el) el.onclick = handler;
    },

    _bindInput(id, handler, event = 'input') {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, (e) => handler(e.target.value));
    },

    _setupFileInput(inputId, dropZoneId, handler) {
        const input = document.getElementById(inputId);
        const zone = document.getElementById(dropZoneId);
        
        if (zone && input) {
            zone.onclick = () => input.click();
            
            input.onchange = (e) => {
                if (e.target.files[0] && handler) {
                    handler(e.target.files[0]);
                }
                input.value = ''; 
            };

            this._setupDragDrop(dropZoneId, handler);
        }
    },

    _setupDragDrop(elementId, handler) {
        const el = document.getElementById(elementId);
        if (!el) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            el.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        el.addEventListener('dragenter', () => el.classList.add('active'));
        el.addEventListener('dragleave', () => el.classList.remove('active'));
        el.addEventListener('drop', (e) => {
            el.classList.remove('active');
            const files = e.dataTransfer.files;
            if (files.length > 0 && handler) {
                handler(files[0]);
            }
        });
    }
};