/**
 * FluxPlayer Pro - Main Controller
 * Ties together the UI, Storage, Subtitle Parser, and Player logic.
 */

import { UIManager } from './ui.js';
import { Storage } from './storage.js';
import { SubtitleParser } from './subtitle-parser.js';

// --- 1. Application State ---
const AppState = {
    history: [],
    settings: {
        fontSize: 18,
        fontFamily: "'Segoe UI', 'Helvetica Neue', system-ui, sans-serif",
        textColor: "#ffffff",
        bgColor: "#000000",
        bgOpacity: 50
    },
    hasSeenOnboarding: false,

    init() {
        const saved = Storage.get();
        if (saved) {
            this.history = saved.history || [];
            // Merge settings to ensure defaults exist
            this.settings = { ...this.settings, ...saved.settings };
            this.hasSeenOnboarding = saved.hasSeenOnboarding || false;
        }

        // Check for first-time user
        if (!this.hasSeenOnboarding) {
            UIManager.toggleModal('onboarding-modal', true);
        }
    },

    save() {
        Storage.save({
            history: this.history,
            settings: this.settings,
            hasSeenOnboarding: this.hasSeenOnboarding
        });
    },

    completeOnboarding() {
        this.hasSeenOnboarding = true;
        this.save();
        UIManager.toggleModal('onboarding-modal', false);
    },

    updateSetting(key, value) {
        this.settings[key] = value;
        this.save();
    },

    // History Logic
    addToHistory(file, time = 0) {
        // Remove duplicate if exists
        this.history = this.history.filter(h => h.name !== file.name);
        
        // Add to top
        this.history.unshift({
            name: file.name,
            size: file.size,
            type: file.type,
            time: time,
            lastPlayed: new Date().toISOString()
        });

        // Limit to 20 items
        if (this.history.length > 20) this.history.pop();
        
        this.save();
        UIManager.renderHistory(this.history);
    },

    updateHistoryTime(fileName, time) {
        const item = this.history.find(h => h.name === fileName);
        if (item) {
            item.time = time;
            item.lastPlayed = new Date().toISOString();
            this.save();
        }
    },
    
    getHistoryItem(fileName) {
        return this.history.find(h => h.name === fileName);
    },

    clearHistory() {
        this.history = [];
        this.save();
        UIManager.renderHistory(this.history);
    }
};

