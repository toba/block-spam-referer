/// <reference types="node" />
import { EventEmitter } from '@toba/tools';
import { IncomingMessage, ServerResponse } from 'http';
export declare type EventListener = (e: any) => void;
export declare const enum EventType {
    BeginningDownload = 0,
    AlreadyDownloading = 1,
    DownloadError = 2,
    CompletedDownload = 3,
    BlockedReferer = 4
}
export declare const emitter: EventEmitter<EventType, any>;
/**
 * Infer top level domain from URL.
 *
 * @see https://github.com/igormilla/top-domain
 */
export declare const topDomain: (address: string) => string | undefined;
/**
 * Express compatible middleware. Return 404 for known spam referers.
 *
 * @see https://en.wikipedia.org/wiki/Referer_spam
 */
export declare function blockSpamReferers(req: IncomingMessage, res: ServerResponse, next?: (err?: any) => void): Promise<void>;
export declare function addEventListener(type: EventType, fn: (e: any) => void): void;
/**
 * Whether requestor domain matches a spam referer.
 *
 * @see https://en.wikipedia.org/wiki/Referer_spam
 */
export declare const checkSpammerList: (domain?: string | undefined) => Promise<boolean>;
/**
 * Load spammer list from cache or remote provider
 */
export declare function getSpammerList(): Promise<string[]>;
export declare function downloadSpammerList(): Promise<string[]>;
