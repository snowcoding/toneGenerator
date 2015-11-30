#!/bin/bash
TIMEOUT="90"
DISPLAY=
HOST=${1:-"localhost:1988"}
ROOM=${2:-"?host=localhost:1979&connect=1"}
COND=${3:-"Channel open"} # talky
SERVERPATH=${4:-'..'}
INDEXSERVER=${5:-'indexServer.js'}
SIGNALSERVER=${6:-'signalServer.js'}
#COND="data channel open" # talky pro
#COND="ICE connection state changed to: connected" # apprtc
#COND="onCallActive" # go
#COND="Data channel opened" # meet

NODE=node
LOGPATH=`pwd`

# make sure we kill any Xvfb instances
function cleanup() {
  function xvfb_pids() {
    ps x -o "%r %p %c" | grep X[v]fb | grep $$ | awk '{print $2}'
  }
  exec 3>&2
  exec 2>/dev/null
  while [ ! -z "$(xvfb_pids)" ]; do
    kill $(xvfb_pids)
  done
  kill -HUP -P $pidindex
  kill -HUP -P $pidsignal
  pkill -HUP -P $pidwatch
  pkill -HUP -P $pidwatch2
  exec 2>&3
  exec 3>&-
}
trap cleanup EXIT

# this timeout is for the overall test process
( sleep ${TIMEOUT} ) &
pidwatcher=$!

cd ${SERVERPATH}

INDEXSERVER_LOG=index.log
${NODE} ${INDEXSERVER} > ${LOGPATH}/${INDEXSERVER_LOG} 2>&1 &
pidindex=$!

SIGNALSERVER_LOG=signal.log
${NODE} ${SIGNALSERVER} > ${LOGPATH}/${SIGNALSERVER_LOG} 2>&1 &
pidsignal=$!

cd -

# browser #1
ERRCONSOLE_1="browser1.log"
rm ${ERRCONSOLE_1}
#( ./test-browser.sh google-chrome $HOST "${ROOM}" "${COND}" >> log1.log 2>&1 ; kill $pidwatcher 2> /dev/null ) 2>/dev/null &
( ./test-browser.sh firefox $HOST "${ROOM}" "${COND}" ${ERRCONSOLE_1} >> ${ERRCONSOLE_1} 2>&1 ; kill $pidwatcher 2> /dev/null ) 2>/dev/null &
pidwatch=$!

# browser #2
ERRCONSOLE_2="browser2.log"
rm ${ERRCONSOLE_2}
#( ./test-browser.sh chromium-browser $HOST "${ROOM}" "${COND}" >> log2.log 2>&1 ; kill $pidwatcher 2> /dev/null ) 2>/dev/null &
( ./test-browser.sh firefox $HOST "${ROOM}" "${COND}" ${ERRCONSOLE_2} >> ${ERRCONSOLE_2} 2>&1 ; kill $pidwatcher 2> /dev/null ) 2>/dev/null &
pidwatch2=$!

echo "${pidwatcher} watching ${pidindex} ${pidsignal} ${pidwatch} ${pidwatch2}"

if wait $pidwatcher 2>/dev/null; then
  echo "--- timedout"
  cat ${ERRCONSOLE_1}
  cat ${ERRCONSOLE_2}
fi
# do nothing in the case of success
