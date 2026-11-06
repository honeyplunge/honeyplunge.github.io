"use strict";
// Core Audio Engine for WebAudio Sync
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioEngine = void 0;
const browser_1 = require("../utils/browser");
const logger_1 = require("../utils/logger");
class AudioEngine {
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
        this.logger = new logger_1.Logger({}, 'AudioEngine');
    }
    async initialize() {
        try {
            this.context = await browser_1.BrowserUtils.getAudioContextAsync();
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
            return browser_1.BrowserUtils.getPerformanceNow();
        }
        return this.context.currentTime;
    }
    getOutputLatency() {
        return browser_1.BrowserUtils.getOutputLatency(this.context);
    }
    getInputLatency() {
        if (!this.context) {
            return 0.05; // Default
        }
        return browser_1.BrowserUtils.getInputLatency(this.context);
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
            const stream = await browser_1.BrowserUtils.getUserMedia({
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
exports.AudioEngine = AudioEngine;
exports.default = AudioEngine;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9FbmdpbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvY29yZS9hdWRpb0VuZ2luZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsc0NBQXNDOzs7QUFFdEMsOENBQWdEO0FBQ2hELDRDQUF5QztBQXVCekMsTUFBYSxXQUFXO0lBV3RCLFlBQWEsVUFBOEIsRUFBRTtRQVZyQyxZQUFPLEdBQXdCLElBQUksQ0FBQztRQUVwQyxlQUFVLEdBQW9CLElBQUksQ0FBQztRQUNuQyxnQkFBVyxHQUFxQixFQUFFLENBQUM7UUFDbkMsY0FBUyxHQUFtQixFQUFFLENBQUM7UUFDL0IscUJBQWdCLEdBQTBCLEVBQUUsQ0FBQztRQUM3QyxxQkFBZ0IsR0FBdUIsSUFBSSxDQUFDO1FBQzVDLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFJakMsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNiLFVBQVUsRUFBRSxLQUFLO1lBQ2pCLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLEdBQUcsT0FBTztTQUNYLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksZUFBTSxDQUFDLEVBQUUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRUQsS0FBSyxDQUFDLFVBQVU7UUFDZCxJQUFJLENBQUM7WUFDSCxJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sc0JBQVksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2xCLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUM7Z0JBRW5ELE9BQU8sS0FBSyxDQUFDO1lBQ2YsQ0FBQztZQUVELDBCQUEwQjtZQUMxQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDNUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFD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QyxxQkFBcUI7UUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUFBLE9BQU8sS0FBSyxDQUFDO1FBQUEsQ0FBQztRQUVsQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxLQUFLLFNBQVMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsdUJBQXVCO1FBQ3JCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFBQSxPQUFPLEtBQUssQ0FBQztRQUFBLENBQUM7UUFFbEMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssS0FBSyxXQUFXLENBQUM7SUFDNUMsQ0FBQztJQUVELG9CQUFvQjtRQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQUEsT0FBTyxJQUFJLENBQUM7UUFBQSxDQUFDO1FBRWpDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssUUFBUSxDQUFDO0lBQ3pDLENBQUM7Q0FDRjtBQS9lRCxrQ0ErZUM7QUFFRCxrQkFBZSxXQUFXLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3JlIEF1ZGlvIEVuZ2luZSBmb3IgV2ViQXVkaW8gU3luY1xuXG5pbXBvcnQgeyBCcm93c2VyVXRpbHMgfSBmcm9tICcuLi91dGlscy9icm93c2VyJztcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXVkaW9FbmdpbmVPcHRpb25zIHtcbiAgc2FtcGxlUmF0ZT86IG51bWJlcjtcbiAgYnVmZmVyU2l6ZT86IG51bWJlcjtcbiAgb25QdWxzZT86IChfdGltZXN0YW1wOiBudW1iZXIpID0+IHZvaWQ7XG4gIG9uQ2hpcnA/OiAoX3RpbWVzdGFtcDogbnVtYmVyKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFB1bHNlR2VuZXJhdG9yT3B0aW9ucyB7XG4gIGZyZXF1ZW5jeTogbnVtYmVyO1xuICBkdXJhdGlvbjogbnVtYmVyO1xuICB2b2x1bWU6IG51bWJlcjtcbiAgdHlwZTogJ3NpbmUnIHwgJ3NxdWFyZScgfCAnc2F3dG9vdGgnIHwgJ3RyaWFuZ2xlJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDaGlycEdlbmVyYXRvck9wdGlvbnMge1xuICBzdGFydEZyZXF1ZW5jeTogbnVtYmVyO1xuICBlbmRGcmVxdWVuY3k6IG51bWJlcjtcbiAgZHVyYXRpb246IG51bWJlcjtcbiAgdm9sdW1lOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBBdWRpb0VuZ2luZSB7XG4gIHByaXZhdGUgY29udGV4dDogQXVkaW9Db250ZXh0IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgb3B0aW9uczogQXVkaW9FbmdpbmVPcHRpb25zO1xuICBwcml2YXRlIG1hc3RlckdhaW46IEdhaW5Ob2RlIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgb3NjaWxsYXRvcnM6IE9zY2lsbGF0b3JOb2RlW10gPSBbXTtcbiAgcHJpdmF0ZSBhbmFseXplcnM6IEFuYWx5c2VyTm9kZVtdID0gW107XG4gIHByaXZhdGUgc2NyaXB0UHJvY2Vzc29yczogU2NyaXB0UHJvY2Vzc29yTm9kZVtdID0gW107XG4gIHByaXZhdGUgbWljcm9waG9uZVN0cmVhbTogTWVkaWFTdHJlYW0gfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBpc1J1bm5pbmc6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBsb2dnZXI6IExvZ2dlcjtcblxuICBjb25zdHJ1Y3RvciAob3B0aW9uczogQXVkaW9FbmdpbmVPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICBzYW1wbGVSYXRlOiA0NDEwMCxcbiAgICAgIGJ1ZmZlclNpemU6IDQwOTYsXG4gICAgICAuLi5vcHRpb25zLFxuICAgIH07XG4gICAgdGhpcy5sb2dnZXIgPSBuZXcgTG9nZ2VyKHt9LCAnQXVkaW9FbmdpbmUnKTtcbiAgfVxuXG4gIGFzeW5jIGluaXRpYWxpemUgKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmNvbnRleHQgPSBhd2FpdCBCcm93c2VyVXRpbHMuZ2V0QXVkaW9Db250ZXh0QXN5bmMoKTtcbiAgICAgIGlmICghdGhpcy5jb250ZXh0KSB7XG4gICAgICAgIHRoaXMubG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gY3JlYXRlIEF1ZGlvQ29udGV4dCcpO1xuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIG1hc3RlciBnYWluIG5vZGVcbiAgICAgIHRoaXMubWFzdGVyR2FpbiA9IHRoaXMuY29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICB0aGlzLm1hc3RlckdhaW4uY29ubmVjdCh0aGlzLmNvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgdGhpcy5tYXN0ZXJHYWluLmdhaW4udmFsdWUgPSAxLjA7XG5cbiAgICAgIHRoaXMuaXNSdW5uaW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0F1ZGlvRW5naW5lIGluaXRpYWxpemVkJywge1xuICAgICAgICBzYW1wbGVSYXRlOiB0aGlzLmNvbnRleHQuc2FtcGxlUmF0ZSxcbiAgICAgICAgc3RhdGU6IHRoaXMuY29udGV4dC5zdGF0ZSxcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5sb2dnZXIuZXJyb3IoJ0F1ZGlvRW5naW5lIGluaXRpYWxpemF0aW9uIGZhaWxlZCcsIGVycm9yKTtcblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGdldENvbnRleHQgKCk6IEF1ZGlvQ29udGV4dCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmNvbnRleHQ7XG4gIH1cblxuICBnZXRNYXN0ZXJHYWluICgpOiBHYWluTm9kZSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLm1hc3RlckdhaW47XG4gIH1cblxuICBnZXRNaWNyb3Bob25lU3RyZWFtICgpOiBNZWRpYVN0cmVhbSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLm1pY3JvcGhvbmVTdHJlYW07XG4gIH1cblxuICBnZXRDdXJyZW50VGltZSAoKTogbnVtYmVyIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCkge1xuICAgICAgcmV0dXJuIEJyb3dzZXJVdGlscy5nZXRQZXJmb3JtYW5jZU5vdygpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNvbnRleHQuY3VycmVudFRpbWU7XG4gIH1cblxuICBnZXRPdXRwdXRMYXRlbmN5ICgpOiBudW1iZXIge1xuICAgIHJldHVybiBCcm93c2VyVXRpbHMuZ2V0T3V0cHV0TGF0ZW5jeSh0aGlzLmNvbnRleHQpO1xuICB9XG5cbiAgZ2V0SW5wdXRMYXRlbmN5ICgpOiBudW1iZXIge1xuICAgIGlmICghdGhpcy5jb250ZXh0KSB7XG4gICAgICByZXR1cm4gMC4wNTsgLy8gRGVmYXVsdFxuICAgIH1cblxuICAgIHJldHVybiBCcm93c2VyVXRpbHMuZ2V0SW5wdXRMYXRlbmN5KHRoaXMuY29udGV4dCk7XG4gIH1cblxuICBhc3luYyByZXN1bWUgKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICghdGhpcy5jb250ZXh0KSB7cmV0dXJuIGZhbHNlO31cblxuICAgIHRyeSB7XG4gICAgICBpZiAodGhpcy5jb250ZXh0LnN0YXRlID09PSAnc3VzcGVuZGVkJykge1xuICAgICAgICBhd2FpdCB0aGlzLmNvbnRleHQucmVzdW1lKCk7XG4gICAgICAgIHRoaXMubG9nZ2VyLmluZm8oJ0F1ZGlvQ29udGV4dCByZXN1bWVkJyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLmNvbnRleHQuc3RhdGUgPT09ICdydW5uaW5nJztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5sb2dnZXIuZXJyb3IoJ0ZhaWxlZCB0byByZXN1bWUgQXVkaW9Db250ZXh0JywgZXJyb3IpO1xuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgc3VzcGVuZCAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCF0aGlzLmNvbnRleHQpIHtyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7fVxuXG4gICAgcmV0dXJuIHRoaXMuY29udGV4dC5zdXNwZW5kKCk7XG4gIH1cblxuICBjbG9zZSAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICB0aGlzLnN0b3BBbGxPc2NpbGxhdG9ycygpO1xuICAgIHRoaXMuY2xlYW51cFNjcmlwdFByb2Nlc3NvcnMoKTtcblxuICAgIGlmICh0aGlzLmNvbnRleHQpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnRleHQuY2xvc2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICAvLyBQdWxzZSBnZW5lcmF0aW9uIG1ldGhvZHNcbiAgcGxheVB1bHNlIChvcHRpb25zOiBQdWxzZUdlbmVyYXRvck9wdGlvbnMpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCB8fCAhdGhpcy5tYXN0ZXJHYWluKSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKCdBdWRpb0VuZ2luZSBub3QgaW5pdGlhbGl6ZWQnKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG9zY2lsbGF0b3IgPSB0aGlzLmNvbnRleHQuY3JlYXRlT3NjaWxsYXRvcigpO1xuXG4gICAgY29uc3QgZ2FpbiA9IHRoaXMuY29udGV4dC5jcmVhdGVHYWluKCk7XG5cbiAgICBvc2NpbGxhdG9yLnR5cGUgPSBvcHRpb25zLnR5cGU7XG4gICAgb3NjaWxsYXRvci5mcmVxdWVuY3kudmFsdWUgPSBvcHRpb25zLmZyZXF1ZW5jeTtcblxuICAgIGdhaW4uZ2Fpbi52YWx1ZSA9IDA7XG4gICAgY29uc3Qgbm93ID0gdGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lO1xuXG4gICAgY29uc3QgYXR0YWNrID0gTWF0aC5taW4oMC4wMSwgb3B0aW9ucy5kdXJhdGlvbiAqIDAuMjUpO1xuXG4gICAgY29uc3QgcmVsZWFzZSA9IE1hdGgubWluKDAuMDEsIG9wdGlvbnMuZHVyYXRpb24gKiAwLjI1KTtcblxuICAgIGdhaW4uZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLCBub3cpO1xuICAgIGdhaW4uZ2Fpbi5saW5lYXJSYW1wVG9WYWx1ZUF0VGltZShvcHRpb25zLnZvbHVtZSwgbm93ICsgYXR0YWNrKTtcbiAgICBnYWluLmdhaW4uc2V0VmFsdWVBdFRpbWUob3B0aW9ucy52b2x1bWUsIG5vdyArIG9wdGlvbnMuZHVyYXRpb24gLSByZWxlYXNlKTtcbiAgICBnYWluLmdhaW4ubGluZWFyUmFtcFRvVmFsdWVBdFRpbWUoMCwgbm93ICsgb3B0aW9ucy5kdXJhdGlvbik7XG5cbiAgICBvc2NpbGxhdG9yLmNvbm5lY3QoZ2Fpbik7XG4gICAgZ2Fpbi5jb25uZWN0KHRoaXMubWFzdGVyR2Fpbik7XG5cbiAgICBjb25zdCBzdGFydFRpbWUgPSB0aGlzLmNvbnRleHQuY3VycmVudFRpbWU7XG5cbiAgICBvc2NpbGxhdG9yLnN0YXJ0KHN0YXJ0VGltZSk7XG4gICAgb3NjaWxsYXRvci5zdG9wKHN0YXJ0VGltZSArIG9wdGlvbnMuZHVyYXRpb24pO1xuXG4gICAgLy8gQ2xlYW4gdXAgYWZ0ZXIgcHVsc2UgZW5kc1xuICAgIG9zY2lsbGF0b3Iub25lbmRlZCA9ICgpOiB2b2lkID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5vc2NpbGxhdG9ycy5pbmRleE9mKG9zY2lsbGF0b3IpO1xuXG4gICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICB0aGlzLm9zY2lsbGF0b3JzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMub25QdWxzZSkge1xuICAgICAgICB0aGlzLm9wdGlvbnMub25QdWxzZShzdGFydFRpbWUpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLm9zY2lsbGF0b3JzLnB1c2gob3NjaWxsYXRvcik7XG4gIH1cblxuICBwbGF5Q2hpcnAgKG9wdGlvbnM6IENoaXJwR2VuZXJhdG9yT3B0aW9ucyk6IHZvaWQge1xuICAgIGlmICghdGhpcy5jb250ZXh0IHx8ICF0aGlzLm1hc3RlckdhaW4pIHtcbiAgICAgIHRoaXMubG9nZ2VyLndhcm4oJ0F1ZGlvRW5naW5lIG5vdCBpbml0aWFsaXplZCcpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgb3NjaWxsYXRvciA9IHRoaXMuY29udGV4dC5jcmVhdGVPc2NpbGxhdG9yKCk7XG5cbiAgICBjb25zdCBnYWluID0gdGhpcy5jb250ZXh0LmNyZWF0ZUdhaW4oKTtcblxuICAgIG9zY2lsbGF0b3IudHlwZSA9ICdzaW5lJztcblxuICAgIC8vIFNldCB1cCBmcmVxdWVuY3kgc3dlZXBcbiAgICBjb25zdCBzdGFydFRpbWUgPSB0aGlzLmNvbnRleHQuY3VycmVudFRpbWU7XG5cbiAgICBjb25zdCBlbmRUaW1lID0gc3RhcnRUaW1lICsgb3B0aW9ucy5kdXJhdGlvbjtcblxuICAgIG9zY2lsbGF0b3IuZnJlcXVlbmN5LnNldFZhbHVlQXRUaW1lKG9wdGlvbnMuc3RhcnRGcmVxdWVuY3ksIHN0YXJ0VGltZSk7XG4gICAgb3NjaWxsYXRvci5mcmVxdWVuY3kuZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZShcbiAgICAgIG9wdGlvbnMuZW5kRnJlcXVlbmN5LFxuICAgICAgZW5kVGltZSxcbiAgICApO1xuXG4gICAgZ2Fpbi5nYWluLnZhbHVlID0gMDtcbiAgICBjb25zdCBjaGlycEF0dGFjayA9IE1hdGgubWluKDAuMDEsIG9wdGlvbnMuZHVyYXRpb24gKiAwLjI1KTtcblxuICAgIGNvbnN0IGNoaXJwUmVsZWFzZSA9IE1hdGgubWluKDAuMDEsIG9wdGlvbnMuZHVyYXRpb24gKiAwLjI1KTtcblxuICAgIGdhaW4uZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLCBzdGFydFRpbWUpO1xuICAgIGdhaW4uZ2Fpbi5saW5lYXJSYW1wVG9WYWx1ZUF0VGltZShvcHRpb25zLnZvbHVtZSwgc3RhcnRUaW1lICsgY2hpcnBBdHRhY2spO1xuICAgIGdhaW4uZ2Fpbi5zZXRWYWx1ZUF0VGltZShvcHRpb25zLnZvbHVtZSwgZW5kVGltZSAtIGNoaXJwUmVsZWFzZSk7XG4gICAgZ2Fpbi5nYWluLmxpbmVhclJhbXBUb1ZhbHVlQXRUaW1lKDAsIGVuZFRpbWUpO1xuXG4gICAgb3NjaWxsYXRvci5jb25uZWN0KGdhaW4pO1xuICAgIGdhaW4uY29ubmVjdCh0aGlzLm1hc3RlckdhaW4pO1xuXG4gICAgb3NjaWxsYXRvci5zdGFydChzdGFydFRpbWUpO1xuICAgIG9zY2lsbGF0b3Iuc3RvcChlbmRUaW1lKTtcblxuICAgIG9zY2lsbGF0b3Iub25lbmRlZCA9ICgpOiB2b2lkID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5vc2NpbGxhdG9ycy5pbmRleE9mKG9zY2lsbGF0b3IpO1xuXG4gICAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgICB0aGlzLm9zY2lsbGF0b3JzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMub25DaGlycCkge1xuICAgICAgICB0aGlzLm9wdGlvbnMub25DaGlycChzdGFydFRpbWUpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLm9zY2lsbGF0b3JzLnB1c2gob3NjaWxsYXRvcik7XG4gIH1cblxuICBwbGF5VGVzdFRvbmUgKGZyZXF1ZW5jeTogbnVtYmVyID0gMTAwMCwgZHVyYXRpb246IG51bWJlciA9IDAuNSwgdm9sdW1lOiBudW1iZXIgPSAwLjUpOiB2b2lkIHtcbiAgICB0aGlzLnBsYXlQdWxzZSh7XG4gICAgICBmcmVxdWVuY3ksXG4gICAgICBkdXJhdGlvbixcbiAgICAgIHZvbHVtZSxcbiAgICAgIHR5cGU6ICdzaW5lJyxcbiAgICB9KTtcbiAgfVxuXG4gIHBsYXlDbGljayAodm9sdW1lOiBudW1iZXIgPSAwLjUpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCB8fCAhdGhpcy5tYXN0ZXJHYWluKSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKCdBdWRpb0VuZ2luZSBub3QgaW5pdGlhbGl6ZWQnKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE5vaXNlLWJ1cnN0IGNsaWNrOiAxNW1zIG9mIHdoaXRlIG5vaXNlIHdpdGggZXhwb25lbnRpYWwgZGVjYXlcbiAgICAvLyBGYWxscyBiYWNrIHRvIGEgc2hvcnQgc2luZSBwdWxzZSBpZiBjcmVhdGVCdWZmZXIgaXMgdW5hdmFpbGFibGUgKGUuZy4gdGVzdCBtb2NrcylcbiAgICBpZiAodHlwZW9mIHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMucGxheVB1bHNlKHtcbiAgICAgICAgZnJlcXVlbmN5OiAxMDAwLFxuICAgICAgICBkdXJhdGlvbjogMC4wNSxcbiAgICAgICAgdm9sdW1lLFxuICAgICAgICB0eXBlOiAnc2luZScsXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGR1cmF0aW9uID0gMC4wMTU7XG5cbiAgICBjb25zdCBzYW1wbGVSYXRlID0gdGhpcy5jb250ZXh0LnNhbXBsZVJhdGU7XG5cbiAgICBjb25zdCBidWZmZXJTaXplID0gTWF0aC5mbG9vcihkdXJhdGlvbiAqIHNhbXBsZVJhdGUpO1xuXG4gICAgY29uc3QgYnVmZmVyID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlcigxLCBidWZmZXJTaXplLCBzYW1wbGVSYXRlKTtcblxuICAgIGNvbnN0IGRhdGEgPSBidWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCk7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlclNpemU7IGkrKykge1xuICAgICAgY29uc3QgdCA9IGkgLyBidWZmZXJTaXplO1xuXG4gICAgICBkYXRhW2ldID0gKE1hdGgucmFuZG9tKCkgKiAyIC0gMSkgKiBNYXRoLmV4cCgtdCAqIDIwKTtcbiAgICB9XG5cbiAgICBjb25zdCBzb3VyY2UgPSB0aGlzLmNvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG5cbiAgICBzb3VyY2UuYnVmZmVyID0gYnVmZmVyO1xuXG4gICAgY29uc3QgZ2FpbiA9IHRoaXMuY29udGV4dC5jcmVhdGVHYWluKCk7XG5cbiAgICBnYWluLmdhaW4udmFsdWUgPSB2b2x1bWU7XG5cbiAgICBzb3VyY2UuY29ubmVjdChnYWluKTtcbiAgICBnYWluLmNvbm5lY3QodGhpcy5tYXN0ZXJHYWluKTtcblxuICAgIGNvbnN0IG5vdyA9IHRoaXMuY29udGV4dC5jdXJyZW50VGltZTtcblxuICAgIHNvdXJjZS5zdGFydChub3cpO1xuICAgIHNvdXJjZS5zdG9wKG5vdyArIGR1cmF0aW9uKTtcbiAgfVxuXG4gIC8vIEF1ZGlvIGFuYWx5c2lzIG1ldGhvZHNcbiAgY3JlYXRlQW5hbHlzZXIgKGZmdFNpemU6IG51bWJlciA9IDIwNDgpOiBBbmFseXNlck5vZGUge1xuICAgIGlmICghdGhpcy5jb250ZXh0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0F1ZGlvRW5naW5lIG5vdCBpbml0aWFsaXplZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IGFuYWx5c2VyID0gdGhpcy5jb250ZXh0LmNyZWF0ZUFuYWx5c2VyKCk7XG5cbiAgICBhbmFseXNlci5mZnRTaXplID0gZmZ0U2l6ZTtcbiAgICBhbmFseXNlci5taW5EZWNpYmVscyA9IC05MDtcbiAgICBhbmFseXNlci5tYXhEZWNpYmVscyA9IC0xMDtcbiAgICBhbmFseXNlci5zbW9vdGhpbmdUaW1lQ29uc3RhbnQgPSAwLjg1O1xuXG4gICAgdGhpcy5hbmFseXplcnMucHVzaChhbmFseXNlcik7XG5cbiAgICByZXR1cm4gYW5hbHlzZXI7XG4gIH1cblxuICBnZXRGcmVxdWVuY3lEYXRhIChhbmFseXNlcjogQW5hbHlzZXJOb2RlKTogVWludDhBcnJheSB7XG4gICAgY29uc3QgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoYW5hbHlzZXIuZnJlcXVlbmN5QmluQ291bnQpO1xuXG4gICAgYW5hbHlzZXIuZ2V0Qnl0ZUZyZXF1ZW5jeURhdGEoYnVmZmVyKTtcblxuICAgIHJldHVybiBidWZmZXI7XG4gIH1cblxuICBnZXRUaW1lRG9tYWluRGF0YSAoYW5hbHlzZXI6IEFuYWx5c2VyTm9kZSk6IFVpbnQ4QXJyYXkge1xuICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGFuYWx5c2VyLmZyZXF1ZW5jeUJpbkNvdW50KTtcblxuICAgIGFuYWx5c2VyLmdldEJ5dGVUaW1lRG9tYWluRGF0YShidWZmZXIpO1xuXG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfVxuXG4gIGdldFBlYWtGcmVxdWVuY3kgKGFuYWx5c2VyOiBBbmFseXNlck5vZGUsIHNhbXBsZVJhdGU6IG51bWJlciA9IDQ0MTAwKTogbnVtYmVyIHtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5nZXRGcmVxdWVuY3lEYXRhKGFuYWx5c2VyKTtcblxuICAgIGxldCBtYXhJbmRleCA9IDA7XG5cbiAgICBsZXQgbWF4VmFsdWUgPSAwO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZGF0YVtpXSA+IG1heFZhbHVlKSB7XG4gICAgICAgIG1heFZhbHVlID0gZGF0YVtpXTtcbiAgICAgICAgbWF4SW5kZXggPSBpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAobWF4SW5kZXggKiBzYW1wbGVSYXRlKSAvIGFuYWx5c2VyLmZmdFNpemU7XG4gIH1cblxuICBnZXRWb2x1bWUgKGFuYWx5c2VyOiBBbmFseXNlck5vZGUpOiBudW1iZXIge1xuICAgIGNvbnN0IGRhdGEgPSB0aGlzLmdldEZyZXF1ZW5jeURhdGEoYW5hbHlzZXIpO1xuXG4gICAgY29uc3Qgc3VtID0gZGF0YS5yZWR1Y2UoKGFjYywgdmFsKSA9PiBhY2MgKyB2YWwsIDApO1xuXG4gICAgcmV0dXJuIHN1bSAvIGRhdGEubGVuZ3RoIC8gMjU1OyAvLyBOb3JtYWxpemUgdG8gMC0xXG4gIH1cblxuICAvLyBNaWNyb3Bob25lIGlucHV0IGhhbmRsaW5nXG4gIGFzeW5jIHNldHVwTWljcm9waG9uZUlucHV0ICgpOiBQcm9taXNlPE1lZGlhU3RyZWFtQXVkaW9Tb3VyY2VOb2RlIHwgbnVsbD4ge1xuICAgIGlmICghdGhpcy5jb250ZXh0KSB7XG4gICAgICB0aGlzLmxvZ2dlci53YXJuKCdBdWRpb0VuZ2luZSBub3QgaW5pdGlhbGl6ZWQnKTtcblxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJhdyBjYXB0dXJlOiBlY2hvIGNhbmNlbGxhdGlvbiB3b3VsZCBzdXBwcmVzcyB0aGUgbG9vcGJhY2sgc3dlZXAgZnJvbVxuICAgICAgLy8gdGhlIG1pYyAoaXQgbWF0Y2hlcyB0aGUgb3V0cHV0KSwgbm9pc2Ugc3VwcHJlc3Npb24gZGlzdG9ydHMgaXQg4oCUIGJvdGhcbiAgICAgIC8vIGRlc3Ryb3kgdGhlIGNyb3NzLWNvcnJlbGF0aW9uIHBlYWsgdGhlIGxvb3BiYWNrIHJlbGllcyBvblxuICAgICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgQnJvd3NlclV0aWxzLmdldFVzZXJNZWRpYSh7XG4gICAgICAgIGF1ZGlvOiB7XG4gICAgICAgICAgZWNob0NhbmNlbGxhdGlvbjogZmFsc2UsXG4gICAgICAgICAgbm9pc2VTdXBwcmVzc2lvbjogZmFsc2UsXG4gICAgICAgICAgYXV0b0dhaW5Db250cm9sOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXN0cmVhbSkge1xuICAgICAgICB0aGlzLmxvZ2dlci53YXJuKCdObyBtaWNyb3Bob25lIGFjY2VzcycpO1xuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzb3VyY2UgPSB0aGlzLmNvbnRleHQuY3JlYXRlTWVkaWFTdHJlYW1Tb3VyY2Uoc3RyZWFtKTtcblxuICAgICAgdGhpcy5taWNyb3Bob25lU3RyZWFtID0gc3RyZWFtO1xuXG4gICAgICByZXR1cm4gc291cmNlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxvZ2dlci5lcnJvcignRmFpbGVkIHRvIHNldHVwIG1pY3JvcGhvbmUgaW5wdXQnLCBlcnJvcik7XG5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNjcmlwdCBwcm9jZXNzb3IgZm9yIHJlYWwtdGltZSBhdWRpbyBhbmFseXNpc1xuICBjcmVhdGVTY3JpcHRQcm9jZXNzb3IgKFxuICAgIGJ1ZmZlclNpemU6IG51bWJlciA9IDQwOTYsXG4gICAgaW5wdXRDaGFubmVsQ291bnQ6IG51bWJlciA9IDEsXG4gICAgb3V0cHV0Q2hhbm5lbENvdW50OiBudW1iZXIgPSAxLFxuICApOiBTY3JpcHRQcm9jZXNzb3JOb2RlIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBdWRpb0VuZ2luZSBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICB9XG5cbiAgICAvLyBVc2UgQXVkaW9Xb3JrbGV0IGlmIGF2YWlsYWJsZSAobW9kZXJuIGJyb3dzZXJzKVxuICAgIGlmICh0aGlzLmNvbnRleHQuYXVkaW9Xb3JrbGV0KSB7XG4gICAgICAvLyBGb3Igbm93LCBmYWxsIGJhY2sgdG8gU2NyaXB0UHJvY2Vzc29yTm9kZVxuICAgICAgLy8gSW4gcHJvZHVjdGlvbiwgeW91J2QgcmVnaXN0ZXIgYW4gQXVkaW9Xb3JrbGV0UHJvY2Vzc29yXG4gICAgfVxuXG4gICAgY29uc3QgcHJvY2Vzc29yID0gdGhpcy5jb250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3NvcihcbiAgICAgIGJ1ZmZlclNpemUsXG4gICAgICBpbnB1dENoYW5uZWxDb3VudCxcbiAgICAgIG91dHB1dENoYW5uZWxDb3VudCxcbiAgICApO1xuXG4gICAgdGhpcy5zY3JpcHRQcm9jZXNzb3JzLnB1c2gocHJvY2Vzc29yKTtcblxuICAgIHJldHVybiBwcm9jZXNzb3I7XG4gIH1cblxuICAvLyBDbGVhbnVwIG1ldGhvZHNcbiAgcHJpdmF0ZSBzdG9wQWxsT3NjaWxsYXRvcnMgKCk6IHZvaWQge1xuICAgIHRoaXMub3NjaWxsYXRvcnMuZm9yRWFjaChvc2MgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgb3NjLnN0b3AoKTtcbiAgICAgICAgb3NjLmRpc2Nvbm5lY3QoKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBJZ25vcmUgZXJyb3JzIGR1cmluZyBjbGVhbnVwXG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5vc2NpbGxhdG9ycyA9IFtdO1xuICB9XG5cbiAgcHJpdmF0ZSBjbGVhbnVwU2NyaXB0UHJvY2Vzc29ycyAoKTogdm9pZCB7XG4gICAgdGhpcy5zY3JpcHRQcm9jZXNzb3JzLmZvckVhY2gocHJvY2Vzc29yID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHByb2Nlc3Nvci5kaXNjb25uZWN0KCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gSWdub3JlIGVycm9ycyBkdXJpbmcgY2xlYW51cFxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuc2NyaXB0UHJvY2Vzc29ycyA9IFtdO1xuICB9XG5cbiAgY2xlYW51cEFuYWx5emVycyAoKTogdm9pZCB7XG4gICAgdGhpcy5hbmFseXplcnMuZm9yRWFjaChhbmFseXNlciA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBhbmFseXNlci5kaXNjb25uZWN0KCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gSWdub3JlIGVycm9ycyBkdXJpbmcgY2xlYW51cFxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYW5hbHl6ZXJzID0gW107XG4gIH1cblxuICBjbGVhbnVwQWxsICgpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3BBbGxPc2NpbGxhdG9ycygpO1xuICAgIHRoaXMuY2xlYW51cFNjcmlwdFByb2Nlc3NvcnMoKTtcbiAgICB0aGlzLmNsZWFudXBBbmFseXplcnMoKTtcbiAgfVxuXG4gIC8vIFV0aWxpdHkgbWV0aG9kc1xuICBjcmVhdGVEZWxheU5vZGUgKG1heERlbGF5VGltZTogbnVtYmVyID0gMSk6IERlbGF5Tm9kZSB7XG4gICAgaWYgKCF0aGlzLmNvbnRleHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQXVkaW9FbmdpbmUgbm90IGluaXRpYWxpemVkJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY29udGV4dC5jcmVhdGVEZWxheShtYXhEZWxheVRpbWUpO1xuICB9XG5cbiAgY3JlYXRlR2Fpbk5vZGUgKCk6IEdhaW5Ob2RlIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBdWRpb0VuZ2luZSBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jb250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgfVxuXG4gIGNyZWF0ZUJpcXVhZEZpbHRlck5vZGUgKHR5cGU6IEJpcXVhZEZpbHRlclR5cGUgPSAnbG93cGFzcycpOiBCaXF1YWRGaWx0ZXJOb2RlIHtcbiAgICBpZiAoIXRoaXMuY29udGV4dCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBdWRpb0VuZ2luZSBub3QgaW5pdGlhbGl6ZWQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBmaWx0ZXIgPSB0aGlzLmNvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG5cbiAgICBmaWx0ZXIudHlwZSA9IHR5cGU7XG5cbiAgICByZXR1cm4gZmlsdGVyO1xuICB9XG5cbiAgLy8gQXVkaW8gY29udGV4dCBzdGF0ZSBtYW5hZ2VtZW50XG4gIGlzQXVkaW9Db250ZXh0UnVubmluZyAoKTogYm9vbGVhbiB7XG4gICAgaWYgKCF0aGlzLmNvbnRleHQpIHtyZXR1cm4gZmFsc2U7fVxuXG4gICAgcmV0dXJuIHRoaXMuY29udGV4dC5zdGF0ZSA9PT0gJ3J1bm5pbmcnO1xuICB9XG5cbiAgaXNBdWRpb0NvbnRleHRTdXNwZW5kZWQgKCk6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5jb250ZXh0KSB7cmV0dXJuIGZhbHNlO31cblxuICAgIHJldHVybiB0aGlzLmNvbnRleHQuc3RhdGUgPT09ICdzdXNwZW5kZWQnO1xuICB9XG5cbiAgaXNBdWRpb0NvbnRleHRDbG9zZWQgKCk6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5jb250ZXh0KSB7cmV0dXJuIHRydWU7fVxuXG4gICAgcmV0dXJuIHRoaXMuY29udGV4dC5zdGF0ZSA9PT0gJ2Nsb3NlZCc7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXVkaW9FbmdpbmU7XG4iXX0=