// --- 2. Player Controller ---
const PlayerController = {
    instance: null,
    currentFile: null,
    videoObjectUrl: null,
    tracks: [], // Stores active subtitle tracks { label, src, blob }

    init() {
        this.instance = new Plyr('#player', {
            controls: [
                'play-large', 'restart', 'play', 'progress', 'current-time', 
                'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
            ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            captions: { active: true, update: true, language: 'auto' },
            ratio: '16:9',
            iconUrl: 'assets/vendor/plyr.svg',
            blankVideo: 'assets/vendor/blank.mp4'
        });

        // Track progress
        this.instance.on('timeupdate', () => {
            if (!this.currentFile) return;
            const time = this.instance.currentTime;
            // Save every 5 seconds
            if (time > 0 && Math.floor(time) % 5 === 0) {
                AppState.updateHistoryTime(this.currentFile.name, time);
            }
        });

        this.instance.on('ready', () => {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.classList.add('hidden');
        });
    },

    loadVideo(file) {
        // Cleanup previous video and subtitles
        if (this.videoObjectUrl) URL.revokeObjectURL(this.videoObjectUrl);
        this.cleanupSubtitles();

        this.currentFile = file;
        this.videoObjectUrl = URL.createObjectURL(file);

        // Check History for resume
        const historyItem = AppState.getHistoryItem(file.name);
        const startTime = historyItem ? historyItem.time : 0;

        // Load Source
        this.instance.source = {
            type: 'video',
            title: file.name,
            sources: [{ src: this.videoObjectUrl, type: file.type || 'video/mp4' }],
            tracks: [] // Reset tracks
        };

        // Resume Logic
        if (startTime > 0) {
            this.instance.once('loadedmetadata', () => {
                this.instance.currentTime = startTime;
                UIManager.showToast(`Resumed from ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2, '0')}`);
            });
        }

        setTimeout(() => this.instance.play(), 200);

        AppState.addToHistory(file, startTime);
        UIManager.updateNowPlaying(file);
        UIManager.renderSubtitleList(this.tracks); // Will be empty initially
    },

    loadSubtitle(file) {
        if (!this.currentFile) {
            UIManager.showToast('Please load a video first!');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            let vttContent = content;

            // Convert if SRT
            if (SubtitleParser.isSrt(file)) {
                vttContent = SubtitleParser.srtToVtt(content);
            }

            const blobUrl = SubtitleParser.createTrackBlob(vttContent);
            const label = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

            // Add to tracks array
            this.tracks.push({
                kind: 'captions',
                label: label,
                srclang: 'en',
                src: blobUrl,
                default: this.tracks.length === 0 // Default if it's the first one
            });

            this.refreshSourceWithTracks();
            UIManager.renderSubtitleList(this.tracks);
            UIManager.showToast('Subtitle Added');
        };
        
        reader.readAsText(file);
    },

    removeSubtitle(index) {
        const track = this.tracks[index];
        if (track) {
            // Revoke blob to free memory
            if (track.src) URL.revokeObjectURL(track.src);
            
            // Remove from array
            this.tracks.splice(index, 1);
            
            this.refreshSourceWithTracks();
            UIManager.renderSubtitleList(this.tracks);
            UIManager.showToast('Subtitle Removed');
        }
    },

    refreshSourceWithTracks() {
        if (!this.instance || !this.currentFile) return;

        const currentTime = this.instance.currentTime;
        const isPaused = this.instance.paused;

        this.instance.source = {
            type: 'video',
            title: this.currentFile.name,
            sources: [{ src: this.videoObjectUrl, type: this.currentFile.type || 'video/mp4' }],
            tracks: this.tracks
        };

        // Restore position
        this.instance.once('loadedmetadata', () => {
            this.instance.currentTime = currentTime;
            if (!isPaused) this.instance.play();
        });
    },

    cleanupSubtitles() {
        this.tracks.forEach(t => {
            if (t.src) URL.revokeObjectURL(t.src);
        });
        this.tracks = [];
    }
};

// --- 3. Settings Controller ---
const SettingsController = {
    init() {
        this.apply(AppState.settings);
        UIManager.syncSettings(AppState.settings);
    },

    update(key, value) {
        AppState.updateSetting(key, value);
        this.apply(AppState.settings);
        UIManager.syncSettings(AppState.settings);
    },

    reset() {
        const defaults = {
            fontSize: 18,
            fontFamily: "'Segoe UI', 'Helvetica Neue', system-ui, sans-serif",
            textColor: "#ffffff",
            bgColor: "#000000",
            bgOpacity: 50
        };
        AppState.settings = defaults;
        AppState.save();
        this.apply(defaults);
        UIManager.syncSettings(defaults);
    },

    apply(s) {
        const root = document.documentElement;
        
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0,0,0';
        };
        const bgRgba = `rgba(${hexToRgb(s.bgColor)}, ${s.bgOpacity / 100})`;

        root.style.setProperty('--caption-size', `${s.fontSize}px`);
        root.style.setProperty('--caption-color', s.textColor);
        root.style.setProperty('--caption-bg', bgRgba);
        root.style.setProperty('--caption-font', s.fontFamily);
    }
};

// --- 4. Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
    UIManager.init();
    PlayerController.init();
    SettingsController.init();
    UIManager.renderHistory(AppState.history);

    // Bind Events
    UIManager.bindEvents({
        // Player Events
        onVideoSelect: (file) => PlayerController.loadVideo(file),
        onSubtitleSelect: (file) => PlayerController.loadSubtitle(file),
        onSubtitleRemove: (index) => PlayerController.removeSubtitle(index),
        
        // Settings Events
        onSettingChange: (key, value) => SettingsController.update(key, value),
        onSettingsReset: () => SettingsController.reset(),
        
        // History Events
        onClearHistory: () => {
            if (confirm('Clear watch history?')) AppState.clearHistory();
        },
        
        // Onboarding
        onStartApp: () => AppState.completeOnboarding()
    });

    console.log('FluxPlayer Pro Loaded.');
});