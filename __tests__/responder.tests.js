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
      { name: 'Special Feed'}
    ],
  }),
}));

describe('respondToMentions', () => {
  let mockPublish, mockSubOn, mockRelay, mockConnect;

  beforeEach(() => {
    mockPublish =  jest.fn(() => ({
      then: (cb) => {
        cb();
        return { catch: () => {} };
      },
      on: jest.fn()
    }));
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
    const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const errorRelay = {
      connect: jest.fn().mockRejectedValue(new Error('failed to connect with Error')),
      publish: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };

    relayInit.mockReturnValue(errorRelay);

    await respondToMentions();

    expect(errorRelay.connect).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Error connecting to relay wss://mockrelay: failed to connect with Error');
    logSpy.mockRestore();
  });

  it('handles relay string errors gracefully', async () => {
    const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const errorRelay = {
      connect: jest.fn().mockRejectedValue('failed to connect with string'),
      publish: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };

    relayInit.mockReturnValue(errorRelay);

    await respondToMentions();

    expect(errorRelay.connect).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Error connecting to relay wss://mockrelay: failed to connect with string');
    logSpy.mockRestore();
  });

  it('logs an error if publish fails', async () => {
    const error = new Error('publish failed');
    const mockCatch = jest.fn();

    // Simula publish com falha
    mockPublish = jest.fn(() => ({
      then: () => ({ catch: mockCatch.mockImplementation(cb => cb(error)) }),
      on: jest.fn()
    }));

    mockRelay.publish = mockPublish;
    relayInit.mockReturnValue(mockRelay);

    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await respondToMentions();

    const fakeEvent = {
      id: 'fail-1',
      pubkey: 'user9',
      content: '!feeds',
      tags: [['p', 'user9']],
    };

    await eventCallback(fakeEvent);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Failed to reply to fail-1 on'));
    logSpy.mockRestore();
  });

  it('logs a string error if publish fails with a string', async () => {
    const mockCatch = jest.fn();

    // Simula publish com string como erro
    mockPublish = jest.fn(() => ({
      then: () => ({ catch: mockCatch.mockImplementation(cb => cb('something went wrong')) }),
      on: jest.fn()
    }));

    mockRelay.publish = mockPublish;
    relayInit.mockReturnValue(mockRelay);

    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await respondToMentions();

    const fakeEvent = {
      id: 'fail-2',
      pubkey: 'user10',
      content: '!feeds',
      tags: [['p', 'user10']],
    };

    await eventCallback(fakeEvent);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Failed to reply to fail-2 on'));
    logSpy.mockRestore();
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
      content: expect.stringContaining('📰 Latest news related to "technology":\n\n• news1\n• news2\n• news3'),
    }));
  });

  it('responds with latest news when mentioned with !latest <feed>', async () => {
    store.fetchLatestNews.mockReturnValue(['special1', 'special2', 'special3']);

    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '10',
      pubkey: 'pubkey',
      content: '!latest Special Feed',
      tags: [['p', 'pubkey']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('📰 Latest news related to "Special Feed":\n\n• special1\n• special2\n• special3'),
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

  it('responds to the help command', async () => {
    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '5',
      pubkey: 'user4',
      content: '!help',
      tags: [['p', 'user4']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('🤖 Available commands:'),
    }));
  });

  it('ignores already responded events', async () => {
    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '6',
      pubkey: 'user5',
      content: '!feeds',
      tags: [['p', 'user5']],
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
      id: '7',
      pubkey: 'user6',
      content: 'Hello world!',
      tags: [['p', 'user6']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('responds with the list of categories when mentioned with !categories', async () => {
    store.getPublishedLinks.mockReturnValue([
      { category: 'Tech' },
      { category: 'Sports' },
      { category: 'World' },
    ]);

    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '8',
      pubkey: 'user7',
      content: '!categories',
      tags: [['p', 'user7']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('📂 Recent categories:'),
    }));
  });

  it('responds with a not found message when !categories has no results', async () => {
    store.getPublishedLinks.mockReturnValue([]);

    let eventCallback;
    mockSubOn.mockImplementation((eventType, cb) => {
      if (eventType === 'event') eventCallback = cb;
    });

    await respondToMentions();

    const fakeEvent = {
      id: '9',
      pubkey: 'user8',
      content: '!categories',
      tags: [['p', 'user8']],
    };

    await eventCallback(fakeEvent);

    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      content: '❌ Sorry, I couldn’t find any categories.',
    }));
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