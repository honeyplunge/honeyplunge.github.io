export interface AudioContextOptions {
    sampleRate?: number;
    latencyHint?: 'interactive' | 'playback' | 'balanced' | 'realtime';
}
export interface LatencyMeasurement {
    outputLatency: number;
    inputLatency: number;
    totalLatency: number;
    timestamp: number;
    confidence: number;
    method: 'native' | 'pulse' | 'acoustic' | 'manual';
}
export interface SyncStatus {
    isSynced: boolean;
    currentLatency: number;
    drift: number;
    timestamp: number;
    lastCheck: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
}
export interface PulseCheckOptions {
    duration?: number;
    frequency?: number;
    volume?: number;
    threshold?: number;
    maxRetries?: number;
}
export interface AcousticLoopbackOptions {
    chirpFrequency?: number;
    chirpDuration?: number;
    detectionTimeout?: number;
    calibrationRounds?: number;
    noiseGateThreshold?: number;
    sweepStartFrequency?: number;
    sweepEndFrequency?: number;
    sweepRepeats?: number;
    maxLatency?: number;
    minCorrelation?: number;
    preRoll?: number;
}
export interface DriftCorrectionOptions {
    enabled?: boolean;
    predictionWindow?: number;
    correctionStrength?: number;
    maxCorrection?: number;
    historySize?: number;
}
export interface SyncOptions {
    audioContext?: AudioContext;
    pulseCheck?: PulseCheckOptions;
    acousticLoopback?: AcousticLoopbackOptions;
    driftCorrection?: DriftCorrectionOptions;
    onSyncChange?: (status: SyncStatus) => void;
    onLatencyUpdate?: (measurement: LatencyMeasurement) => void;
    onError?: (error: Error) => void;
}
export interface SyncManagerOptions extends SyncOptions {
    config?: WebAudioSyncConfig;
}
export interface TapEvent {
    timestamp: number;
    type: 'tap' | 'pulse' | 'chirp';
    expectedTime?: number;
}
export interface CalibrationResult {
    success: boolean;
    latency: number;
    measurements: LatencyMeasurement[];
    averageLatency: number;
    stdDeviation: number;
}
export interface LicenseStatus {
    isValid: boolean;
    tier: 'oss' | 'pro';
    expiresAt?: number;
    features: string[];
}
export interface WebAudioSyncConfig {
    licenseKey?: string;
    enableAnalytics?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'none';
}
export type SyncEventType = 'sync:start' | 'sync:stop' | 'sync:change' | 'latency:update' | 'calibration:start' | 'calibration:complete' | 'calibration:fail' | 'drift:correction' | 'error';
export interface SyncEvent {
    type: SyncEventType;
    data?: unknown;
    timestamp: number;
}
export interface SyncEventListener {
    (event: SyncEvent): void;
}
export interface ManualTapSyncOptions {
    pulseCount?: number;
    pulseInterval?: number;
    onTap?: (timestamp: number, expectedTime?: number) => void;
}
export interface PulseCheckResult {
    success: boolean;
    latency: number;
    confidence: number;
    measurements: number[];
    timestamp: number;
}
export interface WebAudioSyncOSS {
    initialize(): Promise<boolean>;
    getAudioContext(): AudioContext | null;
    startManualTapSync(options?: ManualTapSyncOptions): void;
    detectLatency(): Promise<LatencyMeasurement>;
    performPulseCheck(): Promise<PulseCheckResult>;
    getSyncStatus(): SyncStatus;
    getCurrentLatency(): number;
    startSync(): Promise<boolean>;
    stopSync(): Promise<void>;
    calibrate(): Promise<CalibrationResult>;
    addEventListener(listener: SyncEventListener): void;
    removeEventListener(listener: SyncEventListener): void;
    destroy(): Promise<void>;
    getVersion(): string;
    getTier(): 'oss';
    playTestTone(frequency?: number, duration?: number): Promise<void>;
}
export interface WebAudioSyncPro {
    initialize(): Promise<boolean>;
    setLicenseKey(key: string): Promise<boolean>;
    getLicenseStatus(): LicenseStatus;
    getAudioContext(): AudioContext | null;
    startManualTapSync(options?: ManualTapSyncOptions): void;
    measureLatencyWithAcousticLoopback(): Promise<{
        success: boolean;
        latency: number;
        confidence: number;
    }>;
    detectLatency(): Promise<LatencyMeasurement>;
    performPulseCheck(): Promise<PulseCheckResult>;
    startDriftCorrection(): void;
    stopDriftCorrection(): void;
    getDriftTrend(): number;
    getSyncStatus(): SyncStatus;
    getCurrentLatency(): number;
    getCurrentDrift(): number;
    startSync(): Promise<boolean>;
    stopSync(): Promise<void>;
    calibrate(): Promise<CalibrationResult>;
    addEventListener(listener: SyncEventListener): void;
    removeEventListener(listener: SyncEventListener): void;
    destroy(): Promise<void>;
    getVersion(): string;
    getTier(): 'pro';
    playTestTone(frequency?: number, duration?: number): Promise<void>;
}
export interface BrowserAudioContext {
    outputLatency?: number;
    inputLatency?: number;
}
export interface WindowWithWebAudio extends Window {
    AudioContext?: new (options?: AudioContextOptions) => AudioContext;
    webkitAudioContext?: new (options?: AudioContextOptions) => AudioContext;
}
