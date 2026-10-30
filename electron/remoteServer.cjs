/**
 * Remote Soundboard Socket.IO & HTTP Server.
 *
 * Implements Controller-Only Access:
 * - Hosts a mobile-first web interface for phones, tablets & secondary computers.
 * - Authenticates remote controllers via 4-digit PIN and secure session tokens.
 * - Enforces STRICT read-and-trigger permissions:
 *     CAN: play existing sounds, stop sounds, stop all, adjust volume within limits,
 *          browse categories, search sounds, view currently playing state.
 *     CANNOT: upload/import/delete/rename/edit sounds, modify categories, alter audio
 *             devices or settings, or access the desktop filesystem.
 * - All audio mixing and playback remains 100% on the desktop application.
 */
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { Server } = require('socket.io')
const QRCode = require('qrcode')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

function getLocalIp() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

class RemoteServer {
  constructor() {
    /** @type {http.Server | null} */
    this.httpServer = null
    /** @type {Server | null} */
    this.io = null
    this.port = 4567
    this.pin = '4829'
    this.publicDir = path.join(__dirname, '..', '.output', 'public')
    this.running = false
    /** @type {Map<string, { token: string, deviceId: string, name: string, ip: string, userAgent: string, connectedAt: number, lastSeen: number, socketId: string }>} */
    this.sessions = new Map() // key: token
    /** @type {Set<string>} */
    this.knownSoundIds = new Set()
    this.lastSoundboardData = { sounds: [], collections: [] }
    this.currentPlaying = {}

    // Callbacks to forward valid controller commands to desktop
    this.callbacks = {
      onPlay: (_soundId) => {},
      onStop: (_soundId) => {},
      onStopAll: () => {},
      onVolume: (_soundId, _volume) => {},
      onDevicesChanged: (_devices) => {},
    }
  }

