import { mockFetch } from '@toba/test';

const fetch = mockFetch(url => `${__dirname}/spammers.txt`);

export default fetch;
