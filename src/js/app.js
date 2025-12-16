/**
 * FluxPlayer Pro - Main Controller
 * Ties together the UI, Storage, Subtitle Parser, and Player logic.
 */

import { UIManager } from './ui.js';
import { Storage } from './storage.js';
import { SubtitleParser } from './subtitle-parser.js';

// --- 1. Application State & History Management ---
const AppState = {
    history: [],
    settings: {
        fontSize: 18,
        fontFamily: "'Inter', sans-serif",
        textColor: "#ffffff",
        bgColor: "#000000",
        bgOpacity: 50
    },

    init() {
        const saved = Storage.get();
        if (saved) {
            this.history = saved.history || [];
            this.settings = { ...this.settings, ...saved.settings };
        }
    },

    save() {
        Storage.save({ history: this.history, settings: this.settings });
    },

    updateSetting(key, value) {
        this.settings[key] = value;
        this.save();
    },

    addToHistory(file, time = 0) {
        this.history = this.history.filter(h => h.name !== file.name);
        this.history.unshift({
            name: file.name,
            size: file.size,
            type: file.type,
            time: time,
            lastPlayed: new Date().toISOString()
        });
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
    subtitleBlobs: [], // Keep track of blobs to revoke them later
    tracks: [], // Store active subtitle tracks configuration

    init() {
        this.instance = new Plyr('#player', {
            controls: [
                'play-large', 'restart', 'play', 'progress', 'current-time', 
                'duration', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
            ],
            settings: ['captions', 'quality', 'speed', 'loop'],
            captions: { active: true, update: true, language: 'auto' },
            // Important: Preserve ratio
            ratio: '16:9'
        });

        // Track progress
        this.instance.on('timeupdate', () => {
            if (!this.currentFile) return;
            const time = this.instance.currentTime;
            if (time > 0 && Math.floor(time) % 5 === 0) {
                AppState.updateHistoryTime(this.currentFile.name, time);
            }
        });

        this.instance.on('ready', () => {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.classList.add('hidden');
        });
    },

    /**
     * Loads a video file and resets tracks
     */
    loadVideo(file) {
        // 1. Cleanup Memory
        if (this.videoObjectUrl) URL.revokeObjectURL(this.videoObjectUrl);
        this.cleanupSubtitles();

        // 2. Setup New Video
        this.currentFile = file;
        this.videoObjectUrl = URL.createObjectURL(file);
        this.tracks = []; // Reset subtitle tracks for new video

        // 3. Check History
        const historyItem = AppState.getHistoryItem(file.name);
        const startTime = historyItem ? historyItem.time : 0;

        // 4. Update Source
        this.instance.source = {
            type: 'video',
            title: file.name,
            sources: [{ src: this.videoObjectUrl, type: file.type || 'video/mp4' }],
            tracks: [] // Start with no tracks
        };

        // 5. Handle Start Time
        if (startTime > 0) {
            this.instance.once('loadedmetadata', () => {
                this.instance.currentTime = startTime;
                UIManager.showToast(`Resumed from ${Math.floor(startTime/60)}:${String(Math.floor(startTime%60)).padStart(2, '0')}`);
            });
        }

        setTimeout(() => this.instance.play(), 200);

        // 6. UI Updates
        AppState.addToHistory(file, startTime);
        UIManager.updateNowPlaying(file);
        UIManager.resetSubtitleLabel();
    },

    /**
     * Loads a subtitle, converts it, and adds it to the player tracks list
     */
    loadSubtitle(file) {
        if (!this.instance || !this.currentFile) {
            UIManager.showToast('Please load a video first!');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            let vttContent = content;

            // Convert SRT to VTT
            if (SubtitleParser.isSrt(file)) {
                vttContent = SubtitleParser.srtToVtt(content);
            }

            // Create Blob
            const blobUrl = SubtitleParser.createTrackBlob(vttContent);
            this.subtitleBlobs.push(blobUrl);

            // Add to tracks list
            // We set 'default: true' for the new one, and false for others
            this.tracks.forEach(t => t.default = false);
            
            this.tracks.push({
                kind: 'captions',
                label: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for cleaner label
                srclang: 'en', // Can be dynamic if needed, but 'en' works for general display
                src: blobUrl,
                default: true
            });

            // Refresh Source to update Plyr Menu
            this.refreshSourceWithTracks();

            // UI Update
            UIManager.updateSubtitleLabel(file.name);
            UIManager.showToast('Subtitle Added to Menu');
        };
        
        reader.readAsText(file);
    },

    /**
     * Refreshes the player source to include new tracks without losing playback position
     */
    refreshSourceWithTracks() {
        const currentTime = this.instance.currentTime;
        const isPaused = this.instance.paused;

        this.instance.source = {
            type: 'video',
            title: this.currentFile.name,
            sources: [{ src: this.videoObjectUrl, type: this.currentFile.type || 'video/mp4' }],
            tracks: this.tracks // Inject the updated list of tracks
        };

        // Restore position
        this.instance.once('loadedmetadata', () => {
            this.instance.currentTime = currentTime;
            if (!isPaused) this.instance.play();
        });
    },

    cleanupSubtitles() {
        this.subtitleBlobs.forEach(url => URL.revokeObjectURL(url));
        this.subtitleBlobs = [];
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
            fontFamily: "'Inter', sans-serif",
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

// --- 4. Main Entry Point ---
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
    UIManager.init();
    PlayerController.init();
    SettingsController.init();
    UIManager.renderHistory(AppState.history);

    UIManager.bindEvents({
        onVideoSelect: (file) => PlayerController.loadVideo(file),
        onSubtitleSelect: (file) => PlayerController.loadSubtitle(file),
        onSettingChange: (key, value) => SettingsController.update(key, value),
        onSettingsReset: () => SettingsController.reset(),
        onClearHistory: () => {
            if (confirm('Are you sure you want to clear your watch history?')) {
                AppState.clearHistory();
            }
        }
    });

    console.log('FluxPlayer Pro Controller Loaded.');
});