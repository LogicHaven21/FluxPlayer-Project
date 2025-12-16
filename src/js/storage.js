/**
 * FluxPlayer Pro - Storage Manager
 * Handles local persistence of application state using LocalStorage.
 * This module is responsible for saving and retrieving user settings and history.
 */

const STORAGE_KEY = 'flux_pro_state_v1';

export const Storage = {
    /**
     * Retrieve state from LocalStorage
     * @returns {Object|null} The parsed state object or null if not found/error
     */
    get() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('FluxPlayer Storage Read Error:', e);
            return null;
        }
    },

    /**
     * Save state to LocalStorage
     * @param {Object} state - The state object to persist (History + Settings)
     */
    save(state) {
        try {
            // Convert state to string and save
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('FluxPlayer Storage Save Error:', e);
            
            // Handle quota exceeded specifically
            if (e.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded. Try clearing watch history.');
                alert('Storage is full! Please clear your watch history.');
            }
        }
    },

    /**
     * Clear all application data from LocalStorage
     */
    clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('FluxPlayer storage cleared.');
        } catch (e) {
            console.error('FluxPlayer Storage Clear Error:', e);
        }
    },

    /**
     * Check if storage is available
     * @returns {boolean}
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
};