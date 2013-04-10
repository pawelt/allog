#!/bin/bash

######################################################

#
# Nodejs executable directory
#
export NODE_HOME=/home/pawel/Desktop/node/bin

#
# Allog directory
#
export ALLOG_PATH=/home/pawel/Desktop/allog-export/allog-data

#
# Browser to launch (firefox works too)
#
export BROWSER=chromium-browser

#
# Allog server port
#
export ALLOG_PORT=1607


######################################################

NODE_PATH=$NODE_HOME/node_modules
PATH=$NODE_HOME:./node_modules/.bin:$PATH

$BROWSER   http://127.0.0.1:$ALLOG_PORT &
node       app/app.js
