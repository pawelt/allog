# Allog

Allog is a lightweight tool for organizing notes with attachments. 

Please note that Allog is in early stages of development "feature-wise", but it is stable enough to be used on a daily basis.

Allog is similar to Evernote and Microsoft Onenote, but doesn't use any database to store data. Instead, all data is stored in the file system, in regular text files and folders. This allows to treat notes as annotated and searchable projects, but also picture collections, music collections etc. 

Another benefit is that all notes are easily accessible with any file manager, without using Allog. Data synchronization is done by your favorite cloud storage provider (Dropbox etc.).

(longer description is coming...)

Works on Windows, OSX and Ubuntu, with 0.10.x version of Nodejs.

## Dependencies

- nodejs
- couple node modules:
  - express
  - jare
  - wrench
  - nodemon (optional, dev env only)

## Install

1. Clone the repo.
2. Move `allog-data` directory, for example to your Dropbox folder.
3. Copy `example-user-config.js` as `user-config.js`
4. Copy `example-allog.bat` (or `example-allog.sh`, depending on your OS) as `allog.bat` (or `allog.sh`)
5. Edit allog.bat so that `NODE_HOME` and `ALLOG_PATH` paths are correct
6. Run `npm install`

## Running

Simply run `allog.bat` you created during installation process.

Allog is a simple Nodejs application with web GUI. By default, it runs on port 1607.

You can start the server and client separately:

1. Run `node app/app.js`
2. In the browser, open: http://127.0.0.1:1607

