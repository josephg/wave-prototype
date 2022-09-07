import fs from 'fs'

const FILENAME = 'id.json'

let version = 0
export const users = {}
export const getVersion = () => version

// Update:
// {type: 'create', name: String, homeservers: String[], pub_key: XXXX}
// {type: 'homeservers', name: String[], sig: XXXX}
// {type: 'rotate key', name: String, sig: XXXX, new_key: YYYY}


const merge_update = upd => {
  switch (upd.type) {
    case 'create': {
      const {name, homeservers, pub_key} = upd
      if (users[name] != null) {
        throw Error('User already exists')
      }
      users[name] = { homeservers, pub_key }
      break
    }

    case 'homeserver': {
      const {name, homeservers} = upd
      if (users[name] == null) throw Error('User does not exist')
      users[name].homeservers = homeservers
      break
    }

    case 'rotate key': {
      // TODO.
      break
    }

    default: {
      throw Error('Invalid update type: ' + upd.type)
    }
  }

  version += 1
}

// At startup, replay all entries.
;(() => {
  try {
    const f = fs.readFileSync(FILENAME, 'utf-8')

    for (const line of f.split('\n')) {
      if (line === '') continue

      const update = JSON.parse(line)
      merge_update(update)

      console.log('upd', update)
    }

    for (const username in users) {
      const user = users[username]
      console.log(username, user)
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e

    console.log('Database empty - creating!')
  }
})()

const stream = fs.createWriteStream(FILENAME, {
  encoding: 'utf-8',
  flags: 'a'
})

export const update = (upd) => {
  merge_update(upd)
  stream.write(JSON.stringify(upd) + '\n')
}



process.on('exit', () => {
  stream.close()
})

process.on('SIGINT', () => {
  process.exit(1)
})