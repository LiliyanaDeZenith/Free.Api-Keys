export type Api = {
  id: string
  name: string
  cat: string
  badge: string
  probe: string
  auth: string
  ping: number
  status: 'online' | 'slow' | 'down'
  uptime: number
  today: number
  keys: number
  hits: number
  fresh: number
}

export type Me = {
  name: string
  vip: boolean
  admin: boolean
  streak: number
  passes: number
  used: number
  limit: number
  total: number
  got: Record<string, string>
}

export type Ov = {
  users: number
  claims: number
  top: { id: string; count: number }[]
  hours: number[]
  keys: Record<string, { i: number; mask: string; on: boolean; dead: boolean; demo: boolean }[]>
}

export const CATS = ['All', 'AI', 'Downloader', 'Film', 'Cuaca', 'Crypto', 'Game', 'Developer']
export const LANGS = ['cURL', 'JavaScript', 'Python', 'Go']

let token = localStorage.getItem('lx_token') ?? ''
export const hasToken = () => token !== ''
export function setToken(t: string) {
  token = t
  if (t) localStorage.setItem('lx_token', t)
  else localStorage.removeItem('lx_token')
}

export async function call<T = any>(path: string, body?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch('/api' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Server tidak terjangkau. Pastikan backend Go berjalan di port 8080')
  }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(d.error ?? 'Terjadi kesalahan (' + r.status + ')'), { status: r.status })
  return d as T
}

export async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t)
    return true
  } catch {
    const e = document.createElement('textarea')
    e.value = t
    e.style.position = 'fixed'
    e.style.opacity = '0'
    document.body.appendChild(e)
    e.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    e.remove()
    return ok
  }
}

// milidetik menuju 00:00 WIB berikutnya
export function untilDrop(): number {
  const now = Date.now()
  const w = new Date(now + 7 * 3600_000)
  return Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() + 1) - 7 * 3600_000 - now
}

export function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}

export function sample(lang: string, a: Api, key: string): string {
  const k = key || 'YOUR_API_KEY'
  const url = a.probe.split('{key}').join(encodeURIComponent(k))
  const h = a.auth === 'bearer' ? 'Bearer ' + k : a.auth === 'raw' ? k : ''
  if (lang === 'cURL') return `curl "${url}"` + (h ? ` \\\n  -H "Authorization: ${h}"` : '')
  if (lang === 'JavaScript') {
    const opt = h ? `, {\n  headers: { Authorization: "${h}" },\n}` : ''
    return `const res = await fetch("${url}"${opt})\nconsole.log(await res.json())`
  }
  if (lang === 'Python') {
    const opt = h ? `,\n    headers={"Authorization": "${h}"}` : ''
    return `import requests\n\nres = requests.get("${url}"${opt})\nprint(res.json())`
  }
  const hdr = h ? `\treq.Header.Set("Authorization", "${h}")\n` : ''
  return `package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"net/http"\n)\n\nfunc main() {\n\treq, _ := http.NewRequest("GET", "${url}", nil)\n${hdr}\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\tb, _ := io.ReadAll(res.Body)\n\tfmt.Println(string(b))\n}`
}
