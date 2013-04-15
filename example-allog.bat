@echo off

REM
REM Copy this file as allog.bat
REM and make sure that paths 1, 2 and 3 below are correct.
REM
REM Notice forward slashes and quotes around paths.
REM 


REM 
REM Path 1: nodejs executable directory
REM
set NODE_HOME="D:/pawel/Dropbox/Programs/NodeJS"


REM
REM Path 2: Allog directory
REM
set ALLOG_PATH="D:/Pawel/Desktop/allog-export/allog-data"


REM
REM Path 3: browser (leave blank for default to use system default browser)
REM
set BROWSER=chrome

REM
REM Allog server port
REM
set ALLOG_PORT=1607


set NODE_PATH=%NODE_HOME%\node_modules;
set PATH=%NODE_HOME%;.\node_modules\.bin;%PATH%

start                     %BROWSER%   http://127.0.0.1:%ALLOG_PORT%
start   "allog - server"  node        app/app.js


