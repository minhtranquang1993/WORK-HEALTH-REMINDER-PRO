/**
 * YouTube Content Script
 * Chay tren cac trang YouTube de lay thong tin video va dieu khien playback
 */

class YouTubeController {
    constructor() {
        this.video = null;
        this.initialized = false;
        this.updateInterval = null;
        this.isShorts = false;
        this.adSkipperInterval = null;
        this.focusModeActive = false;
        this.focusCheckInterval = null;
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

        // Start ad skipper
        this.initAdSkipper();
    }

    waitForVideo() {
        const checkVideo = () => {
            // Try multiple selectors for different YouTube pages including Shorts
            this.video = document.querySelector('video.html5-main-video') ||
                         document.querySelector('#shorts-player video') ||
                         document.querySelector('ytd-reel-video-renderer video') ||
                         document.querySelector('#player video');

            // Detect if this is a Shorts page
            this.isShorts = window.location.pathname.startsWith('/shorts/');

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
                this.isShorts = false;
                if (this.updateInterval) {
                    clearInterval(this.updateInterval);
                }
                // Restart ad skipper for new page
                this.initAdSkipper();
                setTimeout(() => this.waitForVideo(), 1000);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    setupVideoListeners() {
        if (!this.video) return;

        ['play', 'pause', 'loadedmetadata', 'ended', 'volumechange', 'ratechange'].forEach(event => {
            this.video.addEventListener(event, () => this.sendStateUpdate());
        });

        // Block play when Focus mode is active
        this.video.addEventListener('play', () => this.checkAndBlockIfFocusMode());

        // Start periodic focus mode check
        this.startFocusModeCheck();
    }

    // Check focus mode status and pause if active
    async checkAndBlockIfFocusMode() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getFocusStatus' });
            if (response && response.isFocusActive) {
                this.focusModeActive = true;
                // Pause the video immediately
                if (this.video && !this.video.paused) {
                    this.video.pause();
                    console.log('[Focus Mode] Video paused - Focus mode is active');
                }
            } else {
                this.focusModeActive = false;
            }
        } catch (e) {
            // Extension context may be invalid, ignore
        }
    }

    // Periodically check focus mode status
    startFocusModeCheck() {
        if (this.focusCheckInterval) {
            clearInterval(this.focusCheckInterval);
        }
        // Check every 2 seconds
        this.focusCheckInterval = setInterval(() => this.updateFocusModeStatus(), 2000);
    }

    async updateFocusModeStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getFocusStatus' });
            if (response) {
                this.focusModeActive = response.isFocusActive;
            }
        } catch (e) {
            // Extension context may be invalid, ignore
        }
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

        let titleElement = null;
        let channelElement = null;

        if (this.isShorts) {
            // Shorts-specific selectors
            const shortsTitleSelectors = [
                'ytd-reel-video-renderer h2.ytd-reel-player-header-renderer',
                'ytd-reel-video-renderer yt-formatted-string.ytd-reel-player-header-renderer',
                '#overlay h2',
                'h2.title',
                'yt-formatted-string#text'
            ];

            for (const selector of shortsTitleSelectors) {
                titleElement = document.querySelector(selector);
                if (titleElement && titleElement.textContent.trim()) break;
            }

            const shortsChannelSelectors = [
                'ytd-reel-video-renderer ytd-channel-name a',
                'ytd-reel-video-renderer #channel-name a',
                '#channel-name yt-formatted-string a',
                '.ytd-reel-player-header-renderer a'
            ];

            for (const selector of shortsChannelSelectors) {
                channelElement = document.querySelector(selector);
                if (channelElement && channelElement.textContent.trim()) break;
            }
        } else {
            // Regular video selectors
            const titleSelectors = [
                'h1.ytd-video-primary-info-renderer yt-formatted-string',
                'h1.title yt-formatted-string',
                'h1.ytd-watch-metadata yt-formatted-string',
                '#title h1 yt-formatted-string',
                'ytd-watch-metadata h1 yt-formatted-string'
            ];

            for (const selector of titleSelectors) {
                titleElement = document.querySelector(selector);
                if (titleElement && titleElement.textContent.trim()) break;
            }

            const channelSelectors = [
                '#channel-name a',
                'ytd-channel-name a',
                '#owner #channel-name a',
                'ytd-video-owner-renderer #channel-name a'
            ];

            for (const selector of channelSelectors) {
                channelElement = document.querySelector(selector);
                if (channelElement && channelElement.textContent.trim()) break;
            }
        }

        const videoId = this.getVideoId();

        return {
            title: titleElement?.textContent?.trim() || (this.isShorts ? 'YouTube Shorts' : 'Video YouTube'),
            channel: channelElement?.textContent?.trim() || 'YouTube',
            duration: this.video.duration || 0,
            currentTime: this.video.currentTime || 0,
            isPlaying: !this.video.paused,
            volume: this.video.volume,
            isMuted: this.video.muted,
            playbackRate: this.video.playbackRate || 1,
            url: window.location.href,
            videoId: videoId,
            thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
            isShorts: this.isShorts
        };
    }

    getVideoId() {
        const url = new URL(window.location.href);

        // Check for Shorts URL format: /shorts/VIDEO_ID
        if (url.pathname.startsWith('/shorts/')) {
            const parts = url.pathname.split('/');
            return parts[2] || null;
        }

        // Regular video URL format: ?v=VIDEO_ID
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

    // ========================================
    // Ad Skipper
    // ========================================
    initAdSkipper() {
        // Clear existing interval if any
        if (this.adSkipperInterval) {
            clearInterval(this.adSkipperInterval);
        }

        // Check for skip button every 500ms
        this.adSkipperInterval = setInterval(() => {
            this.trySkipAd();
        }, 500);
    }

    trySkipAd() {
        // YouTube ad skip button selectors
        const skipSelectors = [
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            '.ytp-skip-ad-button',
            'button.ytp-ad-skip-button-text',
            '.ytp-ad-skip-button-container button',
            '[class*="skip-button"]'
        ];

        for (const selector of skipSelectors) {
            const skipBtn = document.querySelector(selector);
            // Check if button exists and is visible (offsetParent !== null)
            if (skipBtn && skipBtn.offsetParent !== null) {
                skipBtn.click();
                console.log('[Health Reminder] Ad skipped');
                return;
            }
        }
    }

    handleMessage(message, sendResponse) {
        switch (message.action) {
            case 'ping':
                sendResponse({ success: true, ready: this.initialized, hasVideo: !!this.video });
                break;

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

            case 'youtube_setSpeed':
                if (this.video) {
                    const speed = Math.max(0.25, Math.min(2, message.speed));
                    this.video.playbackRate = speed;
                    // Also try to use YouTube's player API if available
                    try {
                        const player = document.querySelector('#movie_player');
                        if (player && player.setPlaybackRate) {
                            player.setPlaybackRate(speed);
                        }
                    } catch (e) {
                        // Ignore if YouTube API not available
                    }
                    this.sendStateUpdate();
                    sendResponse({ success: true, playbackRate: this.video.playbackRate });
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
