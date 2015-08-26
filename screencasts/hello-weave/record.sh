#!/bin/sh
asciinema rec \
  -c "gcloud compute ssh --project weave-testing-1 --zone europe-west1-c $1" \
  -y "rec-$1.json"
