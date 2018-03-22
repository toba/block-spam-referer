import { is, HttpStatus, EventEmitter, re } from '@toba/tools';
import * as url from 'url';
import fetch from 'node-fetch';
import { ClientRequest, ServerResponse } from 'http';

export type EventListener = (e: any) => void;

/** List of blocked domains */
let blackList: string[] = [];
/** Source of blocked domain list */
const blackListUrl =
   'https://raw.githubusercontent.com/piwik/referrer-spam-blacklist/master/spammers.txt';

let isDownloading = false;
let pending: ((list: string[]) => void)[] = [];

export enum EventType {
   BeginningDownload,
   AlreadyDownloading,
   DownloadError,
   CompletedDownload,
   BlockedReferer
}

const emitter = new EventEmitter<EventType, any>();

/**
 * Infer top level domain from URL.
 *
 * https://github.com/igormilla/top-domain
 */
export const topDomain = (address: string) => {
   const parsed = url.parse(address.toLowerCase());
   const domain = parsed.host !== null ? parsed.host : parsed.path;
   const match = domain.match(re.domain);

   return match ? match[0] : parsed.host;
};

/**
 * Return 404 for known spam referers
 *
 * https://en.wikipedia.org/wiki/Referer_spam
 */
export async function blockSpamReferers(
   req: ClientRequest,
   res: ServerResponse,
   next: () => void
) {
   const referer = req.getHeader('referer');

   if (is.value<string>(referer)) {
      const isSpam = await checkSpammerList(topDomain(referer));
      if (isSpam) {
         emitter.emit(EventType.BlockedReferer, referer);
         res.statusCode = HttpStatus.NotFound;
         res.end();
      } else {
         next();
      }
   } else {
      next();
   }
}

export function addEventListener(type: EventType, fn: (e: any) => void) {
   emitter.subscribe(type, fn);
}

/**
 * Whether requestor domain matches a spam referer.
 *
 * https://en.wikipedia.org/wiki/Referer_spam
 */
export function checkSpammerList(domain: string): Promise<boolean> {
   return getSpammerList().then(list => list.indexOf(domain) !== -1);
}

/**
 * Load spammer list from cache or remote provider
 */
export function getSpammerList(): Promise<string[]> {
   return is.array(blackList) && blackList.length > 0
      ? Promise.resolve(blackList)
      : downloadSpammerList();
}

export function downloadSpammerList(): Promise<string[]> {
   if (isDownloading) {
      emitter.emit(EventType.AlreadyDownloading);
      return new Promise<string[]>(resolve => {
         pending.push(resolve);
      });
   } else {
      isDownloading = true;
      emitter.emit(EventType.BeginningDownload);

      return fetch(blackListUrl)
         .then(res => {
            if (res.status != HttpStatus.OK) {
               emitter.emit(
                  EventType.DownloadError,
                  `${blackListUrl} returned HTTP status: ${res.status}`
               );
               return null;
            } else {
               return res.text();
            }
         })
         .then((body: string) => {
            let list: string[] = [];

            if (is.value(body)) {
               // list of non-empty lines
               list = body.split(/[\n\r]/).filter(i => !is.empty(i));
            }
            isDownloading = false;

            if (is.array(list) && list.length > 0) {
               // execute pending callbacks
               for (const fn of pending) {
                  fn(list);
               }
               pending = [];
               emitter.emit(EventType.CompletedDownload, list.length);
               blackList = list;
               return blackList;
            } else {
               return [];
            }
         })
         .catch(err => {
            emitter.emit(
               EventType.DownloadError,
               `Failed to download: ${err.toString()}`
            );
         }) as Promise<string[]>;
   }
}
