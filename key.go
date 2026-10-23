package handlers

import (
	"bufio"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

var (
	wib    = time.FixedZone("WIB", 7*3600)
	client = &http.Client{Timeout: 8 * time.Second}
)

func day(off int) string { return time.Now().In(wib).AddDate(0, 0, off).Format("2006-01-02") }

type API struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Cat     string  `json:"cat"`
	Badge   string  `json:"badge"`
	Probe   string  `json:"probe"`
	Auth    string  `json:"auth"`
	Ping    int     `json:"ping"`
	Status  string  `json:"status"`
	Uptime  float64 `json:"uptime"`
	Today   int     `json:"today"`
	Keys    int     `json:"keys"`
	Hits    int     `json:"hits"`
	Fresh   int64   `json:"fresh"`
	OK, Tot int     `json:"-"`
}

type Key struct {
	Value string `json:"value"`
	On    bool   `json:"on"`
	Dead  bool   `json:"dead"`
	Demo  bool   `json:"demo"`
}

type User struct {
	Name   string            `json:"name"`
	Salt   string            `json:"salt"`
	Hash   string            `json:"hash"`
	VIP    bool              `json:"vip"`
	Admin  bool              `json:"admin"`
	Streak int               `json:"streak"`
	Last   string            `json:"last"`
	Day    string            `json:"day"`
	Used   int               `json:"used"`
	Passes int               `json:"passes"`
	Total  int               `json:"total"`
	Got    map[string]string `json:"got"`
}

type data struct {
	Users map[string]*User  `json:"users"`
	Pool  map[string][]*Key `json:"pool"`
	News  []string          `json:"news"`
	Hits  map[string]int    `json:"hits"`
	Hours [24]int           `json:"hours"`
	Today map[string]int    `json:"today"`
	TDay  string            `json:"tday"`
}

type ipState struct {
	n            int
	start, until time.Time
}

type Server struct {
	mu sync.Mutex
	data
	apis  []*API
	sess  map[string]string
	rr    map[string]int
	ips   map[string]*ipState
	regs  map[string]int
	codes map[string]bool
	admin string
}

