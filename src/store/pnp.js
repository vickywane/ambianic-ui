/**
  Manage plug and play connection status to Ambianic Edge.
*/
import {
  PEER_NEW_INSTANCE,
  PEER_DISCONNECTED,
  PEER_CONNECTING,
  PEER_DISCOVERING,
  PEER_DISCOVERED,
  PEER_AUTHENTICATING,
  PEER_CONNECTED,
  PEER_CONNECTION_ERROR,
  PNP_SERVICE_DISCONNECTED,
  PNP_SERVICE_CONNECTING,
  PNP_SERVICE_CONNECTED,
  USER_MESSAGE,
  NEW_PEER_ID,
  NEW_REMOTE_PEER_ID,
  REMOTE_PEER_ID_REMOVED,
  PEER_FETCH
} from './mutation-types.js'
import {
  INITIALIZE_PNP,
  PNP_SERVICE_CONNECT,
  PNP_SERVICE_RECONNECT,
  PEER_DISCOVER,
  PEER_CONNECT,
  PEER_AUTHENTICATE,
  REMOVE_REMOTE_PEER_ID,
  CHANGE_REMOTE_PEER_ID,
  HANDLE_PEER_CONNECTION_ERROR
} from './action-types.js'
import { ambianicConf } from '@/config'
import Peer from 'peerjs'
import { PeerRoom } from '@/remote/peer-room'
import { PeerFetch } from '@/remote/peer-fetch'
const STORAGE_KEY = 'ambianic-pnp-settings'

const state = {
  /**
    Reference to the PeerJS instance active
    in the current global application scope (i.e. window scope).
  */
  peer: undefined, // peerjs.Peer object local to the current browser window/tab session
  /**
    Reference to the ID of the PeerJS instance active
    in the current application. Persisted in browser localStorage.
  */
  myPeerId: undefined, // window.localStorage.getItem(`${STORAGE_KEY}.myPeerId`),
  /**
    Reference to the ID of the remote PeerJS instance
    as registered with the PnP service.
  */
  remotePeerId: window.localStorage.getItem(`${STORAGE_KEY}.remotePeerId`),
  /**
    Helper reference to the ID of the PeerJS instance active
    in the current application.
  */
  lastPeerId: undefined,
  /**
   * Helper list of remote peers that have caused connection issues
   */
  problematicRemotePeers: new Set(),
  /**
    Connection status message for user to see
  */
  userMessage: '',
  /**
    Connection to the remote Ambianic Edge device
  */
  peerConnection: undefined,
  /**
    Status of current peer connection to remote peer
  */
  peerConnectionStatus: PEER_DISCONNECTED,
  /**
    Status of current peer connection to remote pnp service
  */
  pnpServiceConnectionStatus: PNP_SERVICE_DISCONNECTED,
  /**
    PeerFetch instance
  */
  peerFetch: undefined,
  /**
   * The duration in milliseconds to pause between pair discovery retries
   */
  discoveryLoopPause: 3000
}

const mutations = {
  [PEER_NEW_INSTANCE] (state, peer) {
    state.peer = peer
  },
  [PEER_DISCONNECTED] (state) {
    state.peerConnection = undefined
    state.peerConnectionStatus = PEER_DISCONNECTED
    state.peerFetch = undefined
  },
  [PEER_DISCOVERED] (state) {
    state.peerConnectionStatus = PEER_DISCOVERED
  },
  [PEER_DISCOVERING] (state) {
    state.peerConnectionStatus = PEER_DISCOVERING
  },
  [PEER_CONNECTING] (state) {
    state.peerConnectionStatus = PEER_CONNECTING
  },
  [PEER_AUTHENTICATING] (state) {
    state.peerConnectionStatus = PEER_AUTHENTICATING
  },
  [PEER_CONNECTED] (state, peerConnection) {
    state.peerConnection = peerConnection
    state.peerConnectionStatus = PEER_CONNECTED
  },
  [PEER_CONNECTION_ERROR] (state) {
    state.peerConnectionStatus = PEER_CONNECTION_ERROR
  },
  [PNP_SERVICE_DISCONNECTED] (state) {
    state.pnpServiceConnectionStatus = PNP_SERVICE_DISCONNECTED
  },
  [PNP_SERVICE_CONNECTING] (state) {
    state.pnpServiceConnectionStatus = PNP_SERVICE_CONNECTING
  },
  [PNP_SERVICE_CONNECTED] (state) {
    state.pnpServiceConnectionStatus = PNP_SERVICE_CONNECTED
  },
  [USER_MESSAGE] (state, newUserMessage) {
    state.userMessage = newUserMessage
  },
  [NEW_PEER_ID] (state, newPeerId) {
    state.myPeerId = newPeerId
    // window.localStorage.setItem(`${STORAGE_KEY}.myPeerId`, newPeerId)
  },
  [NEW_REMOTE_PEER_ID] (state, newRemotePeerId) {
    console.debug('NEW_REMOTE_PEER_ID: Setting state.remotePeerId to : ', newRemotePeerId)
    state.remotePeerId = newRemotePeerId
    window.localStorage.setItem(`${STORAGE_KEY}.remotePeerId`, newRemotePeerId)
  },
  [REMOTE_PEER_ID_REMOVED] (state) {
    console.debug('REMOTE_PEER_ID_REMOVED: Removing remote Peer Id from local storage')
    state.remotePeerId = undefined
    window.localStorage.removeItem(`${STORAGE_KEY}.remotePeerId`)
  },
  [PEER_FETCH] (state, peerFetch) {
    console.debug('PEER_FETCH: Setting PeerFetch instance.')
    state.peerFetch = peerFetch
  }
}

