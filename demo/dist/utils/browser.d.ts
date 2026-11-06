export declare class BrowserUtils {
    private static audioContextClass;
    private static isSafari;
    private static isMobile;
    private static isIOS;
    static getAudioContext(): AudioContext | null;
    static getAudioContextAsync(): Promise<AudioContext | null>;
    static isAudioContextSupported(): boolean;
    static isSafariBrowser(): boolean;
    static isMobileBrowser(): boolean;
    static isIOSBrowser(): boolean;
    static getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream | null>;
    static hasMicrophoneAccess(): Promise<boolean>;
    static getOutputLatency(context: AudioContext | null): number;
    static getInputLatency(context: AudioContext | null): number;
    static waitForUserGesture(): Promise<void>;
    static getPerformanceNow(): number;
    static getDOMHighResTimeStamp(): number;
}
export default BrowserUtils;
