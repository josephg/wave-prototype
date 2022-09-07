/* @refresh reload */
import { render } from 'solid-js/web'
import {createSignal, For, Show, Switch, Match, createEffect, createMemo} from 'solid-js'

import './index.css'
import * as net from './net.js'
import { versionToString } from '../db/utils'

let username = window.location.pathname.slice(1) || 'guest'
if (username[0] === '/') username = username.slice(1)

// import App from './App';

type State = 'inbox' | 'posts' | 'chatrooms'
const [state, setState] = createSignal<State>('inbox')
const [activeMessage, setActiveMessage] = createSignal<null | string>(null)

const setS = (newState: State, e: Event) => {
  console.log('set state', newState)
  setState(newState)
  setActiveMessage(null)
}

const clearMessage = () => setActiveMessage(null)

type WaveSchema = 'post' | 'note' | 'unknown' | 'chatroom'
interface Wave {
  id?: string

  participants: string[]
  type: WaveSchema
  content: any
  [k: string]: any // Ideally this should be tucked inside content.
}

const inspectMessage = (id: string) => {
  setActiveMessage(id)
  // setState('message')
  console.log('set active', id)
}

function App() {
  return (
    <div id='maincontainer'>
      <div id='header'>
        the most rad mail client yo ~
        <span style={{
          float: 'right'
        }}>Logged in as <span
          style={{
            "margin-right": '4px',
            "font-weight": 'bold',
          }}
        >{username}</span></span>
      </div>

      <div id='sidebar'>
        <a onClick={[setS, 'inbox']} classList={{selected: state() === 'inbox'}}>All</a>
        <a onClick={[setS, 'posts']} classList={{selected: state() === 'posts'}}>Posts</a>
        <a onClick={[setS, 'chatrooms']} classList={{selected: state() === 'chatrooms'}}>Chat rooms</a>
      </div>

      <div id='content'>
        <Switch fallback={<div>Unknown state {state()}</div>}>
          <Match when={activeMessage() != null}>
            <Edit id={activeMessage()!} />
          </Match>
          <Match when={state() === 'inbox'}>
            <Inbox />
          </Match>
          <Match when={state() === 'posts'}>
            <Inbox typeFilter='post'/>
          </Match>
          <Match when={state() === 'chatrooms'}>
            <Inbox typeFilter='chatroom'/>
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

function MessageListItem(wave: Wave) {
  console.log('type', wave.type)
  return <div class='messagelistitem' onClick={[inspectMessage, wave.id!]}>
    <Switch fallback={<>
      <span>Unknown data</span> - <span>ID: {wave.id}</span>
    </>}>
      <Match when={wave.type === 'post'}>
        <b>POST:</b> {wave.content ?? 'empty'}
      </Match>
      <Match when={wave.type === 'chatroom'}>
        <b>Party room:</b> Party goers: {wave.participants.join(', ')}
      </Match>
    </Switch>
  </div>
}

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
        MessageListItem(wave)
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

const errExpr = (str: string): never => { throw Error(str) }

function Edit(props: {id: string}) {
  const id = props.id
  console.log('id', id)
  // let textarea: HTMLTextAreaElement

  const msg = createMemo(() => waveWithId(id))

  const bindTextArea = (field: string) => (elem: HTMLTextAreaElement) => {
    ;['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste', 'input'].forEach(eventName => {
      elem.addEventListener(eventName, e => {
        const newVal = elem.value
        const oldVal = msg()[field] ?? ''

        if (newVal !== oldVal) {
          net.set('waves', id, field, newVal)
        }
      })
    })
  }

  const bindInput = (field: string) => (elem: HTMLInputElement) => {
    ;['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste', 'input'].forEach(eventName => {
      elem.addEventListener(eventName, e => {
        let oldVal: any, newVal: any
        if (elem.type === 'text') {
          newVal = elem.value
          oldVal = msg()[field] ?? ''
        } else if (elem.type === 'checkbox') {
          newVal = elem.checked
          oldVal = msg()[field] ?? false
        } else {
          console.log(elem.type)
          throw Error('Huh?? Unknown input type')
        }

        // console.log(oldVal, newVal)

        if (newVal !== oldVal) {
          net.set('waves', id, field, newVal)
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
        {/* <button
          style={{
            margin: '5px',
            padding: '2px',
          }}
          onClick={clearMessage}
        >&lt;- Back</button> */}
        <Participants id={id} />

        <label><span class='msgfieldlabel'>Schema: </span>
          <select value='post' onChange={[setSelected, id]}>
            <option value='' selected={msg().type === 'unknown'}>(Unknown)</option>
            <option value='post' selected={msg().type === 'post'}>Blog Post</option>
            <option value='note' selected={msg().type === 'note'}>Note</option>
            <option value='chatroom' selected={msg().type === 'chatroom'}>Chat room</option>
          </select>
        </label>
      </div>

      <div class='msgcontent'>
        <Switch fallback={<div>Unknown schema {state()} cannot be rendered!</div>}>
          <Match when={msg().type === 'post'}>
            <div class='post'>
              {/* hi {JSON.stringify(msg())} */}
              <label><span class='msgfieldlabel'>Title: </span>
                <input type='text' ref={bindInput('title')} placeholder='Title' value={msg().title ?? ''} />
              </label>

              <label><span class='msgfieldlabel'>Slug: </span>
                <input type='text' ref={bindInput('slug')} placeholder='cool_post' value={msg().slug ?? ''} />
              </label>

              <label><span class='msgfieldlabel'>Published: </span>
                <input type='checkbox' ref={bindInput('published')} placeholder='cool_post' checked={msg().published ?? false} />
                <Show when={msg().slug != '' && msg().published}>
                  <a href={`/blog/${msg().slug}`} target='_blank'>Visit live</a>
                </Show>
              </label>

              <textarea ref={bindTextArea('content')} placeholder='Type here yo'>{msg().content ?? ''}</textarea>
            </div>
          </Match>
          <Match when={msg().type === 'chatroom'}>
            <h1>Cool chat room! (TODO!)</h1>
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