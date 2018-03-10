import { downloadSpammerList, EventType, addEventListener } from './middleware';

it('downloads spammer list', () => {
   const onError = jest.fn();
   const onBegin = jest.fn();
   const onDownload = jest.fn();

   addEventListener(EventType.BeginningDownload, onBegin);
   addEventListener(EventType.CompletedDownload, onDownload);
   addEventListener(EventType.DownloadError, onError);

   return downloadSpammerList().then(list => {
      //expect(onError).toHaveBeenCalledTimes(0);
      expect(onError).toHaveBeenCalledWith('');
      expect(onBegin).toHaveBeenCalledTimes(1);
      expect(onDownload).toHaveBeenCalledTimes(1);

      expect(list).toBeDefined();
      expect(list).toBeInstanceOf(Array);
      expect(list).toContain('webmonetizer');
   });
});
