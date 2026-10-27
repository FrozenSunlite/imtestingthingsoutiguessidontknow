@echo off
title Terrific Talent Tree
rem Windows launcher: Serve.ps1 runs a hidden local server and opens Edge in
rem app mode. No Node.js install needed.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Serve.ps1"
