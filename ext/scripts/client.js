const { ClientStatus, Connection } = require('./connection')
const { createDeserializer, createSerializer } = require('./transforms/serializer')
const debug = require('debug')('minecraft-protocol')
const Options = require('./options')
const auth = require('./client/auth')
const initRaknet = require('./rak')
const { KeyExchange } = require('./handshake/keyExchange')
const Login = require('./handshake/login')
const LoginVerify = require('./handshake/loginVerify')

class Client extends Connection {
    // The RakNet connection
    connection

    /** @param {{ version: number, host: string, port: number }} options */
    constructor(options) {
        super()
        this.options = { ...Options.defaultOptions, ...options }
        this.compressionAlgorithm = 'none'
        this.compressionThreshold = 512
        this.compressionLevel = this.options.compressionLevel
        this.batchHeader = 0xfe

        if (!options.delayedInit) this.init()
    }

    init() {
        this.validateOptions()
        this.serializer = createSerializer(this.options.version)
        this.deserializer = createDeserializer(this.options.version)
        this._loadFeatures()

        KeyExchange(this, null, this.options)
        Login(this, null, this.options)
        LoginVerify(this, null, this.options)

        const { RakClient } = initRaknet(this.options.raknetBackend)

        this.connection = new RakClient({ useWorkers: this.options.useRaknetWorkers, host: this.options.host, port: this.options.port }, this)

        this.emit('connect_allowed')
    }

    _loadFeatures() {
        this.features = {
            compressorInHeader: true
        }
    }

    connect() {
        if (!this.connection) throw new Error('Connect not currently allowed') // must wait for `connect_allowed`, or use `createClient`
        this.on('session', this._connect)
        auth.authenticate(this, this.options)
        this.startQueue()
    }

    validateOptions() {
        if (!this.options.host || this.options.port == null) throw Error('Invalid host/port')
        Options.validateOptions(this.options)
    }

    onEncapsulated = (encapsulated) => {
        const buffer = Buffer.from(encapsulated.buffer)
        process.nextTick(() => this.handle(buffer))
    }

    _connect = async (sessionData) => {
        this.connection.onConnected = () => {
            this.status = ClientStatus.Connecting
            this.write('request_network_settings', { client_protocol: this.options.protocolVersion })
        }

        this.connection.onCloseConnection = () => {
            this.close()
        }

        this.connection.onEncapsulated = this.onEncapsulated
        this.connection.connect()
    }

    sendLogin() {
        this.status = ClientStatus.Authenticating
        this.createClientChain(null, this.options.offline)

        let chain = [
            ...this.accessToken // Mojang + Xbox JWT from auth
        ]

        const encodedChain = JSON.stringify({
            AuthenticationType: 0,
            Certificate: JSON.stringify({ chain }),
            Token: ""
        })

        this.write('login', {
            protocol_version: this.options.protocolVersion,
            tokens: {
                identity: encodedChain,
                client: this.clientUserChain
            }
        })

        this.emit('loggingIn')
    }

    onDisconnectRequest(packet) {
        this.emit('kick', packet)
        this.close()
    }

    disconnect(reason = 'Client leaving') {
        if (this.status === ClientStatus.Disconnected) return
        this.close(reason)
    }

    close() {
        if (this.status !== ClientStatus.Disconnected) {
            this.emit('close') // Emit close once
            debug('Client closed!')
        }
        clearInterval(this.loop)
        clearTimeout(this.connectTimeout)
        this.q = []
        this.q2 = []
        this.sendQ = []
        this.connection?.close()
        this.removeAllListeners()
        this.status = ClientStatus.Disconnected
    }

    readPacket(packet) {
        try {
            var des = this.deserializer.parsePacketBuffer(packet) // eslint-disable-line
        } catch (e) {
            // Dump information about the packet only if user is not handling error event.
            if (this.listenerCount('error') === 0) this.deserializer.dumpFailedBuffer(packet)
            this.emit('error', e)
            return
        }

        const pakData = { name: des.data.name, params: des.data.params }

        // Abstract some boilerplate before sending to listeners
        switch (pakData.name) {
            case 'server_to_client_handshake':
                this.emit('client.server_handshake', pakData.params)
                break
            case 'network_settings':
                this.compressionAlgorithm = pakData.params.compression_algorithm || 'deflate'
                this.compressionThreshold = pakData.params.compression_threshold
                this.compressionReady = true

                if (this.status === ClientStatus.Connecting) this.sendLogin()
                break
            case 'disconnect': // Client kicked
                this.emit(pakData.name, pakData.params) // Emit before we kill all listeners.
                this.onDisconnectRequest(pakData.params)
                break
            // fallsthrough
            case 'item_registry': // 1.21.60+ send itemstates in item_registry packet
                pakData.params.itemstates?.forEach(state => {
                    if (state.name === 'minecraft:shield') {
                        this.serializer.proto.setVariable('ShieldItemID', state.runtime_id)
                        this.deserializer.proto.setVariable('ShieldItemID', state.runtime_id)
                    }
                })
                break
            case 'play_status':
                if (this.status === ClientStatus.Authenticating) {
                    this.emit('join')
                    this.status = ClientStatus.Initializing
                }
                break
            default:
                if (this.status !== ClientStatus.Initializing && this.status !== ClientStatus.Initialized) {
                    return
                }
        }

        // Emit packet
        this.emit(pakData.name, pakData.params)
    }
}

module.exports = { Client, replaced: true }