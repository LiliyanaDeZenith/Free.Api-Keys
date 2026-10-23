import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CATS, LANGS, call, copyText, fmt, hasToken, sample, setToken, untilDrop } from './lib'
import type { Api, Me, Ov } from './lib'
import Icon, { Logo } from './components/Icon'
import KeyCard, { KeyLine } from './components/KeyCard'

type Say = (m: string) => void
type Preset = { id: string; key: string } | null
const SORTS: [string, string][] = [
  ['fresh', 'Terbaru'],
  ['hits', 'Paling populer'],
  ['stable', 'Paling stabil'],
]
const errMsg = (x: unknown) => (x instanceof Error ? x.message : 'Terjadi kesalahan')
const pretty = (s: string) => {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

function Drops() {
  const items = useMemo(
    () => Array.from({ length: 30 }, (_, i) => ({ l: (i * 37 + 11) % 100, s: 2 + (i % 4), d: -((i * 13) % 17), t: 8 + (i % 7) * 2 })),
    []
  )
  return (
    <div className="drops" aria-hidden="true">
      {items.map((p, i) => (
        <i key={i} style={{ left: p.l + '%', width: p.s, height: p.s, animationDelay: p.d + 's', animationDuration: p.t + 's' }} />
      ))}
    </div>
  )
}

function Auth({ onDone }: { onDone: (m: Me) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const d = await call<{ token: string; me: Me }>('/' + mode, { name, pass })
      setToken(d.token)
      onDone(d.me)
    } catch (x) {
      setErr(errMsg(x))
      setBusy(false)
    }
  }
  return (
    <div className="auth">
      <Drops />
      <form onSubmit={submit}>
        <div className="brand c">
          <Logo s={34} />
          LUXYNE VAULT
        </div>
        <p className="sub">Masuk atau daftar untuk membuka vault.</p>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Masuk
          </button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
            Daftar
          </button>
        </div>
        <input placeholder="Username" autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          type="password"
          placeholder="Password, minimal 6 karakter"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        {err && <div className="err">{err}</div>}
        <button className="btn gold" disabled={busy}>
          {busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Buat akun'}
        </button>
      </form>
    </div>
  )
}

function Play({ apis, me, preset, say, copy }: { apis: Api[]; me: Me; preset: Preset; say: Say; copy: (v: string) => void }) {
  const [id, setId] = useState(preset?.id ?? apis[0]?.id ?? '')
  const [key, setKey] = useState(preset ? preset.key : '')
  const [lang, setLang] = useState('cURL')
  const [res, setRes] = useState<{ status: number; ping: number; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const a = apis.find((x) => x.id === id)
  const choose = (v: string) => {
    const t = apis.find((x) => x.id === v)
    setId(v)
    setKey(t && t.auth !== 'none' ? (me.got[v] ?? '') : '')
    setRes(null)
  }
  const run = async () => {
    setBusy(true)
    setRes(null)
    try {
      setRes(await call('/play', { api: id, key }))
    } catch (x) {
      say(errMsg(x))
    }
    setBusy(false)
  }
  if (!a) return <p className="empty">Belum ada API.</p>
  const code = sample(lang, a, key)
  return (
    <div className="play">
      <section className="panel">
        <h3>Request</h3>
        <label className="field">
          <span className="lab">API</span>
          <select value={id} onChange={(e) => choose(e.target.value)}>
            {apis.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="lab">API key</span>
          <input
            value={key}
            disabled={a.auth === 'none'}
            placeholder={a.auth === 'none' ? 'API ini tidak butuh key' : 'Tempel key, atau buka vault dulu'}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <button className="btn gold" onClick={run} disabled={busy}>
          <Icon n="play" />
          {busy ? 'Menjalankan…' : 'Run'}
        </button>
        {res && (
          <div className="meta">
            <span className={'pill ' + (res.status < 400 ? 'ok' : 'bad')}>HTTP {res.status}</span>
            <span className="pill">{res.ping} ms</span>
          </div>
        )}
        <pre>{res ? pretty(res.body).slice(0, 6000) : 'Klik Run untuk mengirim request ke API ini.'}</pre>
      </section>
      <section className="panel">
        <h3>Contoh kode</h3>
        <div className="tabs">
          {LANGS.map((l) => (
            <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
              {l}
            </button>
          ))}
        </div>
        <pre>{code}</pre>
        <button className="btn" onClick={() => copy(code)}>
          <Icon n="copy" />
          Copy kode
        </button>
      </section>
    </div>
  )
}

function Admin({ apis, say }: { apis: Api[]; say: Say }) {
  const [ov, setOv] = useState<Ov | null>(null)
  const [cat, setCat] = useState('AI')
  const [id, setId] = useState('')
  const [val, setVal] = useState('')
  const [text, setText] = useState('')
  const load = useCallback(async () => {
    try {
      setOv(await call<Ov>('/admin/overview'))
    } catch (x) {
      say(errMsg(x))
    }
  }, [say])
  useEffect(() => {
    load()
  }, [load])
  const opts = apis.filter((a) => a.cat === cat)
  const cur = opts.find((a) => a.id === id) ?? opts[0]
  const act = async (action: string, index = 0) => {
    if (!cur) return
    try {
      setOv(await call<Ov>('/admin/key', { api: cur.id, value: val, action, index }))
      if (action === 'add') {
        setVal('')
        say('Key live dan masuk ke pool')
      }
    } catch (x) {
      say(errMsg(x))
    }
  }
  const send = async () => {
    try {
      await call('/admin/broadcast', { text })
      setText('')
      say('Pengumuman terkirim')
    } catch (x) {
      say(errMsg(x))
    }
  }
  if (!ov) return <p className="empty">Memuat statistik…</p>
  const mx = Math.max(...ov.hours)
  const peak = mx > 0 ? ov.hours.indexOf(mx) : -1
  const rows = cur ? (ov.keys[cur.id] ?? []) : []
  return (
    <div className="adm">
      <section className="panel stats">
        <div>
          <span className="lab">Total user</span>
          <b>{ov.users}</b>
        </div>
        <div>
          <span className="lab">Key diambil</span>
          <b>{ov.claims}</b>
        </div>
        <div>
          <span className="lab">Jam paling ramai</span>
          <b>{peak >= 0 ? String(peak).padStart(2, '0') + ':00 WIB' : '-'}</b>
        </div>
      </section>
      <div className="row2">
        <section className="panel">
          <h3>API paling laris</h3>
          {ov.top.length ? (
            <ol className="top5">
              {ov.top.map((t) => (
                <li key={t.id}>
                  <span>{apis.find((a) => a.id === t.id)?.name ?? t.id}</span>
                  <b>{t.count}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">Belum ada key yang diambil.</p>
          )}
        </section>
        <section className="panel">
          <h3>Aktivitas per jam (WIB)</h3>
          <svg className="hours" viewBox="0 0 240 64" role="img" aria-label="Grafik aktivitas per jam">
            {ov.hours.map((h, i) => (
              <rect key={i} x={i * 10 + 1} y={60 - (h / Math.max(mx, 1)) * 56} width="8" height={(h / Math.max(mx, 1)) * 56} className={h === mx && h > 0 ? 'pk' : ''} />
            ))}
            <path d="M0 60.5h240" />
          </svg>
        </section>
      </div>
      <section className="panel">
        <h3>Kelola key</h3>
        <div className="inline">
          <select value={cat} onChange={(e) => { setCat(e.target.value); setId('') }}>
            {CATS.slice(1).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={cur?.id ?? ''} onChange={(e) => setId(e.target.value)}>
            {opts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="inline">
          <input placeholder="Tempel key baru" value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="btn gold" onClick={() => act('add')} disabled={!val.trim()}>
            Tambah key
          </button>
        </div>
        {rows.length ? (
          <table className="tbl">
            <tbody>
              {rows.map((k) => (
                <tr key={k.i}>
                  <td>{k.mask}</td>
                  <td className={k.demo ? 'mute' : k.dead ? 'bad' : k.on ? 'okc' : 'mute'}>
                    {k.demo ? 'placeholder' : k.dead ? 'mati' : k.on ? 'aktif' : 'nonaktif'}
                  </td>
                  <td className="act">
                    <button className="ico" title="Aktifkan atau nonaktifkan" onClick={() => act('toggle', k.i)}>
                      <Icon n="power" />
                    </button>
                    <button className="ico" title="Hapus key" onClick={() => act('del', k.i)}>
                      <Icon n="trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="hint">Belum ada key untuk API ini.</p>
        )}
      </section>
      <section className="panel">
        <h3>Broadcast</h3>
        <div className="inline">
          <input placeholder="Contoh: Drop baru jam 8 malam!" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" onClick={send} disabled={!text.trim()}>
            Kirim
          </button>
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(hasToken())
  const [me, setMe] = useState<Me | null>(null)
  const [apis, setApis] = useState<Api[]>([])
  const [news, setNews] = useState<string[]>([])
  const [down, setDown] = useState('')
  const [view, setView] = useState<'vault' | 'play' | 'admin'>('vault')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [sort, setSort] = useState('fresh')
  const [onlyFav, setOnlyFav] = useState(false)
  const [favs, setFavs] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('lx_fav') ?? '[]')
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  })
  const [seen, setSeen] = useState(localStorage.getItem('lx_seen') ?? '')
  const [toast, setToast] = useState('')
  const [left, setLeft] = useState(untilDrop())
  const [code, setCode] = useState('')
  const [preset, setPreset] = useState<Preset>(null)
  const timer = useRef<number>()

  const say = useCallback((m: string) => {
    setToast(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(''), 2400)
  }, [])

  const logout = useCallback(() => {
    setToken('')
    setAuthed(false)
    setMe(null)
    setApis([])
    setView('vault')
  }, [])

  const load = useCallback(async () => {
    try {
      const d = await call<{ me: Me; apis: Api[]; news: string[] }>('/state')
      setMe(d.me)
      setApis(d.apis)
      setNews(d.news ?? [])
      setDown('')
    } catch (x) {
      if ((x as { status?: number }).status === 401) logout()
      else setDown(errMsg(x))
    }
  }, [logout])

  useEffect(() => {
    if (!authed) return
    load()
    const t = window.setInterval(load, 30000)
    return () => window.clearInterval(t)
  }, [authed, load])

  useEffect(() => {
    const t = window.setInterval(() => setLeft(untilDrop()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    localStorage.setItem('lx_fav', JSON.stringify(favs))
  }, [favs])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const r = apis.filter((a) => (cat === 'All' || a.cat === cat) && (!s || a.name.toLowerCase().includes(s)) && (!onlyFav || favs.includes(a.id)))
    const rank: Record<string, (a: Api, b: Api) => number> = {
      fresh: (a, b) => b.fresh - a.fresh,
      hits: (a, b) => b.hits - a.hits || b.today - a.today,
      stable: (a, b) => b.uptime - a.uptime || (a.ping || 1e9) - (b.ping || 1e9),
    }
    return r.sort(rank[sort] ?? rank.fresh)
  }, [apis, q, cat, sort, onlyFav, favs])

  const copy = async (v: string) => say((await copyText(v)) ? 'Copied to Clipboard' : 'Gagal menyalin, salin manual')
  const toggleFav = (id: string) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  const test = (a: Api, key: string) => {
    setPreset({ id: a.id, key })
    setView('play')
    window.scrollTo(0, 0)
  }
  const open = async (a: Api) => {
    try {
      const d = await call<{ me: Me }>('/claim', { api: a.id })
      setMe(d.me)
      say('Vault ' + a.name + ' terbuka')
      load()
    } catch (x) {
      say(errMsg(x))
    }
  }
  const mystery = async () => {
    try {
      const d = await call<{ me: Me }>('/mystery', {})
      setMe(d.me)
      say('Mystery Key terbuka')
    } catch (x) {
      say(errMsg(x))
    }
  }
  const redeem = async () => {
    try {
      const d = await call<{ me: Me }>('/redeem', { code })
      setMe(d.me)
      setCode('')
      say('Selamat datang di Luxyne VIP')
    } catch (x) {
      say(errMsg(x))
    }
  }

  if (!authed) return <Auth onDone={(m) => { setMe(m); setAuthed(true) }} />
  if (!me)
    return (
      <div className="boot">
        <Logo s={40} />
        {down ? (
          <>
            <p>{down}</p>
            <button className="btn" onClick={load}>
              Coba lagi
            </button>
          </>
        ) : (
          <p>Memuat vault…</p>
        )}
      </div>
    )

  const latest = news.length ? news[news.length - 1] : ''
  const sd = me.streak ? ((me.streak - 1) % 7) + 1 : 0

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <Logo />
            LUXYNE
          </div>
          <nav>
            <button className={view === 'vault' ? 'on' : ''} onClick={() => setView('vault')}>
              Vault
            </button>
            <button className={view === 'play' ? 'on' : ''} onClick={() => setView('play')}>
              Playground
            </button>
            {me.admin && (
              <button className={view === 'admin' ? 'on' : ''} onClick={() => setView('admin')}>
                Admin
              </button>
            )}
          </nav>
          <div className="who">
            <span className="nm">{me.name}</span>
            <b className={'tier' + (me.vip ? ' vip' : '')}>{me.vip ? 'VIP' : 'FREE'}</b>
            <button className="ico" title="Keluar" onClick={logout}>
              <Icon n="out" />
            </button>
          </div>
        </div>
      </header>

      {latest && latest !== seen && (
        <div className="news">
          <Icon n="bell" />
          <span>{latest}</span>
          <button
            className="ico"
            title="Tutup"
            onClick={() => {
              localStorage.setItem('lx_seen', latest)
              setSeen(latest)
            }}
          >
            <Icon n="x" />
          </button>
        </div>
      )}

      {view === 'vault' && (
        <>
          <section className="hero">
            <Drops />
            <h1>LUXYNE VAULT</h1>
            <p>Key API gratis. Buka vault, ambil key, langsung test.</p>
          </section>
          <main className="wrap">
            <section className="panel stats">
              <div>
                <span className="lab">Tier</span>
                <b className={me.vip ? 'gold' : ''}>{me.vip ? 'Luxyne VIP' : 'Free'}</b>
              </div>
              <div>
                <span className="lab">Kuota hari ini</span>
                <b>
                  {me.used}/{me.limit}
                </b>
                <i className="bar">
                  <u style={{ width: Math.min(100, (me.used / me.limit) * 100) + '%' }} />
                </i>
              </div>
              <div>
                <span className="lab">Streak login</span>
                <b>
                  <Icon n="flame" />
                  {sd}/7
                </b>
              </div>
              <div>
                <span className="lab">VIP Pass</span>
                <b>{me.passes}</b>
              </div>
              <div>
                <span className="lab">Daily Drop dalam</span>
                <b>{fmt(left)}</b>
              </div>
            </section>

            <div className="row2">
              <section className="panel">
                <h3>Mystery Key</h3>
                <p className="hint">Satu key acak per hari. API-nya dirahasiakan, tebak sendiri lewat Playground.</p>
                {me.got.mystery ? (
                  <KeyLine value={me.got.mystery} onCopy={copy} />
                ) : (
                  <button className="btn gold" onClick={mystery}>
                    Ambil Mystery Key
                  </button>
                )}
              </section>
              <section className="panel">
                <h3>{me.vip ? 'Akses Luxyne VIP aktif' : 'Naik ke Luxyne VIP'}</h3>
                {me.vip ? (
                  <p className="hint">Kamu dapat 50 key per hari dan akses key premium (Gemini Pro, Groq Unlimited).</p>
                ) : (
                  <>
                    <p className="hint">Free dapat 5 key per hari. VIP dapat 50 key per hari plus key premium. Streak 7 hari juga memberi 1 VIP Pass.</p>
                    <div className="inline">
                      <input placeholder="Kode invite" value={code} onChange={(e) => setCode(e.target.value)} />
                      <button className="btn" onClick={redeem} disabled={!code.trim()}>
                        Redeem
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>

            <div className="tools">
              <label className="search">
                <Icon n="search" />
                <input placeholder="Cari nama API" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button className={'btn' + (onlyFav ? ' on' : '')} onClick={() => setOnlyFav(!onlyFav)}>
                <Icon n="star" />
                Favorit
              </button>
            </div>
            <div className="chips">
              {CATS.map((c) => (
                <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>

            {list.length ? (
              <div className="grid">
                {list.map((a) => (
                  <KeyCard
                    key={a.id}
                    a={a}
                    val={me.got[a.id]}
                    fav={favs.includes(a.id)}
                    onFav={() => toggleFav(a.id)}
                    onOpen={() => open(a)}
                    onCopy={copy}
                    onTest={test}
                  />
                ))}
              </div>
            ) : (
              <p className="empty">Tidak ada API yang cocok. Ubah kata kunci atau kategori.</p>
            )}
            <footer className="foot">Luxyne Vault. Pakai key dengan wajar dan jangan dijual ulang.</footer>
          </main>
        </>
      )}

      {view === 'play' && (
        <main className="wrap">
          <Play apis={apis} me={me} preset={preset} say={say} copy={copy} />
        </main>
      )}

      {view === 'admin' && me.admin && (
        <main className="wrap">
          <Admin apis={apis} say={say} />
        </main>
      )}

      <div className={'toast' + (toast ? ' on' : '')} role="status">
        {toast}
      </div>
    </>
  )
}
