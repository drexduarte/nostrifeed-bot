jest.mock('nostr-tools', () => {
  const actual = jest.requireActual('nostr-tools');
  return {
    ...actual,
    relayInit: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue(),
      publish: jest.fn(() => Promise.resolve()),
      on: jest.fn(),
      close: jest.fn()
    }))
  };
});

const { publishToRelays } = require('../app/publisher');
const { relayInit } = require('nostr-tools');

describe('publishToRelays', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should call relayInit and publish for each relay', async () => {
    const event = { id: '123', content: 'Hello' };
    const relays = ['wss://relay1.test', 'wss://relay2.test'];

    await publishToRelays(event, relays);
    jest.runOnlyPendingTimers();

    expect(relayInit).toHaveBeenCalledTimes(2);
  });

  it('logs success when publish resolves', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const relay = {
      connect: jest.fn().mockResolvedValue(),
      publish: jest.fn(() => ({
        then: (cb) => {
          cb(); // simula sucesso
          return { catch: () => {} };
        },
        on: jest.fn()
      })),
      on: jest.fn(),
      close: jest.fn()
    };

    relayInit.mockReturnValue(relay);

    const event = { id: 'success', content: 'Test success' };
    await publishToRelays(event, ['wss://success.test']);
    jest.runOnlyPendingTimers();

    expect(consoleSpy).toHaveBeenCalledWith('✅ Sucesso ao publicar em wss://success.test');

    consoleSpy.mockRestore();
  });

it('logs failure when publish rejects', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  const relay = {
    connect: jest.fn().mockResolvedValue(),
    publish: jest.fn(() => ({
      then: () => ({
        catch: (cb) => cb({ message: 'rejected by relay' })
      }),
      on: jest.fn()
    })),
    on: jest.fn(),
    close: jest.fn()
  };

  relayInit.mockReturnValue(relay);

  const event = { id: 'fail', content: 'Test fail' };
  await publishToRelays(event, ['wss://fail.test']);
  jest.runOnlyPendingTimers();

  expect(consoleSpy).toHaveBeenCalledWith('❌ Falha ao publicar em wss://fail.test: rejected by relay');

  consoleSpy.mockRestore();
});

  it('handles relay connection errors gracefully', async () => {
    const errorRelay = {
      connect: jest.fn().mockRejectedValue(new Error('fail')),
      publish: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };

    relayInit.mockReturnValue(errorRelay);

    const event = { id: '123', content: 'Test' };
    await publishToRelays(event, ['wss://fail.test']);
    jest.runOnlyPendingTimers();

    expect(errorRelay.connect).toHaveBeenCalled();
    expect(errorRelay.close).toHaveBeenCalled();
  });

  it('handles publish failures gracefully', async () => {
    const relay = {
      connect: jest.fn().mockResolvedValue(),
      publish: jest.fn(() => Promise.reject(new Error('publish failed'))),
      on: jest.fn(),
      close: jest.fn()
    };

    relayInit.mockReturnValue(relay);
    const event = { id: '999', content: 'Fail me' };
    await publishToRelays(event, ['wss://failing.test']);
    jest.runOnlyPendingTimers();

    expect(relay.publish).toHaveBeenCalled();
    expect(relay.close).toHaveBeenCalled();
  });

  it('logs relay notice events', async () => {
    const relay = {
      connect: jest.fn().mockResolvedValue(),
      publish: jest.fn(() => Promise.resolve()),
      on: jest.fn(),
      close: jest.fn()
    };

    relayInit.mockReturnValue(relay);
    const event = { id: 'notice', content: 'Notice test' };
    await publishToRelays(event, ['wss://relay-notice.test']);

    // Encontrar o callback do on('notice')
    const noticeCallback = relay.on.mock.calls.find(
      ([event]) => event === 'notice'
    )?.[1];

    expect(relay.on).toHaveBeenCalledWith('notice', expect.any(Function));

    // Simula aviso do relay
    if (noticeCallback) {
      noticeCallback('Simulated notice from relay');
    }

    jest.runOnlyPendingTimers();
  });
});