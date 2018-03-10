import { downloadSpammerList, EventType, addEventListener } from './middleware';

const length = 567;

it('downloads spammer list', () => {
   const onError = jest.fn();
   const onBegin = jest.fn();
   const onDownload = jest.fn();

   addEventListener(EventType.BeginningDownload, onBegin);
   addEventListener(EventType.CompletedDownload, onDownload);
   addEventListener(EventType.DownloadError, onError);

   return downloadSpammerList().then(list => {
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onBegin).toHaveBeenCalledTimes(1);
      expect(onDownload).toHaveBeenCalledTimes(1);
      expect(onDownload).toHaveBeenCalledWith(length);

      expect(list).toBeDefined();
      expect(list).toBeInstanceOf(Array);
      expect(list).toHaveLength(length);
      expect(list).toContain('akuhni.by');
   });
});
