<template>
  <v-dialog
    id="dialog"
    persistent
    v-model="showModal"
    max-width="550"
  >
    <v-card
      id="pending"
      v-if="syncState === 'PENDING'"
    >
      <div class="container">
        <div
          class="flex"
          style="justify-content: space-between;"
        >
          <div class="align-center">
            <h3 style="font-weight: normal;">
              Ambianic Edge Device
            </h3>
          </div>

          <div
            class="icon"
            @click="handleClose()"
          >
            <v-icon
              style="margin: 0.5rem 0;"
              center
              size="25"
            >
              mdi-close
            </v-icon>
          </div>
        </div>

        <hr>
        <br>
        <v-list>
          <v-list-item>
            <p>
              To authorize your running Edge Device, from your computer or mobile device browser, go to:
              <a
                id="verification_url"
                target="_blank"
                :href="verification_url"
              >
                Edge Device Activation Page
              </a>
            </p>
          </v-list-item>
          <v-list-item>
            <p>
              Confirm the following code shown:
              <code
                class="code"
                id="verification_code"
              >{{ user_code }}</code>
              , valid for 15 minutes.
            </p>
          </v-list-item>
        </v-list>
        <hr>
        <br>
        <div class="flex">
          <p style="margin-right: 10px;">
            {{ !isEdgeConnected ? "Connecting to edge device ..." : "Waiting for your confirmation..." }}
          </p>
          <v-progress-circular
            id="spinner"
            indeterminate
            :width="2.5"
            :size="20"
            color="primary"
          />
        </div>
      </div>
    </v-card>

    <v-card
      id="granted"
      v-else-if="syncState === 'GRANTED'"
    >
      <div class="container">
        <h3 style="font-weight: normal;">
          Ambianic Edge Device
        </h3>
        <hr>
        <div style="margin: 1rem 0;">
          <v-icon
            style="margin: 0.5rem 0;"
            center
            size="50"
          >
            mdi-check-circle-outline
          </v-icon>
          <p>Ambianic Edge Device Authenticated Successfully!</p>
        </div>
        <div>
          <v-btn
            color="primary"
            id="dismiss-button"
            @click="handleCompletion()"
          >
            OK, Close and Continue
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script>
import {
  PEER_CONNECTED
} from '@/store/mutation-types'
import { EdgeAPI } from '@/remote/edgeAPI'
import { mapState } from 'vuex'

export default {
  name: 'EdgeAuth0Sync',
  isLoading: true,
  data: (_) => ({
    showModal: true,
    syncState: 'PENDING',
    verification_url: '',
    user_code: '',
    device_code: ''
  }),
  computed: {
    ...mapState({
      peerConnectionStatus: (state) => state.pnp.peerConnectionStatus,
      isEdgeConnected: (state) =>
        state.pnp.peerConnectionStatus === PEER_CONNECTED,
      edgePeerId: (state) => state.pnp.remotePeerId,
      peerFetch: (state) => state.pnp.peerFetch,
      pnp: (state) => state.pnp
    })
  },
  created () {
    this.edgeAPI = new EdgeAPI(this.pnp)

    if (this.isEdgeConnected) {
      this.getUserCode()
    }
  },
  methods: {
    handleCompletion () {
      this.showModal = false

      localStorage.setItem('edgeSyncStatus', JSON.stringify({ isSynced: true }))
    },
    handleClose () {
      localStorage.setItem('edgeSyncStatus', JSON.stringify({ isSynced: false }))

      this.showModal = false
    },
    getUserCode () {
      this.edgeAPI
        .getUserCode()
        .then((response) => {
          if (response) {
            this.verification_url = response.verification_uri_complete
            this.user_code = response.user_code
            this.device_code = response.device_code

            this.checkStatus()
          }
        })
        .catch((e) => {
          console.log('ERROR RESPONSE FROM EDGE', e)
        })
    },
    checkStatus () {
      this.edgeAPI
        .checkUserAuthorizationStatus(this.device_code)
        .then((response) => {
          if (response.error) {
            // poll at 6s interval
            setTimeout(() => {
              console.log('WAITING FOR AUTH', response)

              this.checkStatus()
            }, 4000)
          } else if (response.access_token) {
            this.edgeAPI
              .saveUserToken({
                email: this.$auth.user.email,
                token: response.access_token
              })
              .then(() => {
                this.syncState = 'GRANTED'
              })
              .catch((e) => {
                console.log(e, 'ERROR SAVING TOKEN')
              })
          }
        })
        .catch((e) => {
          console.log(e, 'error from verify token')
        })
    }
  },
  watch: {
    isEdgeConnected: function (value) {
      if (value) {
        this.getUserCode()
      }
    }
  }
}
</script>

<style scoped>
.container {
  justify-content: center;
  align-items: center;
  text-align: center;
}

.flex {
  display: flex;
  justify-content: center;
}

.align-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.icon:hover {
  cursor: pointer;
}

.code {
  font-weight: bold;
}
</style>