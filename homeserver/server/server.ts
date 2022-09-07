import polka from 'polka'
import sirv from 'sirv'
import {default as bodyParser} from 'body-parser'
import {WebSocket, WebSocketServer} from 'ws'
import * as http from 'http'
import {createServer as createViteServer} from 'vite'
import fs from 'fs'
// import {stream as braidStream} from '@braid-protocol/server'
import * as dt from '../db/index.js'
import { createAgent, rateLimit } from '../db/utils.js'
import { Operation, ROOT_LV, WSServerClientMsg } from '../db/types.js'
import { hasVersion, summarizeVersion } from '../db/causal-graph.js'
import {makeRouter as makeBlogRouter} from './blog.js'

const isProd = process.env.NODE_ENV === 'production'


// Throwing everyone's data in one big DT set because its easier to prototype this way.
const DB_FILE = process.env['DB_FILE'] || 'db.json'

const db = (() => {
  try {
    const bytes = fs.readFileSync(DB_FILE, 'utf8')
    const json = JSON.parse(bytes)
    return dt.fromSerialized(json)
  } catch (e: any) {
    if (e.code !== 'ENOENT') throw e

    console.log('Using new database file')
    return dt.createDb()
  }
})()


const saveDb = rateLimit(100, () => {
  console.log('saving')
  const json = dt.serialize(db)
  const bytes = JSON.stringify(json, null, 2)
  // return fs.promises.writeFile(DB_FILE, bytes)
  return fs.writeFileSync(DB_FILE, bytes)
})

if (dt.get(db).waves == null) {
  const agent = createAgent()
  dt.localMapInsert(db, agent(), ROOT_LV, 'waves', {type: 'crdt', crdtKind: 'set'})
  saveDb()
}

console.dir(dt.get(db), {depth: null})

db.onop = op => saveDb()

process.on('exit', () => {
  console.log('exit')
  saveDb.flush()
})

process.on('SIGINT', () => {
  console.log('sigint')
  // Catching this to make sure we save!
  // console.log('SIGINT!')
  process.exit(1)
})

const clients = new Set<WebSocket>()

const broadcastOp = (ops: Operation[], exclude?: any) => {
  console.log('broadcast', ops)
  const msg: WSServerClientMsg = {
    type: 'ops',
    ops
  }

  const msgStr = JSON.stringify(msg)
  for (const c of clients) {
    // if (c !== exclude) {
    c.send(msgStr)
    // }
  }
}


;(async () => {
  const app = polka()

  app.use('/blog', makeBlogRouter(db))

  if (isProd) {
    app.use(sirv('dist', {
      dev: false,
    }))
    const index = fs.readFileSync('dist/index.html')
    app.get('/:user', async (req, res, next) => {
      res.setHeader('content-type', 'text/html')
      res.end(index)
    })
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true
      },
      appType: 'custom',
    })

    app.use(vite.middlewares)

    app.get('/:user', async (req, res, next) => {
      const url = req.originalUrl

      const indexHtml = fs.readFileSync('index.html', 'utf-8')
      const template = await vite.transformIndexHtml(url, indexHtml)

      res.setHeader('content-type', 'text/html')
      res.end(template)
    })
  }

  app.post('/op', bodyParser.json(), (req, res, next) => {
    let ops = req.body as Operation[]
    console.log(`Got ${ops.length} from client`)
  
    ops = ops.filter(op => !hasVersion(db.cg, op.id[0], op.id[1]))
    ops.forEach(op => dt.applyRemoteOp(db, op))
    broadcastOp(ops)
  
    res.end()
  })

  const server = http.createServer(app.handler as any)
  const wss = new WebSocketServer({server})


  wss.on('connection', ws => {
    console.log('Got connection!')

    const msg: WSServerClientMsg = {
      type: 'snapshot',
      data: dt.toSnapshot(db),
      v: summarizeVersion(db.cg),
    }
    ws.send(JSON.stringify(msg))
    clients.add(ws)

    ws.on('message', (msgBytes) => {
      // Writes handled via a POST request.
    })

    ws.on('close', () => {
      console.log('client closed')
      clients.delete(ws)
    })
  })

  server.listen(3002, () => {
    console.log('listening on localhost:3002')
  })
})()