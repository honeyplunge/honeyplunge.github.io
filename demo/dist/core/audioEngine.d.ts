export interface AudioEngineOptions {
    sampleRate?: number;
    bufferSize?: number;
    onPulse?: (_timestamp: number) => void;
    onChirp?: (_timestamp: number) => void;
}
export interface PulseGeneratorOptions {
    frequency: number;
    duration: number;
    volume: number;
    type: 'sine' | 'square' | 'sawtooth' | 'triangle';
}
export interface ChirpGeneratorOptions {
    startFrequency: number;
    endFrequency: number;
    duration: number;
    volume: number;
}
export declare class AudioEngine {
    private context;
    private options;
    private masterGain;
    private oscillators;
    private analyzers;
    private scriptProcessors;
    private microphoneStream;
    private isRunning;
    private logger;
    constructor(options?: AudioEngineOptions);
    initialize(): Promise<boolean>;
    getContext(): AudioContext | null;
    getMasterGain(): GainNode | null;
    getMicrophoneStream(): MediaStream | null;
    getCurrentTime(): number;
    getOutputLatency(): number;
    getInputLatency(): number;
    resume(): Promise<boolean>;
    suspend(): Promise<void>;
    close(): Promise<void>;
    playPulse(options: PulseGeneratorOptions): void;
    playChirp(options: ChirpGeneratorOptions): void;
    playTestTone(frequency?: number, duration?: number, volume?: number): void;
    playClick(volume?: number): void;
    createAnalyser(fftSize?: number): AnalyserNode;
    getFrequencyData(analyser: AnalyserNode): Uint8Array;
    getTimeDomainData(analyser: AnalyserNode): Uint8Array;
    getPeakFrequency(analyser: AnalyserNode, sampleRate?: number): number;
    getVolume(analyser: AnalyserNode): number;
    setupMicrophoneInput(): Promise<MediaStreamAudioSourceNode | null>;
    createScriptProcessor(bufferSize?: number, inputChannelCount?: number, outputChannelCount?: number): ScriptProcessorNode;
    private stopAllOscillators;
    private cleanupScriptProcessors;
    cleanupAnalyzers(): void;
    cleanupAll(): void;
    createDelayNode(maxDelayTime?: number): DelayNode;
    createGainNode(): GainNode;
    createBiquadFilterNode(type?: BiquadFilterType): BiquadFilterNode;
    isAudioContextRunning(): boolean;
    isAudioContextSuspended(): boolean;
    isAudioContextClosed(): boolean;
}
export default AudioEngine;