// catalog: id, nama, kategori, badge, URL probe ({key} = tempat key), jenis auth (bearer|raw|query|none)
func catalog() []*API {
	rows := [][6]string{
		{"groq", "Groq", "AI", "HOT", "https://api.groq.com/openai/v1/models", "bearer"},
		{"gemini", "Gemini (AI Studio)", "AI", "HOT", "https://generativelanguage.googleapis.com/v1beta/models?key={key}", "query"},
		{"openrouter", "OpenRouter", "AI", "", "https://openrouter.ai/api/v1/auth/key", "bearer"},
		{"huggingface", "Hugging Face", "AI", "", "https://huggingface.co/api/whoami-v2", "bearer"},
		{"mistral", "Mistral AI", "AI", "", "https://api.mistral.ai/v1/models", "bearer"},
		{"cohere", "Cohere", "AI", "", "https://api.cohere.com/v1/models", "bearer"},
		{"together", "Together AI", "AI", "", "https://api.together.xyz/v1/models", "bearer"},
		{"deepseek", "DeepSeek", "AI", "NEW", "https://api.deepseek.com/models", "bearer"},
		{"geminipro", "Gemini Pro", "AI", "VIP ONLY", "https://generativelanguage.googleapis.com/v1beta/models?key={key}", "query"},
		{"groqunlimited", "Groq Unlimited", "AI", "VIP ONLY", "https://api.groq.com/openai/v1/models", "bearer"},
		{"tiktok", "TikTok Unofficial API", "Downloader", "HOT", "https://www.tikwm.com/", "none"},
		{"youtube", "YouTube Data API v3", "Downloader", "HOT", "https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key={key}", "query"},
		{"instagram", "Instagram Graph API", "Downloader", "LIMITED", "https://graph.facebook.com/v19.0/me?access_token={key}", "query"},
		{"pexels", "Pexels API", "Downloader", "", "https://api.pexels.com/v1/curated?per_page=1", "raw"},
		{"unsplash", "Unsplash API", "Downloader", "", "https://api.unsplash.com/photos?per_page=1&client_id={key}", "query"},
		{"pixabay", "Pixabay API", "Downloader", "", "https://pixabay.com/api/?per_page=3&key={key}", "query"},
		{"spotify", "Spotify Web API", "Downloader", "LIMITED", "https://api.spotify.com/v1/search?q=daft&type=artist&limit=1", "bearer"},
		{"tmdb", "TMDB API", "Film", "HOT", "https://api.themoviedb.org/3/configuration?api_key={key}", "query"},
		{"omdb", "OMDB API", "Film", "", "https://www.omdbapi.com/?i=tt0111161&apikey={key}", "query"},
		{"jikan", "Jikan API (Anime)", "Film", "", "https://api.jikan.moe/v4/top/anime?limit=1", "none"},
		{"genius", "Genius API (Lirik)", "Film", "", "https://api.genius.com/search?q=daft", "bearer"},
		{"rawg", "RAWG API (Game)", "Game", "", "https://api.rawg.io/api/games?page_size=1&key={key}", "query"},
		{"freetogame", "FreeToGame API", "Game", "NEW", "https://www.freetogame.com/api/game?id=452", "none"},
		{"openweather", "OpenWeatherMap", "Cuaca", "", "https://api.openweathermap.org/data/2.5/weather?q=Jakarta&appid={key}", "query"},
		{"weatherapi", "WeatherAPI", "Cuaca", "", "https://api.weatherapi.com/v1/current.json?q=Jakarta&key={key}", "query"},
		{"newsapi", "NewsAPI", "Cuaca", "", "https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey={key}", "query"},
		{"coingecko", "CoinGecko", "Crypto", "HOT", "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", "none"},
		{"exchangerate", "ExchangeRate API", "Crypto", "", "https://v6.exchangerate-api.com/v6/{key}/latest/USD", "query"},
		{"fixer", "Fixer API", "Crypto", "LIMITED", "https://data.fixer.io/api/latest?access_key={key}", "query"},
		{"ipgeo", "IP Geolocation API", "Developer", "", "https://api.ipgeolocation.io/ipgeo?apiKey={key}", "query"},
		{"randomuser", "Random User API", "Developer", "", "https://randomuser.me/api/", "none"},
		{"jsonplaceholder", "JSONPlaceholder", "Developer", "", "https://jsonplaceholder.typicode.com/todos/1", "none"},
		{"catfacts", "Cat Facts API", "Developer", "", "https://catfact.ninja/fact", "none"},
		{"dog", "Dog API", "Developer", "", "https://dog.ceo/api/breeds/image/random", "none"},
		{"nasa", "NASA Open API", "Developer", "", "https://api.nasa.gov/planetary/apod?api_key={key}", "query"},
		{"openlibrary", "Open Library API", "Developer", "", "https://openlibrary.org/search.json?q=dune&limit=1", "none"},
		{"dictionary", "Dictionary API", "Developer", "", "https://api.dictionaryapi.dev/api/v2/entries/en/hello", "none"},
	}
	out := make([]*API, len(rows))
	for i, r := range rows {
		out[i] = &API{ID: r[0], Name: r[1], Cat: r[2], Badge: r[3], Probe: r[4], Auth: r[5],
			Status: "online", Uptime: 100, Fresh: time.Now().Unix() - int64(i)}
	}
	return out
}

func LoadEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<16), 1<<20)
	for sc.Scan() {
		l := strings.TrimSpace(sc.Text())
		if l == "" || l[0] == '#' {
			continue
		}
		if k, v, ok := strings.Cut(l, "="); ok {
			k = strings.TrimSpace(k)
			if os.Getenv(k) == "" {
				os.Setenv(k, strings.Trim(strings.TrimSpace(v), `"'`))
			}
		}
	}
}

func New() *Server {
	s := &Server{
		apis: catalog(), sess: map[string]string{}, rr: map[string]int{}, ips: map[string]*ipState{},
		regs: map[string]int{}, codes: map[string]bool{}, admin: strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_USER"))),
	}
	if b, err := os.ReadFile("data.json"); err == nil {
		json.Unmarshal(b, &s.data)
	}
	if s.Users == nil {
		s.Users = map[string]*User{}
	}
	if s.Pool == nil {
		s.Pool = map[string][]*Key{}
	}
	if s.Hits == nil {
		s.Hits = map[string]int{}
	}
	if s.Today == nil {
		s.Today = map[string]int{}
	}
	if s.News == nil {
		s.News = []string{}
	}
	for _, c := range strings.Split(os.Getenv("VIP_CODES"), ",") {
		if c = strings.ToUpper(strings.TrimSpace(c)); c != "" {
			s.codes[c] = true
		}
	}
	for _, a := range s.apis {
		for _, v := range strings.Split(os.Getenv("KEYS_"+strings.ToUpper(a.ID)), ",") {
			if v = strings.TrimSpace(v); v != "" && !s.has(a.ID, v) {
				s.Pool[a.ID] = append(s.Pool[a.ID], &Key{Value: v, On: true})
			}
		}
		s.clean(a.ID)
		if len(s.Pool[a.ID]) == 0 {
			s.Pool[a.ID] = []*Key{{Value: "REPLACE_ME_" + strings.ToUpper(a.ID), On: true, Demo: true}}
		}
	}
	return s
}

