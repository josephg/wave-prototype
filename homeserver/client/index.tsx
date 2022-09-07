/* @refresh reload */
import { render } from 'solid-js/web'
import {createSignal, For, Show, Switch, Match, createEffect, createMemo} from 'solid-js'

import './index.css'
import * as net from './net.js'
import { versionToString } from '../db/utils'

let username = window.location.pathname.slice(1) || 'guest'
if (username[0] === '/') username = username.slice(1)

// import App from './App';

type State = 'inbox' | 'message' | 'posts'
const [state, setState] = createSignal<State>('inbox')
const [activeMessage, setActiveMessage] = createSignal<null | string>(null)

const setS = (newState: State, e: Event) => {
  console.log('set state', newState)
  setState(newState)
}

type WaveSchema = 'post' | 'note' | 'unknown'
interface Wave {
  id?: string

  participants: string[]
  type: WaveSchema
  content: any
}

const inspectMessage = (id: string) => {
  setActiveMessage(id)
  setState('message')
  console.log('set active', id)
}

function App() {
  return (
    <div id='maincontainer'>
      <div id='header'>
        the most rad mail client yo ~
        <span style={{
          float: 'right'
        }}>Logged in as {username}</span>
      </div>

      <div id='sidebar'>
        <a onClick={[setS, 'inbox']} classList={{selected: state() === 'inbox'}}>All</a>
        <a onClick={[setS, 'posts']} classList={{selected: state() === 'posts'}}>Posts</a>
      </div>

      <div id='content'>
        <Switch fallback={<div>Unknown state {state()}</div>}>
          <Match when={state() === 'inbox'}>
            <Inbox />
          </Match>
          <Match when={state() === 'message'}>
            <Edit id={activeMessage()!} />
          </Match>
          <Match when={state() === 'posts'}>
            <Inbox typeFilter='post'/>
          </Match>
        </Switch>
      </div>
    </div>
  )
}

const newWave = (type: WaveSchema = 'unknown') => {
  const wave: Wave = {
    participants: [username],
    type,
    content: undefined
  }

  const v = net.create('waves', wave)
  const id = versionToString(v)
  inspectMessage(id)
}

const localWaves = (): Wave[] => (
  (net.dbVal.waves as Wave[]).filter(w =>
    w.participants.includes(username) || w.participants.includes('public')
  )
)

function Inbox(props: {typeFilter?: string}) {
  const typeFilter = props.typeFilter

  const filtered = () => {
    const waves = localWaves()
    return typeFilter != null
      ? waves.filter(w => w.type === typeFilter)
      : waves
  }

  return (
    <>
      <button
        onClick={[newWave, typeFilter]}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          'min-width': '1.5em',
          'min-height': '1.5em',
          'font-size': '20px',
          'font-weight': 'bolder'
        }}
      >{typeFilter == null ? '+ Create' : `+ Create ${typeFilter}`}</button>
      <For each={filtered()}>{(wave, i) =>
        <div class='message' onClick={[inspectMessage, wave.id!]}>{wave.content ?? wave.id}</div>

      }</For>
    </>

  )
}

const setSelected = (id: string, e: Event) => {
  // console.log('setSelected', id, e.target)
  const value = (e.target as HTMLSelectElement).value

  net.set('waves', id, 'type', value)
}

const waveWithId = (id: string): Wave => (
  (net.dbVal.waves as Wave[]).find(w => w.id === id)!
)

function Participants(props: {id: string}) {
  const id = props.id
  const msg = createMemo(() => waveWithId(id))

  const removeParticipant = (enemy: string) => {
    net.set('waves', id, 'participants', msg().participants.filter(u => u !== enemy))
  }

  const addParticipant = () => {
    let newUser = window.prompt('Who should we add?')
    if (newUser != null) {
      if (newUser[0] === '@') newUser = newUser.slice(1)
      net.set('waves', id, 'participants', [...msg().participants, newUser])
    }
  }

  return (
    <div id='participants'>
      <span class='msgfieldlabel'>Participants: </span>
      <For each={msg().participants}>{(name) =>
        <span style={{
          padding: '0.2em',
          margin: '0.2em',
          "border-radius": '0.2em',
          'font-family': 'monospace',
          "background-color": 'rgb(32, 60, 90)',
        }}>@{name}
          <Show when={name !== username}>
            <button onClick={[removeParticipant, name]} style={{"margin-left": '12px'}}>X</button>
          </Show>
        </span>
      }</For>

      <button onClick={addParticipant}>+ Add</button>
    </div>
  )
}

function Edit(props: {id: string}) {
  const id = props.id
  console.log('id', id)
  // let textarea: HTMLTextAreaElement

  const msg = createMemo(() => waveWithId(id))

  const bind = (elem: HTMLTextAreaElement) => {
    console.log('bind')
    ;['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste', 'input'].forEach(eventName => {
      elem.addEventListener(eventName, e => {
        const newVal = elem.value
        const oldVal = msg().content ?? ''

        if (newVal !== oldVal) {
          net.set('waves', id, 'content', newVal)
        }

      })
    })
  }
  // const change = () => {
  //   console.log('change!', textarea.value)
  // }

  return (
    <>
      <div class='msgheader'>
        <Participants id={id} />

        <label><span class='msgfieldlabel'>Schema: </span>
          <select value='post' onChange={[setSelected, id]}>
            <option value='' selected={msg().type === 'unknown'}>(Unknown)</option>
            <option value='post' selected={msg().type === 'post'}>Blog Post</option>
            <option value='note' selected={msg().type === 'note'}>Note</option>
          </select>
        </label>
      </div>

      <div id='content'>
        <Switch fallback={<div>Unknown schema {state()} cannot be rendered!</div>}>
          <Match when={msg().type === 'post'}>
            <textarea ref={bind} placeholder='Type here yo'>{msg().content ?? ''}</textarea>

            {/* Content: {msg().content ?? ''} */}
          </Match>
        </Switch>
      </div>

    </>
  )
}

render(() => <App />, document.getElementById('root')!);


// const setUsers = data => {
//   // DIRTY HACK - This works around a bug in braid-client code when you hit forward then back.
//   if (data == null) window.location = window.location

//   rawSetUsers(Object.entries(data)
//     .sort((a, b) => a[0] > b[0])
//   )
// }

// ;(async () => {
//   const {updates, initialValue} = await subscribe('/users')
//   console.log('Subscribed...')
//   setUsers(initialValue)
//   for await (const {value} of updates) {
//     console.log(value)
//     setUsers(value)
//   }
// })()