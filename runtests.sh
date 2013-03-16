#!/usr/bin/env bash
jscoverage --exclude=views,public,vendor lib instrumented && vows -v --cover-html instrumented/test/*
