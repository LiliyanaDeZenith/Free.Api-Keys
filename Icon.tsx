const P: Record<string, string[]> = {
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 9a3 3 0 100 6 3 3 0 000-6z'],
  eyeoff: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M3 3l18 18'],
  copy: ['M9 9h10a2 2 0 012 2v9a2 2 0 01-2 2H9a2 2 0 01-2-2v-9a2 2 0 012-2z', 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1'],
  play: ['M7 4l13 8-13 8z'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
  lock: ['M7 11h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2z', 'M8 11V8a4 4 0 018 0v3'],
  search: ['M11 4a7 7 0 100 14 7 7 0 000-14z', 'M21 21l-5-5'],
  flame: ['M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'],
  out: ['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  bell: ['M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9', 'M10 21h4'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  power: ['M12 3v9', 'M6.3 6.3a8 8 0 1011.4 0'],
}

export default function Icon({ n }: { n: string }) {
  return (
    <svg className="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(P[n] ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

export function Logo({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lxg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dc8f" />
          <stop offset="1" stopColor="#a47c1b" />
        </linearGradient>
      </defs>
      <path d="M16 2l12 7v14l-12 7L4 23V9z" stroke="url(#lxg)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12.5 10v11h7" stroke="url(#lxg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
