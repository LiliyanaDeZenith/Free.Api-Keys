import { useState } from 'react'
import type { Api } from '../lib'
import Icon from './Icon'

export function KeyLine({ value, onCopy }: { value: string; onCopy: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="keyline">
      <code className={show ? '' : 'blur'}>{value}</code>
      <button className="ico" title={show ? 'Sembunyikan key' : 'Tampilkan key'} onClick={() => setShow(!show)}>
        <Icon n={show ? 'eyeoff' : 'eye'} />
      </button>
      <button className="ico" title="Copy key" onClick={() => onCopy(value)}>
        <Icon n="copy" />
      </button>
    </div>
  )
}

type Props = {
  a: Api
  val?: string
  fav: boolean
  onFav: () => void
  onOpen: () => Promise<void>
  onCopy: (v: string) => void
  onTest: (a: Api, key: string) => void
}

export default function KeyCard({ a, val, fav, onFav, onOpen, onCopy, onTest }: Props) {
  const [busy, setBusy] = useState(false)
  const free = a.auth === 'none'
  const empty = !free && a.keys < 1
  const label = { online: 'Online', slow: 'Lemot', down: 'Down' }[a.status]
  return (
    <article className={'card' + (a.badge === 'VIP ONLY' ? ' vip' : '')}>
      <header>
        <svg className="chip" viewBox="0 0 36 28" aria-hidden="true">
          <rect x="1" y="1" width="34" height="26" rx="5" />
          <path d="M1 10h34M1 18h34M13 1v26M23 1v26" />
        </svg>
        <span className={'st ' + a.status}>
          <i />
          {label}
          <b>{a.ping ? a.ping + ' ms' : '-'}</b>
        </span>
        <button className={'ico' + (fav ? ' on' : '')} title="Favorit" onClick={onFav}>
          <Icon n="star" />
        </button>
      </header>
      <h3>
        {a.name}
        {a.badge && <em className={'badge ' + a.badge.split(' ')[0].toLowerCase()}>{a.badge}</em>}
      </h3>
      <p className="cat">{free ? a.cat + ', tanpa key' : a.cat}</p>
      {val ? (
        <KeyLine value={val} onCopy={onCopy} />
      ) : (
        <button
          className="vault"
          disabled={busy || empty}
          onClick={async () => {
            setBusy(true)
            await onOpen()
            setBusy(false)
          }}
        >
          <Icon n="lock" />
          {busy ? 'Membuka…' : empty ? 'Stok kosong' : 'Buka Vault'}
        </button>
      )}
      <footer>
        <span>Uptime {a.uptime.toFixed(1)}%</span>
        <span>{a.today} dipakai hari ini</span>
        <span>Stok {a.keys}</span>
      </footer>
      {val && (
        <button className="btn" onClick={() => onTest(a, free ? '' : val)}>
          <Icon n="play" />
          Test di Playground
        </button>
      )}
    </article>
  )
}
