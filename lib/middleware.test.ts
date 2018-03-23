//import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { Header, HttpStatus } from '@toba/tools';
import { EventType, addEventListener, blockSpamReferers } from '../index';
import { downloadSpammerList, emitter } from './middleware';

const length = 567;
const spammer = 'akuhni.by';
const onBlock = jest.fn();
const onNext = jest.fn();

beforeEach(() => {
   emitter.unsubscribeAll();
   onBlock.mockClear();
   onNext.mockClear();
});

async function makeRequest(referer: string) {
   const req = new IncomingMessage(null);
   const res = new ServerResponse(req);

   req.headers[Header.Referer] = referer;

   addEventListener(EventType.BlockedReferer, onBlock);

   await blockSpamReferers(req, res, onNext);
   return res;
}

test('downloads spammer list', async () => {
   const onError = jest.fn();
   const onBegin = jest.fn();
   const onDownload = jest.fn();

   addEventListener(EventType.BeginningDownload, onBegin);
   addEventListener(EventType.CompletedDownload, onDownload);
   addEventListener(EventType.DownloadError, onError);

   const list = await downloadSpammerList();
   expect(onError).toHaveBeenCalledTimes(0);
   expect(onBegin).toHaveBeenCalledTimes(1);
   expect(onDownload).toHaveBeenCalledTimes(1);
   expect(onDownload).toHaveBeenCalledWith(length);

   expect(list).toBeDefined();
   expect(list).toBeInstanceOf(Array);
   expect(list).toHaveLength(length);
   expect(list).toContain(spammer);
});

test('blocks spammy request', async () => {
   const res = await makeRequest(spammer);
   expect(res.statusCode).toBe(HttpStatus.NotFound);
   expect(res.finished).toBe(true);
   expect(onBlock).toHaveBeenCalledTimes(1);
   expect(onNext).toHaveBeenCalledTimes(0);
});

test('allows non-spammy requests', async () => {
   const res = await makeRequest('anything.else.com');
   expect(res.finished).toBe(false);
   expect(onBlock).toHaveBeenCalledTimes(0);
   expect(onNext).toHaveBeenCalledTimes(1);
});

test('blocks spammy subdomains', async () => {
   const res = await makeRequest('subdomain.' + spammer);
   expect(res.statusCode).toBe(HttpStatus.NotFound);
   expect(res.finished).toBe(true);
   expect(onBlock).toHaveBeenCalledTimes(1);
   expect(onNext).toHaveBeenCalledTimes(0);
});