func (s *Server) has(id, v string) bool {
	for _, k := range s.Pool[id] {
		if k.Value == v {
			return true
		}
	}
	return false
}

// buang key placeholder kalau sudah ada key asli
func (s *Server) clean(id string) {
	var keep []*Key
	for _, k := range s.Pool[id] {
		if !k.Demo {
			keep = append(keep, k)
		}
	}
	if len(keep) > 0 {
		s.Pool[id] = keep
	}
}

func (s *Server) save() {
	b, err := json.Marshal(s.data)
	if err != nil {
		return
	}
	if os.WriteFile("data.json.tmp", b, 0o600) == nil {
		os.Rename("data.json.tmp", "data.json")
	}
}

func js(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) { js(w, code, map[string]string{"error": msg}) }

func body(r *http.Request, v any) bool {
	return json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(v) == nil
}

func rnd(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func hashPw(salt, pw string) string {
	h := sha256.Sum256([]byte(salt + pw))
	for i := 0; i < 50000; i++ {
		h = sha256.Sum256(append(h[:], salt...))
	}
	return hex.EncodeToString(h[:])
}

func validName(n string) bool {
	if len(n) < 3 || len(n) > 20 {
		return false
	}
	for _, c := range n {
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '_') {
			return false
		}
	}
	return true
}

