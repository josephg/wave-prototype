/* @refresh reload */
import { render } from 'solid-js/web'
// import {createSignal, For} from 'solid-js'

import './index.css';

const defaultHome = `${location.hostname}:3002`

const cert = Math.random().toString(36).slice(2)

function App() {
  return (
    <>
      <h1>Create User</h1>

      <form onSubmit={submit}>
        <div>
          <label for="username">Username:</label>

          <input
            type="text"
            name="username"
            id='username'
            placeholder='username'
            autofocus
          ></input>
        </div>

        <div>
          <label for='homeserver'>Home server</label>
          <input
            type="text"
            name="homeserver"
            placeholder='home server'
            value={defaultHome}
          ></input>
        </div>

        <div>
          <label>Certificate:</label>
          <span id="cert" style="font-family: monospace">{cert}</span>
        </div>

        <div>
          <input type='submit' value="Submit!"></input>
        </div>
      </form>
    </>
  )
}

render(() => <App />, document.getElementById('root'));


async function submit(e) {
  const data = new FormData(e.target)
  e.preventDefault()
  // console.log(e)

  try {
    await fetch('/upd', {
      method: 'POST',
      body: JSON.stringify({
        type: 'create',
        name: data.get('username'),
        homeservers: [data.get('homeserver')],
        pub_key: cert
      }),
      headers: {
        'content-type': 'application/json'
      }
    })
  } catch (e) {
    // console.error(e)
    throw e
  }

  location.replace('/')
}