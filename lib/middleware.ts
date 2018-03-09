import { is, HttpStatus, Cache, CachePolicy, merge } from '@toba/tools';
import fetch from 'node-fetch';

const cache = new Cache<string[]>();
const cacheKey = 'spam-referer';

export type EventListener = (e: any) => void;

let blackListUrl =
   'https://raw.githubusercontent.com/piwik/referrer-spam-blacklist/master/spammers.txt';

/**
 * Pending black list lookup callbacks
 */
let pending: Function[] = [];
let isDownloading = false;

export enum EventType {
   AlreadyDownloading
}

/**
 * https://github.com/Microsoft/TypeScript/issues/2491
 */
export type ListenerMap = { [P in EventType]: EventListener[] };

class EventHandler<T> {
   private _listeners: ListenerMap = {};
   constructor() {}
}

// /**
//  * Return 404 for known spam referers
//  *
//  * https://en.wikipedia.org/wiki/Referer_spam
//  */
// function blockSpamReferers(
//    req: Blog.Request,
//    res: Blog.Response,
//    next: Function
// ) {
//    const referer = req.get('referer');

//    if (is.value(referer)) {
//       checkSpammerList(util.topDomain(referer)).then(spam => {
//          if (spam) {
//             log.warnIcon('fingerprint', 'Spam blocked %s referer', referer);
//             res.status(httpStatus.NOT_FOUND).end();
//          } else {
//             next();
//          }
//       });
//    } else {
//       next();
//    }
// }

function emit(type: EventType, payload?: any) {
   listeners[type].forEach(fn => {
      fn(payload);
   });
}

function addEventListener(type: EventType, fn: (e: any) => void) {
   listeners[type].push(fn);
}

/**
 * Whether requestor domain matches a spam referer.
 *
 * https://en.wikipedia.org/wiki/Referer_spam
 */
function checkSpammerList(domain: string): Promise<boolean> {
   return getSpammerList().then(list => list.indexOf(domain) !== -1);
}

/**
 * Load spammer list from cache or remote provider
 */
export function getSpammerList(): Promise<string[]> {
   const list = cache.get(cacheKey);
   return is.array(list) && list.length > 0
      ? Promise.resolve(list)
      : downloadSpammerList();
}

export function downloadSpammerList(): Promise<string[]> {
   if (isDownloading) {
      // log.info('Spam referral black list is already downloading');
      return new Promise(resolve => {
         pending.push(resolve);
      });
   } else {
      isDownloading = true;
      // log.infoIcon('cloud_download', 'Downloading spam referral black list');

      return fetch(config.referralSpam.listUrl)
         .then(res => {
            if (res.status != HttpStatus.OK) {
               log.error(
                  '%s returned status %s',
                  config.referralSpam.listUrl,
                  res.status
               );
               return null;
            } else {
               return res.text();
            }
         })
         .then(body => {
            let list: string[] = [];

            if (is.value(body)) {
               // list of non-empty lines
               list = body.split('\n').filter(i => !is.empty(i));
               lastUpdate = new Date().getTime();
            }
            isDownloading = false;

            if (is.array(list) && list.length > 0) {
               // execute pending callbacks
               for (const c of pending) {
                  c(list);
               }
               pending = [];
               log.infoIcon(
                  'block',
                  'Downloaded %d blocked domains',
                  list.length
               );
               cache.add(cacheKey, list);
               return list;
            } else {
               return [];
            }
         })
         .catch(err => {
            // log.error(
            //    'Failed to download referer blacklist: %s',
            //    err.toString()
            // );
         }) as Promise<string[]>;
   }
}