func clientIP(r *http.Request) string {
	if os.Getenv("TRUST_PROXY") == "1" {
		if f := r.Header.Get("X-Forwarded-For"); f != "" {
			return strings.TrimSpace(strings.Split(f, ",")[0])
		}
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func lim(u *User) int {
	if u.VIP {
		return 50
	}
	return 5
}

func mask(v string) string {
	if len(v) <= 8 {
		return "••••"
	}
	return v[:4] + "••••" + v[len(v)-4:]
}

func (s *Server) find(id string) *API {
	for _, a := range s.apis {
		if a.ID == id {
			return a
		}
	}
	return nil
}

func (s *Server) me(r *http.Request) *User {
	return s.Users[s.sess[strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")]]
}

// reset kuota harian + key yang sudah diambil saat ganti hari (WIB)
func (s *Server) roll(u *User) {
	if t := day(0); u.Day != t {
		u.Day, u.Used, u.Got = t, 0, map[string]string{}
	}
	if u.Got == nil {
		u.Got = map[string]string{}
	}
}

func (s *Server) streak(u *User) {
	t := day(0)
	if u.Last == t {
		return
	}
	if u.Last == day(-1) {
		u.Streak++
	} else {
		u.Streak = 1
	}
	u.Last = t
	if u.Streak%7 == 0 {
		u.Passes++
	}
}

func (s *Server) profile(u *User) map[string]any {
	s.roll(u)
	return map[string]any{"name": u.Name, "vip": u.VIP, "admin": u.Admin, "streak": u.Streak,
		"passes": u.Passes, "used": u.Used, "limit": lim(u), "total": u.Total, "got": u.Got}
}

func (s *Server) alive(id string) int {
	n := 0
	for _, k := range s.Pool[id] {
		if k.On && !k.Dead {
			n++
		}
	}
	return n
}

// key pool: round robin, key asli diutamakan, key mati dilewati
func (s *Server) pick(id string) *Key {
	var live []*Key
	for _, k := range s.Pool[id] {
		if k.On && !k.Dead && !k.Demo {
			live = append(live, k)
		}
	}
	if len(live) == 0 {
		for _, k := range s.Pool[id] {
			if k.On && k.Demo {
				live = append(live, k)
			}
		}
	}
	if len(live) == 0 {
		return nil
	}
	s.rr[id]++
	return live[s.rr[id]%len(live)]
}

func (s *Server) hit(id string) {
	if t := day(0); s.TDay != t {
		s.TDay, s.Today = t, map[string]int{}
	}
	s.Today[id]++
	s.Hits[id]++
	s.Hours[time.Now().In(wib).Hour()]++
}

func (s *Server) push(t string) {
	s.News = append(s.News, t)
	if len(s.News) > 20 {
		s.News = s.News[len(s.News)-20:]
	}
}

func (s *Server) Routes(m *http.ServeMux) {
	m.HandleFunc("/api/register", s.register)
	m.HandleFunc("/api/login", s.login)
	m.HandleFunc("/api/play", s.play)
	m.HandleFunc("/api/state", s.auth(false, s.state))
	m.HandleFunc("/api/claim", s.auth(false, s.claim))
	m.HandleFunc("/api/mystery", s.auth(false, s.mystery))
	m.HandleFunc("/api/redeem", s.auth(false, s.redeem))
	m.HandleFunc("/api/admin/overview", s.auth(true, s.overview))
	m.HandleFunc("/api/admin/key", s.auth(true, s.adminKey))
	m.HandleFunc("/api/admin/broadcast", s.auth(true, s.broadcast))
}

func (s *Server) auth(admin bool, f func(http.ResponseWriter, *http.Request, *User)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		u := s.me(r)
		if u == nil {
			fail(w, 401, "Sesi habis, silakan masuk lagi")
			return
		}
		if admin && !u.Admin {
			fail(w, 403, "Khusus admin")
			return
		}
		f(w, r, u)
	}
}

// anti abuse: >120 request/menit per IP = blokir 10 menit
func (s *Server) Guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			ip, now := clientIP(r), time.Now()
			s.mu.Lock()
			st := s.ips[ip]
			if st == nil {
				st = &ipState{start: now}
				s.ips[ip] = st
			}
			blocked := now.Before(st.until)
			if !blocked {
				if now.Sub(st.start) > time.Minute {
					st.n, st.start = 0, now
				}
				st.n++
				if st.n > 120 {
					st.until, blocked = now.Add(10*time.Minute), true
				}
			}
			s.mu.Unlock()
			if blocked {
				fail(w, 429, "Terlalu banyak request, IP kamu diblokir sementara")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) issue(w http.ResponseWriter, u *User) {
	if u.Name == s.admin {
		u.Admin = true
	}
	s.streak(u)
	t := rnd(24)
	s.sess[t] = u.Name
	s.save()
	js(w, 200, map[string]any{"token": t, "me": s.profile(u)})
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var in struct{ Name, Pass string }
	if r.Method != "POST" || !body(r, &in) {
		fail(w, 400, "Request tidak valid")
		return
	}
	n := strings.ToLower(strings.TrimSpace(in.Name))
	if !validName(n) || len(in.Pass) < 6 || len(in.Pass) > 100 {
		fail(w, 400, "Username 3-20 karakter (huruf kecil, angka, _) dan password minimal 6 karakter")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	k := clientIP(r) + day(0)
	if s.regs[k] >= 5 {
		fail(w, 429, "Batas pembuatan akun per IP hari ini sudah tercapai")
		return
	}
	if s.Users[n] != nil {
		fail(w, 409, "Username sudah dipakai")
		return
	}
	salt := rnd(8)
	u := &User{Name: n, Salt: salt, Hash: hashPw(salt, in.Pass), Got: map[string]string{}}
	s.Users[n] = u
	s.regs[k]++
	s.issue(w, u)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct{ Name, Pass string }
	if r.Method != "POST" || !body(r, &in) {
		fail(w, 400, "Request tidak valid")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	u := s.Users[strings.ToLower(strings.TrimSpace(in.Name))]
	if u == nil || subtle.ConstantTimeCompare([]byte(u.Hash), []byte(hashPw(u.Salt, in.Pass))) != 1 {
		fail(w, 401, "Username atau password salah")
		return
	}
	s.issue(w, u)
}

func (s *Server) state(w http.ResponseWriter, r *http.Request, u *User) {
	out := make([]API, 0, len(s.apis))
	for _, a := range s.apis {
		c := *a
		c.Keys = s.alive(a.ID)
		c.Hits = s.Hits[a.ID]
		if s.TDay == day(0) {
			c.Today = s.Today[a.ID]
		}
		if a.Tot > 0 {
			c.Uptime = float64(a.OK) * 100 / float64(a.Tot)
		}
		out = append(out, c)
	}
	js(w, 200, map[string]any{"me": s.profile(u), "apis": out, "news": s.News})
}

// Buka Vault: key baru keluar dari server saat di-claim
func (s *Server) claim(w http.ResponseWriter, r *http.Request, u *User) {
	var in struct{ API string }
	var a *API
	if body(r, &in) {
		a = s.find(in.API)
	}
	if a == nil {
		fail(w, 404, "API tidak ditemukan")
		return
	}
	s.roll(u)
	if _, ok := u.Got[a.ID]; ok {
		js(w, 200, map[string]any{"me": s.profile(u)})
		return
	}
	vip := a.Badge == "VIP ONLY"
	if vip && !u.VIP && u.Passes < 1 {
		fail(w, 403, "Khusus VIP. Redeem kode invite atau selesaikan streak 7 hari")
		return
	}
	free := a.Auth == "none"
	if !free && u.Used >= lim(u) {
		fail(w, 429, "Kuota harian habis. Daily Drop berikutnya jam 00:00 WIB")
		return
	}
	val := a.Probe
	if !free {
		k := s.pick(a.ID)
		if k == nil {
			fail(w, 503, "Stok key kosong, tunggu restock")
			return
		}
		val = k.Value
		u.Used++
	}
	if vip && !u.VIP {
		u.Passes--
	}
	u.Got[a.ID] = val
	u.Total++
	s.hit(a.ID)
	s.save()
	js(w, 200, map[string]any{"me": s.profile(u)})
}

func (s *Server) mystery(w http.ResponseWriter, r *http.Request, u *User) {
	s.roll(u)
	if _, ok := u.Got["mystery"]; ok {
		fail(w, 409, "Mystery Key hari ini sudah kamu ambil")
		return
	}
	var pool []*API
	for _, a := range s.apis {
		if a.Auth != "none" && a.Badge != "VIP ONLY" && s.alive(a.ID) > 0 {
			pool = append(pool, a)
		}
	}
	if len(pool) == 0 {
		fail(w, 503, "Belum ada stok")
		return
	}
	h := sha256.Sum256([]byte(day(0) + u.Name))
	a := pool[int(h[0])%len(pool)]
	k := s.pick(a.ID)
	if k == nil {
		fail(w, 503, "Belum ada stok")
		return
	}
	u.Got["mystery"] = k.Value
	u.Total++
	s.hit(a.ID)
	s.save()
	js(w, 200, map[string]any{"me": s.profile(u)})
}

func (s *Server) redeem(w http.ResponseWriter, r *http.Request, u *User) {
	var in struct{ Code string }
	if !body(r, &in) || !s.codes[strings.ToUpper(strings.TrimSpace(in.Code))] {
		fail(w, 400, "Kode invite tidak valid")
		return
	}
	u.VIP = true
	s.save()
	js(w, 200, map[string]any{"me": s.profile(u)})
}

// Playground: request ke URL katalog saja (bukan URL bebas), key dari user
func (s *Server) play(w http.ResponseWriter, r *http.Request) {
	var in struct{ API, Key string }
	ok := body(r, &in)
	s.mu.Lock()
	u, a := s.me(r), s.find(in.API)
	s.mu.Unlock()
	if u == nil {
		fail(w, 401, "Sesi habis, silakan masuk lagi")
		return
	}
	if !ok || a == nil {
		fail(w, 400, "API tidak valid")
		return
	}
	ping, code, out, err := call(a, strings.TrimSpace(in.Key))
	if err != nil {
		fail(w, 502, "Gagal menghubungi API: "+err.Error())
		return
	}
	js(w, 200, map[string]any{"status": code, "ping": ping, "body": out})
}

func (s *Server) overview(w http.ResponseWriter, r *http.Request, u *User) {
	type row struct {
		ID    string `json:"id"`
		Count int    `json:"count"`
	}
	top, claims := []row{}, 0
	for id, n := range s.Hits {
		top = append(top, row{id, n})
		claims += n
	}
	sort.Slice(top, func(i, j int) bool { return top[i].Count > top[j].Count })
	if len(top) > 5 {
		top = top[:5]
	}
	keys := map[string][]map[string]any{}
	for id, ks := range s.Pool {
		for i, k := range ks {
			keys[id] = append(keys[id], map[string]any{"i": i, "mask": mask(k.Value), "on": k.On, "dead": k.Dead, "demo": k.Demo})
		}
	}
	js(w, 200, map[string]any{"users": len(s.Users), "claims": claims, "top": top, "hours": s.Hours, "keys": keys})
}

func (s *Server) adminKey(w http.ResponseWriter, r *http.Request, u *User) {
	var in struct {
		API, Value, Action string
		Index              int
	}
	var a *API
	if body(r, &in) {
		a = s.find(in.API)
	}
	if a == nil {
		fail(w, 400, "API tidak valid")
		return
	}
	ks := s.Pool[a.ID]
	switch in.Action {
	case "add":
		v := strings.TrimSpace(in.Value)
		if v == "" {
			fail(w, 400, "Key tidak boleh kosong")
			return
		}
		s.Pool[a.ID] = append(ks, &Key{Value: v, On: true})
		s.clean(a.ID)
		a.Fresh = time.Now().Unix()
		s.push("Key " + a.Name + " baru restock!")
	case "toggle", "del":
		if in.Index < 0 || in.Index >= len(ks) {
			fail(w, 400, "Index key salah")
			return
		}
		if in.Action == "toggle" {
			ks[in.Index].On = !ks[in.Index].On
		} else {
			s.Pool[a.ID] = append(ks[:in.Index:in.Index], ks[in.Index+1:]...)
		}
	default:
		fail(w, 400, "Aksi tidak dikenal")
		return
	}
	s.save()
	s.overview(w, r, u)
}

func (s *Server) broadcast(w http.ResponseWriter, r *http.Request, u *User) {
	var in struct{ Text string }
	t := ""
	if body(r, &in) {
		t = strings.TrimSpace(in.Text)
	}
	if t == "" || len(t) > 200 {
		fail(w, 400, "Pengumuman 1-200 karakter")
		return
	}
	s.push(t)
	s.save()
	js(w, 200, map[string]any{"news": s.News})
}

func call(a *API, key string) (ping, code int, out string, err error) {
	req, err := http.NewRequest("GET", strings.ReplaceAll(a.Probe, "{key}", url.QueryEscape(key)), nil)
	if err != nil {
		return
	}
	req.Header.Set("User-Agent", "LuxyneVault/1.0")
	switch a.Auth {
	case "bearer":
		req.Header.Set("Authorization", "Bearer "+key)
	case "raw":
		req.Header.Set("Authorization", key)
	}
	t := time.Now()
	resp, err := client.Do(req)
	ping = int(time.Since(t).Milliseconds())
	if err != nil {
		return
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 16384))
	return ping, resp.StatusCode, string(b), nil
}

func grade(ping, code int, err error) string {
	if err != nil || code >= 500 {
		return "down"
	}
	if ping > 1200 {
		return "slow"
	}
	return "online"
}

// health check: ping tiap API, key yang ditolak (401/403) ditandai mati
func (s *Server) check() {
	var wg sync.WaitGroup
	for _, a := range s.apis {
		wg.Add(1)
		go func(a *API) {
			defer wg.Done()
			s.mu.Lock()
			var real []*Key
			for _, k := range s.Pool[a.ID] {
				if !k.Demo {
					real = append(real, k)
				}
			}
			vals := make([]string, len(real))
			for i, k := range real {
				vals[i] = k.Value
			}
			s.mu.Unlock()

			var ping, code int
			var err error
			dead := make([]bool, len(vals))
			if a.Auth == "none" || len(vals) == 0 {
				ping, code, _, err = call(a, "")
			} else {
				for i, v := range vals {
					p, c, _, e := call(a, v)
					if i == 0 {
						ping, code, err = p, c, e
					}
					dead[i] = e == nil && (c == 401 || c == 403)
				}
			}

			s.mu.Lock()
			a.Ping, a.Status = ping, grade(ping, code, err)
			a.Tot++
			if a.Status != "down" {
				a.OK++
			}
			if a.Auth != "none" {
				for i, k := range real {
					k.Dead = dead[i]
				}
			}
			s.mu.Unlock()
		}(a)
	}
	wg.Wait()
}

func (s *Server) HealthLoop() {
	for {
		s.check()
		s.mu.Lock()
		for ip, st := range s.ips {
			if time.Since(st.start) > time.Hour && time.Now().After(st.until) {
				delete(s.ips, ip)
			}
		}
		s.mu.Unlock()
		time.Sleep(5 * time.Minute)
	}
}
