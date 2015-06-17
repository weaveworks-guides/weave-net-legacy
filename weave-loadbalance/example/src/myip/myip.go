package main

import (
	"fmt"
	"github.com/gorilla/mux"
	"log"
	"net"
	"net/http"
)

func main() {

	router := mux.NewRouter().StrictSlash(true)
	router.HandleFunc("/", HelloWeave)
	router.HandleFunc("/myip", myIp)

	log.Fatal(http.ListenAndServe(":80", router))
}

func HelloWeave(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "Welcome!")
}

func myIp(w http.ResponseWriter, r *http.Request) {
	addrs, _ := net.InterfaceAddrs()
	var thisIp string
	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			thisIp = ipnet.IP.String()
		}
	}
	// just pring the last ip, its a demo
	fmt.Fprintln(w, thisIp)
}
