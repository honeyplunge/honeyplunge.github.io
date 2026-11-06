import { WebAudioSyncConfig } from '../types';
export declare class Logger {
    private config;
    private prefix;
    constructor(config?: WebAudioSyncConfig, prefix?: string);
    private shouldLog;
    private formatMessage;
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
    private static instance;
    static getInstance(config?: WebAudioSyncConfig, prefix?: string): Logger;
    static debug(message: string, data?: unknown): void;
    static info(message: string, data?: unknown): void;
    static warn(message: string, data?: unknown): void;
    static error(message: string, data?: unknown): void;
    static configure(config: WebAudioSyncConfig): void;
}
export default Logger;
