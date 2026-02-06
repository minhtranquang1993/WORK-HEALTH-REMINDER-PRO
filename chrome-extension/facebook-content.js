/**
 * Facebook Reels Content Script
 * Chay tren cac trang Facebook Reels de lay thong tin video va dieu khien playback
 * Tuong tu nhu YouTube content script nhung khong co tinh nang thay doi toc do
 */

class FacebookReelsController {
    constructor() {
        this.video = null;
        this.initialized = false;
        this.updateInterval = null;
        this.focusModeActive = false;
        this.focusCheckInterval = null;
        this.isReel = false;
        this.init();
    }

    init() {
        // Check if this is a Reel page
        this.checkIfReelPage();
        
        // Wait for video element
        this.waitForVideo();

        // Listen for messages from extension
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sendResponse);
            return true; // Keep channel open for async response
        });

        // Observe for SPA navigation (Facebook is a SPA)
        this.observeNavigation();
    }

    checkIfReelPage() {
        const url = window.location.href;
        const pathname = window.location.pathname;

        // Only match Facebook Reel URLs:
        // - facebook.com/reel/123456
        // - facebook.com/reels/123456
        // - facebook.com/reels/videos/123456
        // Do NOT match: messenger, pancake, watch (normal videos), stories, etc.

        // Check if it's a reel URL pattern
        const isReelUrl = pathname.startsWith('/reel/') ||
                          pathname.startsWith('/reels/') ||
                          pathname.match(/^\/[^\/]+\/reels\//); // username/reels/

        // Exclude non-reel pages explicitly
        const excludedPaths = [
            '/messages',
            '/messenger',
            '/watch',
            '/stories',
            '/gaming',
            '/marketplace',
            '/groups',
            '/events',
            '/pages',
            '/ads',
            '/business'
        ];

        const isExcluded = excludedPaths.some(path => pathname.startsWith(path));

        this.isReel = isReelUrl && !isExcluded;
        return this.isReel;
    }

    waitForVideo() {
        const checkVideo = () => {
            // Only proceed if this is a Reel page
            if (!this.checkIfReelPage()) {
                setTimeout(checkVideo, 1000);
                return;
            }

            // Try multiple selectors for Facebook Reels video
            this.video = document.querySelector('video[src*="facebook"]') ||
                         document.querySelector('div[data-pagelet*="Reels"] video') ||
                         document.querySelector('[aria-label*="Reel"] video') ||
                         document.querySelector('video');

            if (this.video && this.isReel) {
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
        // Facebook uses History API for navigation
        let lastUrl = location.href;

        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                // Reset and wait for new video
                this.video = null;
                this.initialized = false;
                this.isReel = false;
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
                    console.log('[Focus Mode] Facebook Reel paused - Focus mode is active');
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
        if (!this.video || !this.isReel) return null;

        // Try to get reel info from page
        let titleElement = null;
        let authorElement = null;

        // Facebook Reel selectors - try multiple options
        const titleSelectors = [
            '[data-ad-preview="message"]',
            'span[dir="auto"]',
            '[aria-label*="caption"]',
            '.x1lliihq'
        ];

        for (const selector of titleSelectors) {
            titleElement = document.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) break;
        }

        const authorSelectors = [
            'a[role="link"] strong',
            'a[aria-label*="profile"]',
            'h2 a',
            '.x1heor9g a'
        ];

        for (const selector of authorSelectors) {
            authorElement = document.querySelector(selector);
            if (authorElement && authorElement.textContent.trim()) break;
        }

        const reelId = this.getReelId();

        return {
            title: titleElement?.textContent?.trim()?.substring(0, 100) || 'Facebook Reel',
            channel: authorElement?.textContent?.trim() || 'Facebook',
            duration: this.video.duration || 0,
            currentTime: this.video.currentTime || 0,
            isPlaying: !this.video.paused,
            volume: this.video.volume,
            isMuted: this.video.muted,
            playbackRate: 1, // Facebook Reels don't support speed change
            url: window.location.href,
            videoId: reelId,
            thumbnailUrl: null, // Facebook doesn't have easy thumbnail access
            isReel: true,
            platform: 'facebook'
        };
    }

    getReelId() {
        const url = new URL(window.location.href);
        
        // Check for Reel URL format: /reel/REEL_ID
        if (url.pathname.includes('/reel/')) {
            const parts = url.pathname.split('/reel/');
            if (parts[1]) {
                return parts[1].split('/')[0].split('?')[0];
            }
        }
        
        // Check for Reels URL format: /reels/REEL_ID
        if (url.pathname.includes('/reels/')) {
            const parts = url.pathname.split('/reels/');
            if (parts[1]) {
                return parts[1].split('/')[0].split('?')[0];
            }
        }

        return null;
    }

    sendStateUpdate() {
        // Only send state update if this is a Reel page
        if (!this.isReel) {
            return;
        }

        const info = this.getVideoInfo();
        if (info) {
            try {
                chrome.runtime.sendMessage({
                    action: 'facebookStateUpdate',
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
            case 'ping':
                sendResponse({ success: true, ready: this.initialized, hasVideo: !!this.video, isReel: this.isReel });
                break;

            case 'facebook_getState':
                sendResponse({ success: true, videoInfo: this.getVideoInfo() });
                break;

            case 'facebook_playPause':
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

            case 'facebook_setVolume':
                if (this.video) {
                    this.video.volume = Math.max(0, Math.min(1, message.volume));
                    sendResponse({ success: true, volume: this.video.volume });
                } else {
                    sendResponse({ success: false, error: 'No video found' });
                }
                break;

            case 'facebook_toggleMute':
                if (this.video) {
                    this.video.muted = !this.video.muted;
                    sendResponse({ success: true, isMuted: this.video.muted });
                } else {
                    sendResponse({ success: false, error: 'No video found' });
                }
                break;

            case 'facebook_seek':
                if (this.video) {
                    this.video.currentTime = message.time;
                    sendResponse({ success: true, currentTime: this.video.currentTime });
                } else {
                    sendResponse({ success: false, error: 'No video found' });
                }
                break;

            // Note: Facebook Reels don't support speed change like YouTube
            case 'facebook_setSpeed':
                sendResponse({ success: false, error: 'Facebook Reels không hỗ trợ thay đổi tốc độ' });
                break;

            // Navigate to next reel (simulate ArrowDown key)
            case 'facebook_next':
                this.navigateReel('next');
                sendResponse({ success: true });
                break;

            // Navigate to previous reel (simulate ArrowUp key)
            case 'facebook_prev':
                this.navigateReel('prev');
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    // Navigate to next/previous reel
    navigateReel(direction) {
        console.log('[Facebook Reel] Navigating:', direction);

        // Method 1: Find and click the arrow buttons (circled arrows on the right side)
        // These are the ⌃ ⌄ buttons visible in the Facebook Reels UI
        const allButtons = document.querySelectorAll('[role="button"], button, div[tabindex="0"]');

        for (const btn of allButtons) {
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const svg = btn.querySelector('svg');

            // Check for next/down button
            if (direction === 'next') {
                if (ariaLabel.includes('next') ||
                    ariaLabel.includes('tiếp') ||
                    ariaLabel.includes('down') ||
                    ariaLabel.includes('xuống')) {
                    console.log('[Facebook Reel] Found next button via aria-label');
                    btn.click();
                    return;
                }
            }

            // Check for prev/up button
            if (direction === 'prev') {
                if (ariaLabel.includes('previous') ||
                    ariaLabel.includes('trước') ||
                    ariaLabel.includes('up') ||
                    ariaLabel.includes('lên')) {
                    console.log('[Facebook Reel] Found prev button via aria-label');
                    btn.click();
                    return;
                }
            }
        }

        // Method 2: Find navigation buttons by their position and SVG content
        // The down arrow button is usually at the bottom right
        const svgButtons = document.querySelectorAll('div[role="button"] svg, [tabindex="0"] svg');
        for (const svg of svgButtons) {
            const parent = svg.closest('[role="button"], [tabindex="0"]');
            if (!parent) continue;

            // Check if SVG contains path that looks like an arrow
            const paths = svg.querySelectorAll('path');
            for (const path of paths) {
                const d = path.getAttribute('d') || '';
                // Down arrow paths often contain patterns going down
                if (direction === 'next' && parent.getBoundingClientRect().bottom > window.innerHeight * 0.5) {
                    // Button is in lower half - might be next button
                    const rect = parent.getBoundingClientRect();
                    if (rect.right > window.innerWidth * 0.8) {
                        console.log('[Facebook Reel] Found potential next button by position');
                        parent.click();
                        return;
                    }
                }
            }
        }

        // Method 3: Scroll the reel container
        const scrollContainers = [
            document.querySelector('[data-pagelet*="Reels"]'),
            document.querySelector('[role="main"]'),
            document.querySelector('div[style*="scroll"]'),
            this.video?.closest('[class*="reel"]'),
            this.video?.parentElement?.parentElement?.parentElement
        ];

        for (const container of scrollContainers) {
            if (container && container.scrollHeight > container.clientHeight) {
                const scrollAmount = direction === 'next' ? window.innerHeight : -window.innerHeight;
                container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
                console.log('[Facebook Reel] Scrolled container');
                return;
            }
        }

        // Method 4: Dispatch keyboard event on the video or focused element
        const key = direction === 'next' ? 'ArrowDown' : 'ArrowUp';
        const targets = [
            document.activeElement,
            this.video,
            document.querySelector('[data-pagelet*="Reels"]'),
            document.body
        ];

        for (const target of targets) {
            if (target) {
                const keyEvent = new KeyboardEvent('keydown', {
                    key: key,
                    code: key,
                    keyCode: key === 'ArrowDown' ? 40 : 38,
                    which: key === 'ArrowDown' ? 40 : 38,
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                target.dispatchEvent(keyEvent);
                console.log('[Facebook Reel] Dispatched key event on:', target.tagName);
            }
        }

        // Method 5: Use wheel event to simulate scroll
        const wheelTarget = this.video?.closest('div') || document.body;
        const wheelEvent = new WheelEvent('wheel', {
            deltaY: direction === 'next' ? 100 : -100,
            bubbles: true,
            cancelable: true,
            view: window
        });
        wheelTarget.dispatchEvent(wheelEvent);
        console.log('[Facebook Reel] Dispatched wheel event');
    }
}

// Initialize controller when script loads - only on Reel pages
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new FacebookReelsController());
} else {
    new FacebookReelsController();
}
