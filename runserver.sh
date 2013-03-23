#!/usr/bin/env bash
MYDIR=`dirname $0`
node $MYDIR/app.js >> $MYDIR/access.log
