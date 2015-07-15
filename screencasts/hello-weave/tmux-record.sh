#!/bin/sh
echo -n -e "\033]0;Containers. Containers. Containers. Made Simple!\007"

s=hello-weave-screencast

tmux -2 new-session -d -s $s -x 160 -y 90

tmux set -t $s status off

tmux set -t $s pane-border-fg black
tmux set -t $s pane-active-border-fg black
tmux set -t $s pane-active-border-bg default

tmux split-window -v

tmux select-pane -t 0
tmux send-keys 'clear; ./record.sh weave-01; exit' C-m

tmux select-pane -t 1
tmux send-keys 'clear; ./record.sh weave-02; exit' C-m

tmux select-pane -t 0

tmux -2 attach-session -t $s