/**
  Try to discover remote peer ID.
  If we already know the remote Peer ID, we will use it.
  Otherwise try to discover it automatically or with user's help.
  Once discovered, the remote peer Id will be saved
  and reused until explicitly reset by the user.
*/
async function discoverRemotePeerId ({ state, commit }) {
  const peer = state.peer
  // first see if we got a remote Edge ID entered to connect to
  if (state.remotePeerId) {
    return state.remotePeerId
  } else {
  // first try to find the remote peer ID in the same room
    console.debug(peer)
    const myRoom = new PeerRoom(peer)
    console.debug('Fetching room members', myRoom)
    const roomMembers = await myRoom.getRoomMembers()
    console.debug('Fetched roomMembers', roomMembers)
    const peerIds = roomMembers.clientsIds
    console.debug('myRoom members', peerIds)
    // find a peerId that is different than this PWA peer ID and
    //   is not in the problematic list of remote peers
    var remotePeerId = peerIds.find(
      pid => pid !== state.myPeerId && !state.problematicRemotePeers.has(pid))
    console.debug(`remotePeerId: ${remotePeerId} found among myRoom members: ${peerIds}`)
    if (remotePeerId === undefined && state.problematicRemotePeers.size > 0) {
      // if no fresh remote peer is found, recycle the problematic peers list
      // and try to connect to them again
      console.log('recycling problematic peers', state.problematicRemotePeers)
      remotePeerId = [...state.problematicRemotePeers][0]
      state.problematicRemotePeers.clear()
    }
    if (remotePeerId) {
      return remotePeerId
    } else {
      // unable to auto discover
      // ask user for help
      commit(USER_MESSAGE,
        `Still looking.
         Please make sure you are on the same local network
         as the Ambianic Edge device.
        `)
    }
  }
}

function setPnPServiceConnectionHandlers (
  { state, commit, dispatch }) {
  const peer = state.peer
  peer.on('open', function (id) {
    commit(PNP_SERVICE_CONNECTED)
    // Workaround for peer.reconnect deleting previous id
    if (!peer.id) {
      console.log('pnp client: Received null id from peer open')
      peer.id = state.myPeerId
    } else {
      if (state.myPeerId !== peer.id) {
        console.log(
          'pnp client: Service returned new peerId. Old, New',
          state.myPeerId,
          peer.id
        )
        commit(NEW_PEER_ID, peer.id)
      }
    }
    console.log('pnp client: myPeerId: ', peer.id)
    // signaling server connection established
    // we can advance to peer discovery
    dispatch(PEER_DISCOVER)
  })
  peer.on('disconnected', function () {
    commit(PNP_SERVICE_DISCONNECTED)
    commit(USER_MESSAGE, 'PnP service connection lost. Please check your internet connection.')
    console.log('pnp client: Connection lost. Please reconnect.')
  })
  peer.on('close', function () {
    // peerConnection = null
    commit(USER_MESSAGE, 'PnP service connection closed. Will attempt to reconnect in a moment.')
    console.log('Connection to PnP server destroyed')
    console.log('Reconnecting to PnP server...')
    commit(PNP_SERVICE_DISCONNECTED)
    commit(PEER_DISCONNECTED)
    setTimeout(() => { // give the network a few moments to recover
      dispatch(INITIALIZE_PNP)
    }, 3000)
  })
  peer.on('error', function (err) {
    console.log('PnP service connection error', err)
    commit(USER_MESSAGE,
      `
      Error while connecting. Will retry shortly. Is the Internet connection OK?
      `)
    commit(PNP_SERVICE_DISCONNECTED)
    commit(PEER_DISCONNECTED)
    console.log('pnp service connection error', { err })
    console.log('Will try to reconnect to PnP server...')
    // retry peer connection in a few seconds
    setTimeout(() => { // give the network a few moments to recover
      dispatch(INITIALIZE_PNP)
    }, 3000)
  })
  // remote peer tries to initiate connection
  peer.on('connection', function (peerConnection) {
    console.debug('#####>>>>> remote peer trying to establish connection')
    setPeerConnectionHandlers({ state, commit, dispatch, peerConnection })
    commit(PEER_CONNECTING)
  })
}

