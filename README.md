rsyncCopyManager
================

rsyncCopyManager is a web application written in nodejs which allows you to manage download from multiple flaky ssh servers via rsync.
Each user can add her own directories from her personal server arsenal.
The filelist of these servers will then be cached on a regular basis and downloads to the central server kann be kicked off.
rsyncCopyManager will then download the selected files from these servers no matter how often they go down.
Furthermore it merges the filelists of all servers without giving away any ownership information.
