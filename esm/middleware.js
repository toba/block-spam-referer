import { is, HttpStatus, EventEmitter, Header, re } from '@toba/tools';
import * as url from 'url';
import fetch from 'node-fetch';
/** List of blocked domains */
let blackList = [];
/** Source of blocked domain list */
const blackListUrl = 'https://raw.githubusercontent.com/piwik/referrer-spam-blacklist/master/spammers.txt';
let isDownloading = false;
let pending = [];
export const emitter = new EventEmitter();
/**
 * Infer top level domain from URL.
 *
 * @see https://github.com/igormilla/top-domain
 */
export const topDomain = (address) => {
    const parsed = url.parse(address.toLowerCase());
    const domain = parsed.host !== null ? parsed.host : parsed.path;
    if (domain !== undefined) {
        const match = domain.match(re.domain);
        if (match !== null) {
            return match[0];
        }
    }
    return parsed.host;
};
/**
 * Express compatible middleware. Return 404 for known spam referers.
 *
 * @see https://en.wikipedia.org/wiki/Referer_spam
 */
export async function blockSpamReferers(req, res, next = () => null) {
    const referer = req.headers[Header.Referer];
    if (is.value(referer)) {
        const isSpam = await checkSpammerList(topDomain(referer));
        if (isSpam) {
            emitter.emit(4 /* BlockedReferer */, referer);
            res.statusCode = HttpStatus.NotFound;
            res.end();
        }
        else {
            next();
        }
    }
    else {
        next();
    }
}
export function addEventListener(type, fn) {
    emitter.subscribe(type, fn);
}
/**
 * Whether requestor domain matches a spam referer.
 *
 * @see https://en.wikipedia.org/wiki/Referer_spam
 */
export const checkSpammerList = (domain) => domain !== undefined
    ? getSpammerList().then(list => list.indexOf(domain) !== -1)
    : Promise.resolve(true);
/**
 * Load spammer list from cache or remote provider
 */
export function getSpammerList() {
    return is.array(blackList) && blackList.length > 0
        ? Promise.resolve(blackList)
        : downloadSpammerList();
}
export function downloadSpammerList() {
    if (isDownloading) {
        emitter.emit(1 /* AlreadyDownloading */);
        return new Promise(resolve => {
            pending.push(resolve);
        });
    }
    else {
        isDownloading = true;
        emitter.emit(0 /* BeginningDownload */);
        return fetch(blackListUrl)
            .then(res => {
            if (res.status != HttpStatus.OK) {
                emitter.emit(2 /* DownloadError */, `${blackListUrl} returned HTTP status: ${res.status}`);
                return Promise.resolve(null);
            }
            else {
                return res.text();
            }
        })
            .then((body) => {
            let list = [];
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
                emitter.emit(3 /* CompletedDownload */, list.length);
                blackList = list;
                return blackList;
            }
            else {
                return [];
            }
        })
            .catch((err) => {
            emitter.emit(2 /* DownloadError */, `Failed to download: ${err.toString()}`);
        });
    }
}