function setPeerConnectionHandlers ({
  state,
  commit,
  dispatch,
  peerConnection,
  hungupConnectionResetTimer
}) {
  // setup connection progress callbacks
  peerConnection.on('open', function () {
    clearTimeout(hungupConnectionResetTimer)
    const peerFetch = new PeerFetch(peerConnection)
    console.debug('Peer DataConnection is now open. Creating PeerFetch wrapper.')
    commit(PEER_FETCH, peerFetch)
    setTimeout(() => dispatch(PEER_AUTHENTICATE, peerConnection), 1000)
    // try {
    //   peerConnection.send('HELLO from peerConnection.on_open')
    // } catch (error) {
    //   console.error('Error sending message via webrtc datachannel', { error })
    // }
  })

  peerConnection.on('close', function () {
    clearTimeout(hungupConnectionResetTimer)
    commit(PEER_DISCONNECTED)
    commit(USER_MESSAGE, 'Connection to remote peer closed')
    console.debug('#########>>>>>>>>> p2p connection closed')
    console.debug('Will try to open a new peer connection shortly.')
    setTimeout( // give the network a few moments to recover
      () => dispatch(PEER_DISCOVER),
      3000
    )
  })

  peerConnection.on('error', function (err) {
    clearTimeout(hungupConnectionResetTimer)
    commit(USER_MESSAGE, 'Error in connection to remote peer ID', peerConnection.peer)
    console.info(`Error in connection to remote peer ID ${peerConnection.peer}`, err)
    dispatch(HANDLE_PEER_CONNECTION_ERROR, { peerConnection, err })
  })

  console.debug('peerConnection.on(event) handlers all set.')
}

