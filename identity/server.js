import polka from 'polka'
import sirv from 'sirv'
import {default as bodyParser} from 'body-parser'
import * as http from 'http'
import {createServer as createViteServer} from 'vite'
import fs from 'fs'
import {update as mergeUpdate, users, getVersion} from './log.js'
import {stream as braidStream} from '@braid-protocol/server'
import crypto from 'crypto'

const isProd = process.env.NODE_ENV === 'production'

;(async () => {
  const app = polka()

  const streams = new Set()

  app.get('/users', (req, res) => {
    if (req.headers['subscribe'] === 'keep-alive') {
      const stream = braidStream(res, {
        initialValue: JSON.stringify(users),
        contentType: 'application/json',
        onclose() {
          streams.delete(stream)
        }
      })

      streams.add(stream)
    } else {
      res
        .setHeader('content-type', 'application/json')
        .end(JSON.stringify(users))
    }
  })

  app.get('/users/:name', (req, res) => {
    // Could implement this as a braid URL.. eh.
    const name = req.params.name

    const user = users[req.params.name]
    if (user == null) {
      res.writeHead(404, 'Not found').end('User not found')
      // res.statusCode = 404
      // res.end()
    } else {
      res.setHeader('content-type', 'application/json')
      const attestation = crypto.randomBytes(64).toString('base64')
      res.end(JSON.stringify({
        ...user,
        name,
        version: getVersion(),
        attestation
      }))
    }
  })

  app.post('/upd', bodyParser.json(), (req, res, next) => {
    const upd = req.body
    try {
      mergeUpdate(upd)
    } catch (e) { return next(e) }
    res.end()

    const raw = JSON.stringify(users)
    for (const s of streams) {
      s.append({value: raw})
    }
  })

  if (isProd) {
    app.use(sirv('dist', { dev: false }))
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true
      },
      appType: 'custom',
    })

    app.use(vite.middlewares)

    app.get('/', async (req, res, next) => {
      const url = req.originalUrl

      const indexHtml = fs.readFileSync('index.html', 'utf-8')
      const template = await vite.transformIndexHtml(url, indexHtml)

      res.setHeader('content-type', 'text/html')
      res.end(template)
    })
    app.get('/create', async (req, res, next) => {
      const url = req.originalUrl

      const indexHtml = fs.readFileSync('create.html', 'utf-8')
      const template = await vite.transformIndexHtml(url, indexHtml)

      res.setHeader('content-type', 'text/html')
      res.end(template)
    })
  }


  http.createServer(app.handler).listen(3001, err => {
    if (err) throw err

    console.log('listening on port 3001')
  })
})()