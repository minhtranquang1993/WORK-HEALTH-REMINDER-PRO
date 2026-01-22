/**
 * YouTube Content Script
 * Chay tren cac trang YouTube de lay thong tin video va dieu khien playback
 */

class YouTubeController {
    constructor() {
        this.video = null;
        this.initialized = false;
        this.updateInterval = null;
        this.init();
    }

    init() {
        // Wait for video element
        this.waitForVideo();

        // Listen for messages from extension
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sendResponse);
            return true; // Keep channel open for async response
        });

        // Observe for SPA navigation (YouTube is a SPA)
        this.observeNavigation();
    }

    waitForVideo() {
        const checkVideo = () => {
            this.video = document.querySelector('video.html5-main-video');
            if (this.video) {
                this.setupVideoListeners();
                this.initialized = true;
                this.sendStateUpdate();
                this.startPeriodicUpdate();
            } else {
                setTimeout(checkVideo, 500);
            }
        };
        checkVideo();
    }

    observeNavigation() {
        // YouTube uses History API for navigation
        let lastUrl = location.href;

        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                // Reset and wait for new video
                this.video = null;
                this.initialized = false;
                if (this.updateInterval) {
                    clearInterval(this.updateInterval);
                }
                setTimeout(() => this.waitForVideo(), 1000);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    setupVideoListeners() {
        if (!this.video) return;

        ['play', 'pause', 'loadedmetadata', 'ended', 'volumechange'].forEach(event => {
            this.video.addEventListener(event, () => this.sendStateUpdate());
        });
    }

    startPeriodicUpdate() {
        // Send state update every 2 seconds for time progress
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.updateInterval = setInterval(() => {
            if (this.video && !this.video.paused) {
                this.sendStateUpdate();
            }
        }, 2000);
    }

    getVideoInfo() {
        if (!this.video) return null;

        // Try multiple selectors for title (YouTube changes DOM frequently)
        const titleSelectors = [
            'h1.ytd-video-primary-info-renderer yt-formatted-string',
            'h1.title yt-formatted-string',
            'h1.ytd-watch-metadata yt-formatted-string',
            '#title h1 yt-formatted-string',
            'ytd-watch-metadata h1 yt-formatted-string'
        ];

        let titleElement = null;
        for (const selector of titleSelectors) {
            titleElement = document.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) break;
        }

        // Try multiple selectors for channel
        const channelSelectors = [
            '#channel-name a',
            'ytd-channel-name a',
            '#owner #channel-name a',
            'ytd-video-owner-renderer #channel-name a'
        ];

        let channelElement = null;
        for (const selector of channelSelectors) {
            channelElement = document.querySelector(selector);
            if (channelElement && channelElement.textContent.trim()) break;
        }

        const videoId = this.getVideoId();

        return {
            title: titleElement?.textContent?.trim() || 'Video YouTube',
            channel: channelElement?.textContent?.trim() || 'YouTube',
            duration: this.video.duration || 0,
            currentTime: this.video.currentTime || 0,
            isPlaying: !this.video.paused,
            volume: this.video.volume,
            isMuted: this.video.muted,
            url: window.location.href,
            videoId: videoId,
            thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null
        };
    }

    getVideoId() {
        const url = new URL(window.location.href);
        return url.searchParams.get('v') || null;
    }

    sendStateUpdate() {
        const info = this.getVideoInfo();
        if (info) {
            try {
                chrome.runtime.sendMessage({
                    action: 'youtubeStateUpdate',
                    videoInfo: info
                }).catch(() => {
                    // Extension context invalidated, ignore
                });
            } catch (e) {
                // Ignore errors
            }
        }
    }

    handleMessage(message, sendResponse) {
        switch (message.action) {
            case 'youtube_getState':
                sendResponse({ success: true, videoInfo: this.getVideoInfo() });
                break;

            case 'youtube_playPause':
                if (this.video) {
                    if (this.video.paused) {
                        this.video.play();
                    } else {
                        this.video.pause();
                    }
                    sendResponse({ success: true, isPlaying: !this.video.paused });
                } else {
                    sendResponse({ success: false, error: 'No video found' });
                }
                break;

            case 'youtube_next':
                const nextBtn = document.querySelector('.ytp-next-button');
                if (nextBtn && !nextBtn.disabled) {
                    nextBtn.click();
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'Next button not found or disabled' });
                }
                break;

            case 'youtube_prev':
                const prevBtn = document.querySelector('.ytp-prev-button');
                if (prevBtn && !prevBtn.disabled) {
                    prevBtn.click();
                    sendResponse({ success: true });
                } else if (this.video) {
                    // Restart current video if no prev button
                    this.video.currentTime = 0;
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'No video found' });
                }
                break;

            case 'youtube_setVolume':
                if (this.video) {
                    this.video.volume = Math.max(0, Math.min(1, message.volume));
                    sendResponse({ success: true, volume: this.video.volume });
                } else {
                    sendResponse({ success: false, error: 'No video found' });
                }
                break;

            case 'youtube_toggleMute':
                if (this.video) {
                    this.video.muted = !this.video.muted;
                    sendResponse({ success: true, isMuted: this.video.muted });
                } else {
                    sendResponse({ success: false, error: 'No video found' });
                }
                break;

            case 'youtube_seek':
                if (this.video) {
                    this.video.currentTime = message.time;
                    sendResponse({ success: true, currentTime: this.video.currentTime });
                } else {
                    sendResponse({ success: false, error: 'No video found' });
                }
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }
}

// Initialize controller when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new YouTubeController());
} else {
    new YouTubeController();
}
