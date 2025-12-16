/**
 * FluxPlayer Pro - UI Manager Module
 * Handles all DOM manipulations, event listeners, and visual updates.
 * This module acts as the "View" in the architecture.
 */

export const UIManager = {
    // Stores references to callbacks passed from the main controller
    handlers: {},

    /**
     * Initialize the UI: remove splash screen, setup icons, etc.
     */
    init() {
        // Handle Splash Screen Removal
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.classList.add('fade-out');
                setTimeout(() => splash.remove(), 1000);
            }
        }, 1500);

        // Initialize Lucide Icons
        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * Binds application logic handlers to UI events.
     * @param {Object} handlers - Object containing callback functions
     */
    bindEvents(handlers) {
        this.handlers = handlers;

        // --- Modals ---
        this._bindClick('btn-settings', () => this.toggleModal('settings-modal', true));
        this._bindClick('btn-close-settings', () => this.toggleModal('settings-modal', false));
        
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.onclick = (e) => {
                if(e.target.id === 'settings-modal') this.toggleModal('settings-modal', false);
            };
        }

        // --- History Panel ---
        this._bindClick('btn-history', () => {
            const list = document.getElementById('history-list');
            if (list) {
                list.parentElement.scrollIntoView({ behavior: 'smooth' });
                this.highlightElement(list.parentElement);
            }
        });
        this._bindClick('btn-clear-history', () => handlers.onClearHistory && handlers.onClearHistory());

        // --- File Inputs & Drag Drop ---
        // Video
        this._setupFileInput('video-input', 'video-dz', handlers.onVideoSelect);
        this._bindClick('btn-browse-main', () => document.getElementById('video-input')?.click());
        
        // Subtitle
        this._setupFileInput('sub-input', 'sub-dz', handlers.onSubtitleSelect);

        // Global Drag on Player
        this._setupDragDrop('player-wrapper', handlers.onVideoSelect);

        // --- Settings Inputs ---
        this._bindInput('input-font-size', (val) => handlers.onSettingChange('fontSize', val));
        this._bindInput('input-font-family', (val) => handlers.onSettingChange('fontFamily', val), 'change');
        this._bindInput('input-text-color', (val) => handlers.onSettingChange('textColor', val));
        this._bindInput('input-bg-color', (val) => handlers.onSettingChange('bgColor', val));
        this._bindInput('input-bg-opacity', (val) => handlers.onSettingChange('bgOpacity', val));
        
        this._bindClick('btn-reset-settings', () => handlers.onSettingsReset && handlers.onSettingsReset());
    },

    /**
     * Renders the watch history list.
     */
    renderHistory(history) {
        const list = document.getElementById('history-list');
        const badge = document.getElementById('history-badge');
        
        if (!list) return;

        // Update Badge visibility
        if (badge) {
            if (history.length > 0) badge.classList.remove('hidden');
            else badge.classList.add('hidden');
        }

        if (history.length === 0) {
            list.innerHTML = `<div class="text-center p-8 text-slate-600 text-sm italic">No recent videos</div>`;
            return;
        }

        list.innerHTML = history.map(h => {
            const minutes = Math.floor(h.time / 60);
            const seconds = Math.floor(h.time % 60);
            const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
            
            return `
            <div class="p-3 bg-slate-800/40 hover:bg-slate-800 rounded-lg border border-slate-700/50 cursor-pointer transition-colors group relative" 
                 onclick="alert('Security: Please re-select this file manually.')">
                <div class="flex justify-between items-start">
                    <h4 class="text-sm font-medium text-slate-300 group-hover:text-blue-400 truncate pr-2 w-full" title="${h.name}">${h.name}</h4>
                </div>
                <div class="flex justify-between items-center mt-2">
                    <div class="flex items-center gap-1.5">
                        <i data-lucide="clock" class="w-3 h-3 text-slate-500"></i>
                        <span class="text-xs text-slate-400 font-mono">${timeStr}</span>
                    </div>
                    <span class="text-[10px] text-slate-600">${new Date(h.lastPlayed).toLocaleDateString()}</span>
                </div>
            </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * Syncs the UI inputs with the current settings state.
     */
    syncSettings(settings) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('input-font-size', settings.fontSize);
        setVal('input-font-family', settings.fontFamily);
        setVal('input-text-color', settings.textColor);
        setVal('input-bg-color', settings.bgColor);
        setVal('input-bg-opacity', settings.bgOpacity);

        const sizeLabel = document.getElementById('size-val');
        if (sizeLabel) sizeLabel.innerText = `${settings.fontSize}px`;
    },

    /**
     * Updates the "Now Playing" info section.
     */
    updateNowPlaying(file) {
        const nameEl = document.getElementById('current-video-name');
        const metaEl = document.getElementById('current-video-meta');
        const labelEl = document.getElementById('video-label');
        const zoneEl = document.getElementById('video-dz');

        if (nameEl) nameEl.innerText = file.name;
        if (metaEl) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            metaEl.innerText = `${sizeMB} MB • Local File`;
        }

        if (labelEl) {
            labelEl.innerText = file.name;
            labelEl.classList.add('text-blue-400');
        }
        
        if (zoneEl) zoneEl.classList.add('border-blue-500/50');
    },

    /**
     * Adds a newly loaded subtitle to the UI list.
     * Dynamic List Creation Logic.
     */
    updateSubtitleLabel(name) {
        // 1. Update dropzone text hint
        const label = document.getElementById('sub-label');
        if (label) {
            label.innerText = "Add more subtitles...";
            label.classList.add('text-purple-400');
        }

        // 2. Find parent container
        const zone = document.getElementById('sub-dz');
        if (!zone) return;

        // 3. Find or Create the subtitle list container
        let list = document.getElementById('loaded-subs-list');
        if (!list) {
            list = document.createElement('div');
            list.id = 'loaded-subs-list';
            list.className = 'mt-3 space-y-2 w-full max-h-32 overflow-y-auto custom-scrollbar';
            // Insert it right after the dropzone div
            zone.parentNode.insertBefore(list, zone.nextSibling);
        }

        // 4. Append the new subtitle item
        const item = document.createElement('div');
        item.className = 'flex items-center gap-2 text-xs text-slate-300 bg-slate-800/50 p-2 rounded border border-slate-700/50 animate-pulse';
        // Remove animation after a moment
        setTimeout(() => item.classList.remove('animate-pulse'), 1000);

        item.innerHTML = `
            <i data-lucide="check-circle-2" class="w-4 h-4 text-green-500 flex-shrink-0"></i>
            <span class="truncate flex-1 font-mono">${name}</span>
        `;
        list.appendChild(item);

        // Refresh icons for the new element
        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * Resets the subtitle UI (clears list and label).
     */
    resetSubtitleLabel() {
        const label = document.getElementById('sub-label');
        if (label) {
            label.innerText = "Supports SRT & VTT";
            label.classList.remove('text-purple-400');
        }

        // Remove the dynamic list
        const list = document.getElementById('loaded-subs-list');
        if (list) list.remove();
    },

    /**
     * Shows a modal with animation.
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
            setTimeout(() => modal.classList.add('hidden'), 200);
        }
    },

    /**
     * Shows a temporary toast notification.
     */
    showToast(message) {
        const wrapper = document.getElementById('player-wrapper');
        if (!wrapper) return;

        const toast = document.createElement('div');
        toast.className = 'absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg z-50 animate-bounce pointer-events-none transition-opacity duration-500';
        toast.innerText = message;
        
        wrapper.appendChild(toast);
        setTimeout(() => {
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