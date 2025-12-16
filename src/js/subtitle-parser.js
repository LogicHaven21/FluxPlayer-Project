/**
 * FluxPlayer Pro - Subtitle Parser Module
 * Handles the conversion of legacy subtitle formats (like SRT) to WebVTT,
 * which is the standard format required by HTML5 video players.
 */

export const SubtitleParser = {
    /**
     * Converts raw SRT subtitle text to WebVTT format.
     * @param {string} srtContent - The raw text content of the .srt file.
     * @returns {string} The converted WebVTT string.
     */
    srtToVtt(srtContent) {
        if (!srtContent) return '';

        // 1. Start with the required WebVTT header
        let vtt = "WEBVTT\n\n";

        // 2. Normalize line endings to avoid issues across different OS (Windows CRLF vs Unix LF)
        let normalizedContent = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 3. Regex replacement to fix timestamps
        // SRT uses comma (00:00:00,000) while WebVTT requires dot (00:00:00.000)
        // Pattern: Matches (HH:MM:SS),(MMM) --> Replaces with $1.$2
        const timestampRegex = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;
        
        vtt += normalizedContent.replace(timestampRegex, '$1.$2');

        return vtt;
    },

    /**
     * Creates a temporary Blob URL for the subtitle track.
     * This allows the browser to load the generated VTT text as if it were a file.
     * * @param {string} content - The WebVTT text content.
     * @returns {string} A 'blob:...' URL string ready for the <track> src attribute.
     */
    createTrackBlob(content) {
        try {
            // Create a Blob with the correct MIME type and encoding
            const blob = new Blob([content], { type: 'text/vtt;charset=utf-8' });
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error('FluxPlayer Subtitle Blob Error:', e);
            return '';
        }
    },

    /**
     * Detects if the file is likely an SRT file based on extension or content.
     * @param {File} file - The subtitle file object.
     * @returns {boolean} True if it seems to be SRT.
     */
    isSrt(file) {
        return file.name.toLowerCase().endsWith('.srt');
    },

    /**
     * Cleans up the Blob URL to free up memory.
     * Should be called when the subtitle is no longer needed or replaced.
     * @param {string} url - The blob URL to revoke.
     */
    revokeBlob(url) {
        if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    }
};