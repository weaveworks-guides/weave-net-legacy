package main

import (
	"bytes"
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
	var theIps bytes.Buffer

	addrs, _ := net.InterfaceAddrs()

	for _, a := range addrs {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			theIps.WriteString(ipnet.IP.String())
			theIps.WriteString("\n")
		}
	}
	fmt.Fprintln(w, theIps.String())
}
