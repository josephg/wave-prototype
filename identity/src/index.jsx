/* @refresh reload */
import { render } from 'solid-js/web'
import {createSignal, For} from 'solid-js'
import {subscribe} from '@braid-protocol/client'

import './index.css';
// import App from './App';

const [users, rawSetUsers] = createSignal({})

function App() {
  return (
    <>
      <h1>Registered Users</h1>

      <ul>
        <For each={users()}>{([name, user]) =>
          <li>
            <div>
              <b>{name}:</b>
              {JSON.stringify(user)}
            </div>
          </li>
        }</For>
      </ul>

      <a href='/create'>+ Create user</a>
    </>
  )
}

render(() => <App />, document.getElementById('root'));


const setUsers = data => {
  // DIRTY HACK - This works around a bug in braid-client code when you hit forward then back.
  if (data == null) window.location = window.location

  rawSetUsers(Object.entries(data)
    .sort((a, b) => a[0] > b[0])
  )
}

;(async () => {
  const {updates, initialValue} = await subscribe('/users')
  console.log('Subscribed...')
  setUsers(initialValue)
  for await (const {value} of updates) {
    console.log(value)
    setUsers(value)
  }
})()