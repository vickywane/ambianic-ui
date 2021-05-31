import { PeerFetch } from '@/remote/peer-fetch'
import fetchMock from 'jest-fetch-mock'

describe('PeerFetch class coverage - p2p communication layer', () => {
// global

  beforeAll(() => {
    fetchMock.enableMocks()
  })

  // mock peer instance
  let peer

  beforeEach(() => {
    peer = jest.fn()
    peer.id = 'id_6789'
    peer.options = {
      secure: true,
      host: 'a_host',
      port: '567',
      path: '/a_path/',
      key: 'a_key',
      token: 'token_9876'
    }
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.resetAllMocks()
    fetchMock.resetMocks()
    jest.clearAllTimers()
  })

  test('PeerFetch constructor', () => {
    const dataConnection = jest.fn()
    dataConnection.on = jest.fn()
    const peerFetch = new PeerFetch(dataConnection)
    expect(peerFetch._dataConnection).toBe(dataConnection)
    expect(peerFetch._requestMap).toBeEmpty()
    expect(peerFetch._nextAvailableTicket).toEqual(0)
    expect(peerFetch._nextTicketInLine).toEqual(0)
    expect(peerFetch._dataConnection.on).toHaveBeenCalledTimes(3)
    expect(peerFetch._dataConnection.on).toHaveBeenCalledWith(
      'data', expect.anything()
    )
    expect(peerFetch._dataConnection.on).toHaveBeenCalledWith(
      'open', expect.anything()
    )
    expect(peerFetch._dataConnection.on).toHaveBeenCalledWith(
      'close', expect.anything()
    )
  })
})
