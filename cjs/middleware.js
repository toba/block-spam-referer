"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tools_1 = require("@toba/tools");
const url = __importStar(require("url"));
const node_fetch_1 = __importDefault(require("node-fetch"));
let blackList = [];
const blackListUrl = 'https://raw.githubusercontent.com/piwik/referrer-spam-blacklist/master/spammers.txt';
let isDownloading = false;
let pending = [];
exports.emitter = new tools_1.EventEmitter();
exports.topDomain = (address) => {
    const parsed = url.parse(address.toLowerCase());
    const domain = parsed.host !== null ? parsed.host : parsed.path;
    if (domain !== undefined) {
        const match = domain.match(tools_1.re.domain);
        if (match !== null) {
            return match[0];
        }
    }
    return parsed.host;
};
async function blockSpamReferers(req, res, next = () => null) {
    const referer = req.headers[tools_1.Header.Referer];
    if (tools_1.is.value(referer)) {
        const isSpam = await exports.checkSpammerList(exports.topDomain(referer));
        if (isSpam) {
            exports.emitter.emit(4, referer);
            res.statusCode = tools_1.HttpStatus.NotFound;
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
exports.blockSpamReferers = blockSpamReferers;
function addEventListener(type, fn) {
    exports.emitter.subscribe(type, fn);
}
exports.addEventListener = addEventListener;
exports.checkSpammerList = (domain) => domain !== undefined
    ? getSpammerList().then(list => list.indexOf(domain) !== -1)
    : Promise.resolve(true);
function getSpammerList() {
    return tools_1.is.array(blackList) && blackList.length > 0
        ? Promise.resolve(blackList)
        : downloadSpammerList();
}
exports.getSpammerList = getSpammerList;
function downloadSpammerList() {
    if (isDownloading) {
        exports.emitter.emit(1);
        return new Promise(resolve => {
            pending.push(resolve);
        });
    }
    else {
        isDownloading = true;
        exports.emitter.emit(0);
        return node_fetch_1.default(blackListUrl)
            .then(res => {
            if (res.status != tools_1.HttpStatus.OK) {
                exports.emitter.emit(2, `${blackListUrl} returned HTTP status: ${res.status}`);
                return Promise.resolve(null);
            }
            else {
                return res.text();
            }
        })
            .then((body) => {
            let list = [];
            if (tools_1.is.value(body)) {
                list = body.split(/[\n\r]/).filter(i => !tools_1.is.empty(i));
            }
            isDownloading = false;
            if (tools_1.is.array(list) && list.length > 0) {
                for (const fn of pending) {
                    fn(list);
                }
                pending = [];
                exports.emitter.emit(3, list.length);
                blackList = list;
                return blackList;
            }
            else {
                return [];
            }
        })
            .catch((err) => {
            exports.emitter.emit(2, `Failed to download: ${err.toString()}`);
        });
    }
}
exports.downloadSpammerList = downloadSpammerList;
