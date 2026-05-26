@echo off
setlocal

if defined npm_node_execpath (
  "%npm_node_execpath%" %*
  exit /b %ERRORLEVEL%
)

set "NODE_EXE=%~dp0..\node.exe"
if exist "%NODE_EXE%" (
  "%NODE_EXE%" %*
  exit /b %ERRORLEVEL%
)

node.exe %*
exit /b %ERRORLEVEL%
