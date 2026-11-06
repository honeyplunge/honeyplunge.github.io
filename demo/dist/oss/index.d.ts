import { LatencyMeasurement, SyncOptions, SyncStatus, WebAudioSyncConfig, PulseCheckResult, SyncEventListener, ManualTapSyncOptions } from '../types';
import { SyncCalibrationResult } from '../core/syncManager';
export interface WebAudioSyncOSSOptions extends SyncOptions {
    config?: WebAudioSyncConfig;
}
export interface WebAudioSyncOSS {
    initialize(): Promise<boolean>;
    getAudioContext(): AudioContext | null;
    startManualTapSync(options?: ManualTapSyncOptions): void;
    detectLatency(): Promise<LatencyMeasurement>;
    performPulseCheck(): Promise<PulseCheckResult>;
    getSyncStatus(): SyncStatus;
    getCurrentLatency(): number;
    updateLatency(measurement: LatencyMeasurement): void;
    setBaselineLatency(latency: number): void;
    startSync(): Promise<boolean>;
    stopSync(): Promise<void>;
    calibrate(): Promise<SyncCalibrationResult>;
    addEventListener(listener: SyncEventListener): void;
    removeEventListener(listener: SyncEventListener): void;
    destroy(): Promise<void>;
    getVersion(): string;
    getTier(): 'oss';
    playTestTone(frequency?: number, duration?: number): Promise<void>;
}
export declare class WebAudioSyncOSSClass implements WebAudioSyncOSS {
    private syncManager;
    private options;
    private logger;
    private isInitialized;
    constructor(options?: WebAudioSyncOSSOptions);
    initialize(): Promise<boolean>;
    getAudioContext(): AudioContext | null;
    startManualTapSync(options?: ManualTapSyncOptions): void;
    detectLatency(): Promise<LatencyMeasurement>;
    performPulseCheck(): Promise<PulseCheckResult>;
    getSyncStatus(): SyncStatus;
    getCurrentLatency(): number;
    updateLatency(measurement: LatencyMeasurement): void;
    setBaselineLatency(latency: number): void;
    startSync(): Promise<boolean>;
    stopSync(): Promise<void>;
    calibrate(): Promise<SyncCalibrationResult>;
    addEventListener(listener: SyncEventListener): void;
    removeEventListener(listener: SyncEventListener): void;
    destroy(): Promise<void>;
    getVersion(): string;
    getTier(): 'oss';
    playTestTone(frequency?: number, duration?: number): Promise<void>;
    static isSupported(): Promise<boolean>;
    static hasMicrophoneAccess(): Promise<boolean>;
}
export declare function createWebAudioSyncOSS(options?: WebAudioSyncOSSOptions): WebAudioSyncOSS;
export declare function getWebAudioSyncOSS(): WebAudioSyncOSS | null;
export default WebAudioSyncOSSClass;