const actions = {
  /**
  * Initialize PnP Service and Peer Connection
  */
  async [INITIALIZE_PNP] ({ state, commit, dispatch }) {
    await dispatch(PNP_SERVICE_CONNECT)
  },
  /**
  * Establish connection to PnP Service and
  * create the Peer object for our end of the connection.
  *
  * Set up callbacks to handle any events related to our
  * peer object.
  */
  async [PNP_SERVICE_CONNECT] ({ state, commit, dispatch }) {
    const peer = state.peer
    // if connection to pnp service already open, then nothing to do
    if (peer && peer.open) { return }
    // if in the middle of pnp server connection cycle, skip
    if (state.pnpServiceConnectionStatus === PNP_SERVICE_CONNECTING) { return }
    // Create own peer object with connection to shared PeerJS server
    console.log('pnp client: creating peer')
    // If we already have an assigned peerId, we will reuse it forever.
    // We expect that peerId is crypto secure. No need to replace.
    // Unless the user explicitly requests a refresh.
    console.log('pnp client: last saved myPeerId', state.myPeerId)
    const newPeer = new Peer(state.myPeerId,
      {
        host: ambianicConf.AMBIANIC_PNP_HOST,
        port: ambianicConf.AMBIANIC_PNP_PORT,
        secure: ambianicConf.AMBIANIC_PNP_SECURE,
        debug: 3
      }
    )
    commit(PEER_NEW_INSTANCE, newPeer)
    console.log('pnp client: peer created')
    setPnPServiceConnectionHandlers({ state, commit, dispatch })
    commit(PNP_SERVICE_CONNECTING)
  },
  /**
  * Establish connection to PnP Service and
  * create the Peer object for our end of the connection.
  *
  * Set up callbacks to handle any events related to our
  * peer object.
  */
  async [PNP_SERVICE_RECONNECT] ({ state, commit, dispatch }) {
    const peer = state.peer
    // if connection to pnp service already open, then nothing to do
    if (peer.open) return
    // if in the middle of pnp server connection cycle, skip
    if (state.pnpServiceConnectionStatus === PNP_SERVICE_CONNECTING) { return }
    console.log('pnp client: reconnecting peer...')
    // Workaround for peer.reconnect deleting previous id
    if (!peer.id) {
      console.log('BUG WORKAROUND: Peer lost ID. Resetting to last known ID.')
      peer._id = state.myPeerId
    }
    peer._lastServerId = state.myPeerId
    commit(PNP_SERVICE_CONNECTING)
    peer.reconnect()
  },
  /**
  * Find remotePeerId for Ambianic Edge device to pair with.
  *
  */
  async [PEER_DISCOVER] ({ state, commit, dispatch }) {
    console.log(`######## >>>>> peerConnectionStatus = ${state.peerConnectionStatus}`)
    if (state.peerConnectionStatus !== PEER_DISCONNECTED) {
      // avoid redundant discovery loop
      // in cases like multiple error events on the same connection
      return
    }
    commit(PEER_DISCOVERING)
    const discoveryLoopId = async () => {
      // start a discovery loop
      console.log('Discovering remote peer...')
      // its possible that the PNP signaling server connection was disrupted
      // while looping in peer discovery mode
      if (state.pnpServiceConnectionStatus !== PNP_SERVICE_CONNECTED) {
        console.log('PNP Service disconnected. Reconnecting...')
        await dispatch(PNP_SERVICE_RECONNECT)
      }
      let remotePeerId
      try {
        if (state.pnpServiceConnectionStatus === PNP_SERVICE_CONNECTED) {
          remotePeerId = await discoverRemotePeerId({ state, commit })
        } else {
          // signaling server connection is still not ready, skip this cycle
          // and wait for the next scheduled retry
          console.log('PNP Service still not connected. Will retry shortly.')
        }
      } catch (err) {
        console.log('Error while looking for remote peer. Will retry shortly.',
          err)
      }
      if (remotePeerId) {
        console.log('Remote peer Id found', remotePeerId)
        commit(PEER_DISCOVERED)
        // remote Edge peer discovered, let's connect to it
        await dispatch(PEER_CONNECT, remotePeerId)
      } else {
        setTimeout(discoveryLoopId, state.discoveryLoopPause) // retry in a few seconds
      }
    }
    await discoveryLoopId()
  },
  /**
  * Create the connection between the two Peers.
  *
  * Set up callbacks to handle any events related to the
  * direct peer-to-peer connection and data received on it.
  */
  async [PEER_CONNECT] ({ state, commit, dispatch }, remotePeerId) {
    // Its possible that the PNP signaling server connection was disrupted
    // We need the signaling server to negotiate p2p connection terms.
    if (state.pnpServiceConnectionStatus !== PNP_SERVICE_CONNECTED) {
      console.log('PNP Service disconnected. Reconnecting...')
      await dispatch(PNP_SERVICE_RECONNECT)
    }
    // if already connected to peer, then nothing to do
    if (state.peerConnectionStatus === PEER_CONNECTING ||
        state.peerConnectionStatus === PEER_CONNECTED) {
      // avoid redundant connect looping
      // in case of multiple connection errors
      return
    }
    console.debug(`#####>>>> PNP Service connection status: ${state.pnpServiceConnectionStatus}`)
    console.debug('#####>>>>>>> Connecting to remote peer', remotePeerId)
    if (state.peerConnection) {
      // make sure any previous connection is closed and cleaned up
      console.info('>>>>>>> Closing and cleaning up existing peer connection.')
      state.peerConnection.close()
    }
    console.info('>>>>>> Opening new peer connection.')
    const peer = state.peer
    const peerConnection = peer.connect(remotePeerId, {
      label: 'http-proxy', reliable: true, serialization: 'raw'
    })
    commit(PEER_CONNECTING)
    // If we don't connect within a few seconds, there is a good chance
    // the remote peer is not available or the networking stack got corrupted.
    // Let's mark the remote peer as problematic temporarily and reset the webrtc stack.
    const hungupConnectionResetTimer = setTimeout(() => {
      try {
        state.problematicRemotePeers.add(remotePeerId)
        console.debug('Problematic remote peer ID:', remotePeerId)
        peer.destroy()
      } catch (err) {
        console.warn('Error destroying peer.')
      } finally {
        console.info('It took too long to setup a connection. Resetting peer.')
        dispatch(INITIALIZE_PNP)
      }
    }, 30 * 1000) // 30 seconds timeout
    setPeerConnectionHandlers({
      state,
      commit,
      dispatch,
      peerConnection,
      hungupConnectionResetTimer
    })
  },
  /**
  * Authenticate remote peer. Make sure its a genuine Ambianic Edge device.
  *
  */
  async [PEER_AUTHENTICATE] ({ state, commit, dispatch }, peerConnection) {
    commit(PEER_AUTHENTICATING)
    commit(USER_MESSAGE, `Authenticating remote peer: ${peerConnection.peer}`)
    console.log('Authenticating remote Peer ID: ', peerConnection.peer)
    const request = {
      url: 'http://localhost:8778'
    }
    let authPassed = false
    try {
      const response = await state.peerFetch.get(request)
      console.log('PEER_AUTHENTICATE', { request, response })
      if (response.header.status === 200) {
        console.log('PEER_AUTHENTICATE status OK')
        const text = state.peerFetch.textDecode(response.content)
        // if data is authentication challenge response, verify it
        // for now we naively check for Ambianic in the response.
        authPassed = text.includes('Ambianic')
        console.log(`PEER_AUTHENTICATE response body OK = ${authPassed}`)
      }
    } catch (err) {
      console.log(`peerFetch.get() Error while connecting to remote peer ID: ${peerConnection.peer}`, err)
    }
    if (authPassed) {
      // console.debug('Remote peer authenticated as:', authMessage.name)
      commit(PEER_CONNECTED, peerConnection)
      // remote Peer ID authenticated,
      // lets store it for future (re)connections
      // if its not already stored
      if (state.remotePeerId !== peerConnection.peer) {
        commit(NEW_REMOTE_PEER_ID, peerConnection.peer)
      }
    } else {
      commit(USER_MESSAGE, 'Remote peer authentication failed.')
      await dispatch(HANDLE_PEER_CONNECTION_ERROR, { peerConnection, err: 'Remote peer authentication faied.' })
    }
    console.debug('DataChannel transport capabilities',
      peerConnection.dataChannel)
    //
    // const request2 = {
    //   url: 'http://192.168.86.22:8778/api/timeline.json'
    // }
    // console.debug('peerFetch.get', { request2 })
    // const response2 = await state.peerFetch.get(request2)
    // const text2 = state.peerFetch.jsonify(response2)
    // console.debug('peerFetch.get returned response', { request, response, text2 })
    // console.debug('peerFetch.get returned response', { request2, response2 })
  },
  /**
   * @param {*} remotePeerId The Ambianic Edge PeerJS ID
   * that the Ambianic UI will pair with.
   *
   * Update Ambianic Edge Peer ID for the remote Ambianic Edge you want to pair with.
   * Perhaps your parents are isolated, then it would be nice to connect to
   * them or let them connect to you.
   */
  async [CHANGE_REMOTE_PEER_ID] ({ state, commit, dispatch }, remotePeerId) {
    commit(NEW_REMOTE_PEER_ID, remotePeerId)
    commit(PEER_DISCONNECTED)
    dispatch(PEER_CONNECT, remotePeerId)
  },
  /**
  * Remove remote peer id from local store.
  * Maybe the edge device is damaged and its id cannot be recovered.
  * In such cases the user will request removal of the existing device
  * association and force discovery of a new edge device id.
  */
  async [REMOVE_REMOTE_PEER_ID] ({ state, commit, dispatch }) {
    if (state.peerConnectionStatus !== PEER_DISCONNECTED) {
      const conn = state.peerConnection
      if (conn) {
        try {
          conn.close()
        } catch (err) {
          console.debug('Error while closing peer DataConnection.', err)
        }
      }
      commit(PEER_DISCONNECTED)
    }
    commit(REMOTE_PEER_ID_REMOVED)
    dispatch(PEER_DISCOVER)
  },
  async [HANDLE_PEER_CONNECTION_ERROR] ({ state, commit, dispatch }, { peerConnection, err }) {
    console.info('######>>>>>>> p2p connection error', err)
    console.info('Problematic remote peer ID:', peerConnection.peer)
    state.problematicRemotePeers.add(peerConnection.peer)
    commit(PEER_CONNECTION_ERROR, err)
    console.info('Will try a new connection shortly.')
    commit(PEER_DISCONNECTED)
    setTimeout( // give the network a few moments to recover
      () => dispatch(PEER_DISCOVER),
      3000
    )
  }
}

const getters = {
  isEdgeConnected: state => {
    return state.peerConnectionStatus === PEER_CONNECTED
  }
}

const pnpStoreModule = {
  state,
  getters,
  mutations,
  actions
}

export default pnpStoreModule
