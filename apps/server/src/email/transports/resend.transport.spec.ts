import { ResendEmailTransport } from './resend.transport';

describe('ResendEmailTransport', () => {
  const msg = { from: 'BAIA <orders@x.com>', to: 'a@b.com', subject: 'S', html: '<p>h</p>', text: 'h' };
  afterEach(() => jest.restoreAllMocks());

  it('posts the message to the Resend API with the bearer key', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"id":"1"}', { status: 200 }));
    await new ResendEmailTransport({ apiKey: 're_k' }).send({ ...msg, replyTo: 'r@x.com' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_k');
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ['a@b.com'], reply_to: 'r@x.com', subject: 'S' });
  });

  it('throws with the status on a non-2xx response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"message":"domain not verified"}', { status: 403 }));
    await expect(new ResendEmailTransport({ apiKey: 'k' }).send(msg)).rejects.toThrow(/403/);
  });
});
