// Browser compatibility utilities for WebAudio Sync
export class BrowserUtils {
    static getAudioContext() {
        const windowObj = window;
        if (this.audioContextClass) {
            try {
                return new this.audioContextClass();
            }
            catch {
                return null;
            }
        }
        // Try standard AudioContext
        if (windowObj.AudioContext) {
            this.audioContextClass = windowObj.AudioContext;
            try {
                return new windowObj.AudioContext();
            }
            catch {
                return null;
            }
        }
        // Try webkitAudioContext
        if (windowObj.webkitAudioContext) {
            this.audioContextClass = windowObj.webkitAudioContext;
            try {
                return new windowObj.webkitAudioContext();
            }
            catch {
                return null;
            }
        }
        return null;
    }
    static async getAudioContextAsync() {
        try {
            const context = this.getAudioContext();
            if (context) {
                // Resume if suspended (common in mobile browsers)
                if (context.state === 'suspended') {
                    await context.resume();
                }
                return context;
            }
        }
        catch (error) {
            console.error('Failed to create AudioContext:', error);
        }
        return null;
    }
    static isAudioContextSupported() {
        return !!window.AudioContext ||
            !!window.webkitAudioContext;
    }
    static isSafariBrowser() {
        if (this.isSafari !== null) {
            return this.isSafari;
        }
        const userAgent = navigator.userAgent.toLowerCase();
        this.isSafari = userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('edge');
        return this.isSafari;
    }
    static isMobileBrowser() {
        if (this.isMobile !== null) {
            return this.isMobile;
        }
        const userAgent = navigator.userAgent.toLowerCase();
        this.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        return this.isMobile;
    }
    static isIOSBrowser() {
        if (this.isIOS !== null) {
            return this.isIOS;
        }
        const userAgent = navigator.userAgent.toLowerCase();
        this.isIOS = /iphone|ipad|ipod/i.test(userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        return this.isIOS;
    }
    static getUserMedia(constraints = { audio: true }) {
        if (!navigator.mediaDevices) {
            return Promise.resolve(null);
        }
        return navigator.mediaDevices.getUserMedia(constraints)
            .catch(error => {
            console.error('Failed to get user media:', error);
            return null;
        });
    }
    static async hasMicrophoneAccess() {
        try {
            const stream = await this.getUserMedia({ audio: true });
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                return true;
            }
        }
        catch {
            // Ignore
        }
        return false;
    }
    static getOutputLatency(context) {
        if (!context) {
            return 0.02;
        }
        // Try to get native output latency (Firefox returns 0 for some devices like Bluetooth)
        const browserContext = context;
        if (browserContext.outputLatency !== undefined && browserContext.outputLatency > 0) {
            return browserContext.outputLatency;
        }
        // outputLatency is 0 or undefined — browser can't measure it (common with Bluetooth)
        // Fall back to estimates; the pulse check will provide a better measurement
        if (this.isIOSBrowser()) {
            return 0.1; // iOS typically has ~100ms output latency
        }
        if (this.isMobileBrowser()) {
            return 0.08; // Mobile browsers typically 80-100ms
        }
        if (this.isSafariBrowser()) {
            return 0.05; // Safari desktop ~50ms
        }
        return 0.02; // Default for desktop Chrome/Firefox (wired audio)
    }
    static getInputLatency(context) {
        if (!context) {
            return 0.05;
        }
        const browserContext = context;
        if (browserContext.inputLatency !== undefined) {
            return browserContext.inputLatency;
        }
        return 0.05; // Default input latency estimate
    }
    static async waitForUserGesture() {
        return new Promise(resolve => {
            const handleGesture = () => {
                document.removeEventListener('click', handleGesture);
                document.removeEventListener('touchstart', handleGesture);
                document.removeEventListener('keydown', handleGesture);
                resolve();
            };
            document.addEventListener('click', handleGesture);
            document.addEventListener('touchstart', handleGesture);
            document.addEventListener('keydown', handleGesture);
        });
    }
    static getPerformanceNow() {
        return (performance?.now?.() ?? Date.now()) / 1000;
    }
    static getDOMHighResTimeStamp() {
        return performance?.now?.() ?? Date.now();
    }
}
BrowserUtils.audioContextClass = null;
BrowserUtils.isSafari = null;
BrowserUtils.isMobile = null;
BrowserUtils.isIOS = null;
export default BrowserUtils;
