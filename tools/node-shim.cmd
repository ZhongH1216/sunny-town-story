@echo off
setlocal EnableExtensions DisableDelayedExpansion

if defined npm_node_execpath goto npm_node

set "SUNNY_SHIM_NODE=%~dp0..\node.exe"
if exist "%SUNNY_SHIM_NODE%" goto local_node

node.exe %*
exit /b %ERRORLEVEL%

:npm_node
"%npm_node_execpath%" %*
exit /b %ERRORLEVEL%

:local_node
"%SUNNY_SHIM_NODE%" %*
exit /b %ERRORLEVEL%
