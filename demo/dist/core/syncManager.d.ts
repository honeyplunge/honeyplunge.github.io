import { LatencyMeasurement, SyncOptions, SyncStatus, TapEvent, SyncEventListener, WebAudioSyncConfig, PulseCheckResult } from '../types';
import { AudioEngine } from './audioEngine';
import { DriftCorrection } from './driftCorrector';
export interface SyncManagerOptions extends SyncOptions {
    config?: WebAudioSyncConfig;
}
export interface SyncCalibrationResult {
    success: boolean;
    latency: number;
    outputLatency?: number;
    measurements: LatencyMeasurement[];
    confidence: number;
    method?: LatencyMeasurement['method'];
}
export declare class SyncManager {
    private audioEngine;
    private latencyDetector;
    private driftCorrector;
    private options;
    private config;
    private logger;
    private _isSyncing;
    private _isCalibrating;
    private currentLatency;
    private baselineLatency;
    private currentDrift;
    private syncOffset;
    private eventListeners;
    private calibrationTimeout;
    constructor(options?: SyncManagerOptions);
    isSyncing(): boolean;
    isCalibrating(): boolean;
    initialize(): Promise<boolean>;
    getAudioContext(): AudioContext | null;
    getAudioEngine(): AudioEngine;
    startSync(): Promise<boolean>;
    stopSync(): Promise<void>;
    startManualTapSync(options?: {
        pulseCount?: number;
        pulseInterval?: number;
        onTap?: (tap: TapEvent) => void;
    }): void;
    detectLatency(): Promise<LatencyMeasurement>;
    performPulseCheck(): Promise<PulseCheckResult>;
    calibrate(): Promise<SyncCalibrationResult>;
    applyDriftCorrection(): DriftCorrection | null;
    getDriftTrend(): number;
    getCurrentDrift(): number;
    getSyncStatus(): SyncStatus;
    getCurrentLatency(): number;
    /**
     * Set the baseline latency that drift is measured against.
     * Called by calibrate(); exposed so integrators can re-baseline after
     * intentionally changing the output device.
     */
    setBaselineLatency(latency: number): void;
    addEventListener(listener: SyncEventListener): void;
    removeEventListener(listener: SyncEventListener): void;
    private emitEvent;
    private handleLatencyUpdate;
    /**
     * Feed an externally produced latency measurement (e.g. Pro acoustic
     * loopback) into the sync manager: updates the current latency and the
     * drift history (drift = measured - baseline).
     */
    updateLatency(measurement: LatencyMeasurement): void;
    private handleError;
    destroy(): Promise<void>;
}
