rsyncCopyManager
================

rsyncCopyManager is a web application written in nodejs which allows you to manage download from multiple flaky ssh servers via rsync.
Each user can add her own directories from her personal server arsenal.
The filelist of these servers will then be cached on a regular basis and downloads to the central server kann be kicked off.
rsyncCopyManager will then download the selected files from these servers no matter how often they go down.
Furthermore it merges the filelists of all servers without giving away any ownership information to unauthorized users.


Install requirements
====================

* mysql
* node.js
* npm


Installation
============
1. Clone/download this git repo
2. execute in the extracted folder `npm install` (Node.js Package Manager)
3. copy the `config.js.sample` to `config.js`
4. edit `config.js` to suit your needs (configure http, https or both)
5. start with `./runserver.sh`

SSH Keys
====
The keys are standard ssh keys generated with `ssh-keygen -f <file>`.

First Login
===========
The username and password for the admin user can be specified in the `config.js` file as `defaultUser`.

