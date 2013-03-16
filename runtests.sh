#!/usr/bin/env bash
rm -fr /lib/test/testDir2/* 2>/dev/null
rm -fr instrumented/* 2>/dev/null
rm coverage.html 2>/dev/null
jscover lib instrumented && vows --cover-html --spec instrumented/test/*.js
