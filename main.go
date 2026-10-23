package main

import (
	"log"
	"net/http"
	"os"

	"luxyne/handlers"
)

func main() {
	handlers.LoadEnv(".env")
	s := handlers.New()
	go s.HealthLoop()

	mux := http.NewServeMux()
	s.Routes(mux)
	if _, err := os.Stat("../frontend/dist"); err == nil {
		mux.Handle("/", http.FileServer(http.Dir("../frontend/dist")))
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Println("Luxyne Vault berjalan di :" + port)
	log.Fatal(http.ListenAndServe(":"+port, s.Guard(mux)))
}
