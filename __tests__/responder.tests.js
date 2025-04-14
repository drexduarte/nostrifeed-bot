const { parseCommand, respondToMentions } = require('../app/responder');
const store = require('../app/store');
const { relayInit } = require('nostr-tools');

jest.mock('nostr-tools');
jest.mock('../app/store');
jest.mock('../app/config', () => ({
  getConfig: () => ({
    relays: ['wss://mockrelay'],
    feeds: [
      { name: 'Tech' },
      { name: 'Sports' },
      { name: 'World' },
    ],
  }),
}));

describe('respondToMentions', () => {
  let mockPublish, mockSubOn, mockRelay, mockConnect;

  beforeEach(() => {
    mockPublish = jest.fn();
    mockSubOn = jest.fn();
    mockConnect = jest.fn().mockResolvedValue();

    mockRelay = {
      connect: mockConnect,
      on: jest.fn(),
      sub: jest.fn().mockReturnValue({ on: mockSubOn }),
      publish: mockPublish,
    };

    relayInit.mockReturnValue(mockRelay);
  });

  it('handles relay connection errors gracefully', async () => {
    const errorRelay = {
      connect: jest.fn().mockRejectedValue(new Error('failed to connect')),
      publish: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };

    relayInit.mockReturnValue(errorRelay);

    await respondToMentions();
    jest.runOnlyPendingTimers();

    expect(errorRelay.connect).toHaveBeenCalled();
  });

  it('handles relay string errors gracefully', async () => {
    const errorRelay = {
      connect: jest.fn().mockRejectedValue('failed to connect'),
      publish: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };

    relayInit.mockReturnValue(errorRelay);

    await respondToMentions();
    jest.runOnlyPendingTimers();

    expect(errorRelay.connect).toHaveBeenCalled();
  });

  it('responds with latest news when mentioned with !latest <category>', async () => {
    store.fetchLatestNews.mockReturnValue(['news1', 'news2', 'news3']);

    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '1',
      pubkey: 'pubkey',
      content: '!latest technology',
      tags: [['p', 'pubkey']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('📰 Latest news related to "technology":\n• news1\n• news2\n• news3'),
    }));
  });

  it('responds with a not found message when !latest has no results', async () => {
    store.fetchLatestNews.mockReturnValue([]);

    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '2',
      pubkey: 'user1',
      content: '!latest unknown',
      tags: [['p', 'user1']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: '❌ Sorry, I couldn’t find any news for the category "unknown".',
    }));
  });

  it('responds with the list of feeds when mentioned with !feeds', async () => {
    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '3',
      pubkey: 'user2',
      content: '!feeds',
      tags: [['p', 'user2']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('📡 Available feeds:'),
    }));
    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('• Tech'),
    }));
  });

  it('responds with help message when command is invalid', async () => {
    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '4',
      pubkey: 'user3',
      content: '!unknowncommand',
      tags: [['p', 'user3']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('🤖 Oops! I didn’t understand that.'),
    }));
  });

  it('ignores already responded events', async () => {
    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '5',
      pubkey: 'user4',
      content: '!feeds',
      tags: [['p', 'user4']],
    };

    await eventCallback(fakeEvent);
    await eventCallback(fakeEvent); // Envia o mesmo evento de novo

    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  it('ignores mentions without a valid command', async () => {
    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '6',
      pubkey: 'user4',
      content: 'Hello world!',
      tags: [['p', 'user5']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).not.toHaveBeenCalled();
  });
});

describe('parseCommand', () => {
    it('parses simple command without argument', () => {
      expect(parseCommand('!feeds')).toEqual({ command: 'feeds', arg: undefined });
    });
  
    it('parses command with argument', () => {
      expect(parseCommand('!latest sports')).toEqual({ command: 'latest', arg: 'sports' });
    });
  
    it('parses command and strips npub mentions', () => {
      const input = '!latest tech npub123abc';
      expect(parseCommand(input)).toEqual({ command: 'latest', arg: 'tech' });
    });
  
    it('parses command with nostr:npub prefix mention', () => {
      const input = 'nostr:npubabc123 !feeds';
      expect(parseCommand(input)).toEqual({ command: 'feeds', arg: undefined });
    });
  
    it('returns null when input is not a command', () => {
      expect(parseCommand('hello world')).toBe(null);
      expect(parseCommand('')).toBe(null);
      expect(parseCommand('npub1abc')).toBe(null);
    });
  });