  /**
   * Start the HTTP + Socket.IO server.
   */
  async start(options = {}) {
    if (this.running) {
      if (options.pin) this.pin = String(options.pin).trim()
      return this.getStatus()
    }

    this.port = Number(options.port) || 4567
    this.pin = String(options.pin || this.pin || '4829').trim()
    if (options.publicDir) this.publicDir = options.publicDir
    if (options.callbacks) Object.assign(this.callbacks, options.callbacks)

    this.httpServer = http.createServer((req, res) => this.handleHttpRequest(req, res))

    this.io = new Server(this.httpServer, {
      cors: { origin: '*' },
      transports: ['websocket', 'polling'],
      pingTimeout: 10000,
      pingInterval: 10000,
    })

    this.setupSocketHandlers()

    await new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, '0.0.0.0', () => {
        this.running = true
        resolve()
      })
      this.httpServer.once('error', (err) => {
        // If port is occupied, try next available port
        if (err.code === 'EADDRINUSE') {
          this.port += 1
          this.httpServer.listen(this.port, '0.0.0.0', () => {
            this.running = true
            resolve()
          })
        } else {
          reject(err)
        }
      })
    })

    return this.getStatus()
  }

  /**
   * Stop the server and disconnect all sockets.
   */
  async stop() {
    if (!this.running) return
    this.running = false
    if (this.io) {
      this.io.emit('server:shutdown', { message: 'Desktop soundboard disconnected' })
      this.io.close()
      this.io = null
    }
    if (this.httpServer) {
      await new Promise((resolve) => this.httpServer.close(resolve))
      this.httpServer = null
    }
    this.sessions.clear()
    this.callbacks.onDevicesChanged([])
  }

  setPin(pin) {
    this.pin = String(pin).trim()
    return this.pin
  }

  revokeDevice(deviceId) {
    for (const [token, s] of this.sessions.entries()) {
      if (s.deviceId === deviceId) {
        this.sessions.delete(token)
        if (this.io && s.socketId) {
          const sock = this.io.sockets.sockets.get(s.socketId)
          if (sock) {
            sock.emit('device:revoked', { message: 'Access revoked by desktop' })
            sock.disconnect(true)
          }
        }
      }
    }
    this.notifyDevicesChanged()
  }

  /**
   * Sync sanitized soundboard data from desktop.
   * Strips all local filesystem paths and internal settings.
   */
  syncSoundboard(data) {
    const sounds = Array.isArray(data?.sounds) ? data.sounds : []
    const collections = Array.isArray(data?.collections) ? data.collections : []

    this.knownSoundIds.clear()
    const sanitizedSounds = sounds.map((s) => {
      this.knownSoundIds.add(s.id)
      return {
        id: s.id,
        name: s.name,
        icon: s.icon || null,
        color: s.color || null,
        hotkey: s.hotkey || null,
        volume: typeof s.volume === 'number' ? s.volume : 1,
        loop: !!s.loop,
        duration: typeof s.duration === 'number' ? s.duration : 0,
        collectionId: s.collectionId || null,
      }
    })

    const sanitizedCollections = collections.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon || null,
      color: c.color || null,
    }))

    this.lastSoundboardData = {
      sounds: sanitizedSounds,
      collections: sanitizedCollections,
    }

    if (this.io && this.running) {
      this.io.to('authenticated').emit('soundboard:sync', this.lastSoundboardData)
    }
  }

  broadcastPlaying(playing) {
    this.currentPlaying = playing || {}
    if (this.io && this.running) {
      this.io.to('authenticated').emit('sound:playing', { playing: this.currentPlaying })
    }
  }

  async getStatus() {
    const ip = getLocalIp()
    const url = `http://${ip}:${this.port}/remote`
    let qrDataUrl = ''
    try {
      qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 300, color: { dark: '#ffffff', light: '#111114' } })
    } catch {
      // ignore qr error
    }
    return {
      running: this.running,
      port: this.port,
      ip,
      url,
      pin: this.pin,
      qrDataUrl,
      devices: this.getConnectedDevices(),
    }
  }

  getConnectedDevices() {
    const list = []
    const now = Date.now()
    for (const s of this.sessions.values()) {
      // If socket is active in io
      const isLive = !!(this.io && s.socketId && this.io.sockets.sockets.has(s.socketId))
      list.push({
        id: s.deviceId,
        name: s.name || 'Remote Device',
        ip: s.ip || 'Unknown',
        userAgent: s.userAgent || '',
        authenticated: true,
        isLive,
        connectedAt: s.connectedAt,
        lastSeen: s.lastSeen,
      })
    }
    return list
  }

  notifyDevicesChanged() {
    this.callbacks.onDevicesChanged(this.getConnectedDevices())
  }

  /**
   * HTTP handler: serves Nuxt's static client bundle with SPA fallback.
   */
  handleHttpRequest(req, res) {
    // Add CORS headers for web development
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    let pathname = decodeURIComponent(url.pathname)

    // Security check: reject null bytes and directory traversal
    if (pathname.includes('\0') || pathname.includes('..')) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    // Default or remote route -> serve index.html with SPA fallback
    if (pathname === '/' || pathname === '/remote' || pathname === '/remote/') {
      pathname = '/index.html'
    }

    let filePath = path.normalize(path.join(this.publicDir, pathname))
    if (!filePath.startsWith(this.publicDir)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA Fallback: serve index.html for unknown routes
        filePath = path.join(this.publicDir, 'index.html')
      }

      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not Found')
          return
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
        })
        res.end(content)
      })
    })
  }

  /**
   * Socket.IO connection and permission-enforcement handler.
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      const clientIp = socket.handshake.address.replace(/^.*:/, '') || '127.0.0.1'
      const userAgent = socket.handshake.headers['user-agent'] || ''
      socket.data.authenticated = false
      socket.data.deviceId = null

      socket.on('device:auth', (payload = {}) => {
        const { pin, token, deviceName, deviceId } = payload
        const stableDeviceId = String(deviceId || socket.id).slice(0, 40)
        const cleanName = String(deviceName || 'Remote Controller').slice(0, 40)

        // Case A: Reconnecting with existing valid session token
        if (token && this.sessions.has(token)) {
          const session = this.sessions.get(token)
          session.socketId = socket.id
          session.lastSeen = Date.now()
          if (cleanName) session.name = cleanName

          socket.data.authenticated = true
          socket.data.deviceId = session.deviceId
          socket.data.token = token
          socket.join('authenticated')

          socket.emit('device:auth:success', {
            token,
            deviceId: session.deviceId,
            deviceName: session.name,
          })
          socket.emit('soundboard:sync', this.lastSoundboardData)
          socket.emit('sound:playing', { playing: this.currentPlaying })
          this.notifyDevicesChanged()
          return
        }

        // Case B: Pairing with PIN
        if (pin && String(pin).trim() === this.pin) {
          const newToken = crypto.randomBytes(24).toString('hex')
          const session = {
            token: newToken,
            deviceId: stableDeviceId,
            name: cleanName,
            ip: clientIp,
            userAgent,
            connectedAt: Date.now(),
            lastSeen: Date.now(),
            socketId: socket.id,
          }
          this.sessions.set(newToken, session)

          socket.data.authenticated = true
          socket.data.deviceId = stableDeviceId
          socket.data.token = newToken
          socket.join('authenticated')

          socket.emit('device:auth:success', {
            token: newToken,
            deviceId: stableDeviceId,
            deviceName: cleanName,
          })
          socket.emit('soundboard:sync', this.lastSoundboardData)
          socket.emit('sound:playing', { playing: this.currentPlaying })
          this.notifyDevicesChanged()
          return
        }

        // Authentication failed
        socket.emit('device:auth:error', {
          message: 'Invalid pairing PIN. Check the PIN shown on your desktop app.',
        })
      })

      // ── STRICT CONTROLLER-ONLY EVENTS ──

      socket.on('sound:play', (payload = {}) => {
        if (!socket.data.authenticated) {
          return socket.emit('error', { message: 'Unauthorized. Pair device first.' })
        }
        const soundId = payload.soundId
        if (!soundId || !this.knownSoundIds.has(soundId)) {
          return socket.emit('sound:error', { message: 'Sound ID does not exist in soundboard library.' })
        }
        this.callbacks.onPlay(soundId)
      })

      socket.on('sound:stop', (payload = {}) => {
        if (!socket.data.authenticated) return
        const soundId = payload.soundId
        if (soundId && this.knownSoundIds.has(soundId)) {
          this.callbacks.onStop(soundId)
        }
      })

      socket.on('sound:stop-all', () => {
        if (!socket.data.authenticated) return
        this.callbacks.onStopAll()
      })

      socket.on('sound:volume', (payload = {}) => {
        if (!socket.data.authenticated) return
        const { soundId, volume } = payload
        if (soundId && this.knownSoundIds.has(soundId) && typeof volume === 'number') {
          const boundedVolume = Math.max(0, Math.min(1.5, volume))
          this.callbacks.onVolume(soundId, boundedVolume)
        }
      })

      socket.on('device:disconnect', () => {
        if (socket.data.token) {
          this.sessions.delete(socket.data.token)
        }
        socket.disconnect(true)
        this.notifyDevicesChanged()
      })

      socket.on('disconnect', () => {
        this.notifyDevicesChanged()
      })
    })
  }
}

const remoteServer = new RemoteServer()
module.exports = { RemoteServer, remoteServer }
