// Core Audio Engine for WebAudio Sync
import { BrowserUtils } from '../utils/browser.js';
import { Logger } from '../utils/logger.js';
export class AudioEngine {
    constructor(options = {}) {
        this.context = null;
        this.masterGain = null;
        this.oscillators = [];
        this.analyzers = [];
        this.scriptProcessors = [];
        this.microphoneStream = null;
        this.isRunning = false;
        this.options = {
            sampleRate: 44100,
            bufferSize: 4096,
            ...options,
        };
        this.logger = new Logger({}, 'AudioEngine');
    }
    async initialize() {
        try {
            this.context = await BrowserUtils.getAudioContextAsync();
            if (!this.context) {
                this.logger.error('Failed to create AudioContext');
                return false;
            }
            // Create master gain node
            this.masterGain = this.context.createGain();
            this.masterGain.connect(this.context.destination);
            this.masterGain.gain.value = 1.0;
            this.isRunning = true;
            this.logger.info('AudioEngine initialized', {
                sampleRate: this.context.sampleRate,
                state: this.context.state,
            });
            return true;
        }
        catch (error) {
            this.logger.error('AudioEngine initialization failed', error);
            return false;
        }
    }
    getContext() {
        return this.context;
    }
    getMasterGain() {
        return this.masterGain;
    }
    getMicrophoneStream() {
        return this.microphoneStream;
    }
    getCurrentTime() {
        if (!this.context) {
            return BrowserUtils.getPerformanceNow();
        }
        return this.context.currentTime;
    }
    getOutputLatency() {
        return BrowserUtils.getOutputLatency(this.context);
    }
    getInputLatency() {
        if (!this.context) {
            return 0.05; // Default
        }
        return BrowserUtils.getInputLatency(this.context);
    }
    async resume() {
        if (!this.context) {
            return false;
        }
        try {
            if (this.context.state === 'suspended') {
                await this.context.resume();
                this.logger.info('AudioContext resumed');
            }
            return this.context.state === 'running';
        }
        catch (error) {
            this.logger.error('Failed to resume AudioContext', error);
            return false;
        }
    }
    suspend() {
        if (!this.context) {
            return Promise.resolve();
        }
        return this.context.suspend();
    }
    close() {
        this.isRunning = false;
        this.stopAllOscillators();
        this.cleanupScriptProcessors();
        if (this.context) {
            return this.context.close();
        }
        return Promise.resolve();
    }
    // Pulse generation methods
    playPulse(options) {
        if (!this.context || !this.masterGain) {
            this.logger.warn('AudioEngine not initialized');
            return;
        }
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = options.type;
        oscillator.frequency.value = options.frequency;
        gain.gain.value = 0;
        const now = this.context.currentTime;
        const attack = Math.min(0.01, options.duration * 0.25);
        const release = Math.min(0.01, options.duration * 0.25);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(options.volume, now + attack);
        gain.gain.setValueAtTime(options.volume, now + options.duration - release);
        gain.gain.linearRampToValueAtTime(0, now + options.duration);
        oscillator.connect(gain);
        gain.connect(this.masterGain);
        const startTime = this.context.currentTime;
        oscillator.start(startTime);
        oscillator.stop(startTime + options.duration);
        // Clean up after pulse ends
        oscillator.onended = () => {
            const index = this.oscillators.indexOf(oscillator);
            if (index > -1) {
                this.oscillators.splice(index, 1);
            }
            if (this.options.onPulse) {
                this.options.onPulse(startTime);
            }
        };
        this.oscillators.push(oscillator);
    }
    playChirp(options) {
        if (!this.context || !this.masterGain) {
            this.logger.warn('AudioEngine not initialized');
            return;
        }
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'sine';
        // Set up frequency sweep
        const startTime = this.context.currentTime;
        const endTime = startTime + options.duration;
        oscillator.frequency.setValueAtTime(options.startFrequency, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, endTime);
        gain.gain.value = 0;
        const chirpAttack = Math.min(0.01, options.duration * 0.25);
        const chirpRelease = Math.min(0.01, options.duration * 0.25);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(options.volume, startTime + chirpAttack);
        gain.gain.setValueAtTime(options.volume, endTime - chirpRelease);
        gain.gain.linearRampToValueAtTime(0, endTime);
        oscillator.connect(gain);
        gain.connect(this.masterGain);
        oscillator.start(startTime);
        oscillator.stop(endTime);
        oscillator.onended = () => {
            const index = this.oscillators.indexOf(oscillator);
            if (index > -1) {
                this.oscillators.splice(index, 1);
            }
            if (this.options.onChirp) {
                this.options.onChirp(startTime);
            }
        };
        this.oscillators.push(oscillator);
    }
    playTestTone(frequency = 1000, duration = 0.5, volume = 0.5) {
        this.playPulse({
            frequency,
            duration,
            volume,
            type: 'sine',
        });
    }
    playClick(volume = 0.5) {
        if (!this.context || !this.masterGain) {
            this.logger.warn('AudioEngine not initialized');
            return;
        }
        // Noise-burst click: 15ms of white noise with exponential decay
        // Falls back to a short sine pulse if createBuffer is unavailable (e.g. test mocks)
        if (typeof this.context.createBuffer !== 'function') {
            this.playPulse({
                frequency: 1000,
                duration: 0.05,
                volume,
                type: 'sine',
            });
            return;
        }
        const duration = 0.015;
        const sampleRate = this.context.sampleRate;
        const bufferSize = Math.floor(duration * sampleRate);
        const buffer = this.context.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const t = i / bufferSize;
            data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 20);
        }
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        const gain = this.context.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(this.masterGain);
        const now = this.context.currentTime;
        source.start(now);
        source.stop(now + duration);
    }
    // Audio analysis methods
    createAnalyser(fftSize = 2048) {
        if (!this.context) {
            throw new Error('AudioEngine not initialized');
        }
        const analyser = this.context.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.85;
        this.analyzers.push(analyser);
        return analyser;
    }
    getFrequencyData(analyser) {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buffer);
        return buffer;
    }
    getTimeDomainData(analyser) {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(buffer);
        return buffer;
    }
    getPeakFrequency(analyser, sampleRate = 44100) {
        const data = this.getFrequencyData(analyser);
        let maxIndex = 0;
        let maxValue = 0;
        for (let i = 0; i < data.length; i++) {
            if (data[i] > maxValue) {
                maxValue = data[i];
                maxIndex = i;
            }
        }
        return (maxIndex * sampleRate) / analyser.fftSize;
    }
    getVolume(analyser) {
        const data = this.getFrequencyData(analyser);
        const sum = data.reduce((acc, val) => acc + val, 0);
        return sum / data.length / 255; // Normalize to 0-1
    }
    // Microphone input handling
    async setupMicrophoneInput() {
        if (!this.context) {
            this.logger.warn('AudioEngine not initialized');
            return null;
        }
        try {
            // Raw capture: echo cancellation would suppress the loopback sweep from
            // the mic (it matches the output), noise suppression distorts it — both
            // destroy the cross-correlation peak the loopback relies on
            const stream = await BrowserUtils.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });
            if (!stream) {
                this.logger.warn('No microphone access');
                return null;
            }
            const source = this.context.createMediaStreamSource(stream);
            this.microphoneStream = stream;
            return source;
        }
        catch (error) {
            this.logger.error('Failed to setup microphone input', error);
            return null;
        }
    }
    // Script processor for real-time audio analysis
    createScriptProcessor(bufferSize = 4096, inputChannelCount = 1, outputChannelCount = 1) {
        if (!this.context) {
            throw new Error('AudioEngine not initialized');
        }
        // Use AudioWorklet if available (modern browsers)
        if (this.context.audioWorklet) {
            // For now, fall back to ScriptProcessorNode
            // In production, you'd register an AudioWorkletProcessor
        }
        const processor = this.context.createScriptProcessor(bufferSize, inputChannelCount, outputChannelCount);
        this.scriptProcessors.push(processor);
        return processor;
    }
    // Cleanup methods
    stopAllOscillators() {
        this.oscillators.forEach(osc => {
            try {
                osc.stop();
                osc.disconnect();
            }
            catch {
                // Ignore errors during cleanup
            }
        });
        this.oscillators = [];
    }
    cleanupScriptProcessors() {
        this.scriptProcessors.forEach(processor => {
            try {
                processor.disconnect();
            }
            catch {
                // Ignore errors during cleanup
            }
        });
        this.scriptProcessors = [];
    }
    cleanupAnalyzers() {
        this.analyzers.forEach(analyser => {
            try {
                analyser.disconnect();
            }
            catch {
                // Ignore errors during cleanup
            }
        });
        this.analyzers = [];
    }
    cleanupAll() {
        this.stopAllOscillators();
        this.cleanupScriptProcessors();
        this.cleanupAnalyzers();
    }
    // Utility methods
    createDelayNode(maxDelayTime = 1) {
        if (!this.context) {
            throw new Error('AudioEngine not initialized');
        }
        return this.context.createDelay(maxDelayTime);
    }
    createGainNode() {
        if (!this.context) {
            throw new Error('AudioEngine not initialized');
        }
        return this.context.createGain();
    }
    createBiquadFilterNode(type = 'lowpass') {
        if (!this.context) {
            throw new Error('AudioEngine not initialized');
        }
        const filter = this.context.createBiquadFilter();
        filter.type = type;
        return filter;
    }
    // Audio context state management
    isAudioContextRunning() {
        if (!this.context) {
            return false;
        }
        return this.context.state === 'running';
    }
    isAudioContextSuspended() {
        if (!this.context) {
            return false;
        }
        return this.context.state === 'suspended';
    }
    isAudioContextClosed() {
        if (!this.context) {
            return true;
        }
        return this.context.state === 'closed';
    }
}
export default AudioEngine;
