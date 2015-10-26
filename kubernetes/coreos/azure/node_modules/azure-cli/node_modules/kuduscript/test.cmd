@echo off

setlocal enabledelayedexpansion

set kuduscript_dir=%~dp0
pushd %temp%

rd /s /q kuduscript_test 2>nul
mkdir kuduscript_test
cd kuduscript_test

git clone https://github.com/amitapl/azure-sdk-tools-xplat.git
IF !ERRORLEVEL! NEQ 0 goto error

cd azure-sdk-tools-xplat

git checkout dev
IF !ERRORLEVEL! NEQ 0 goto error

call npm install
IF !ERRORLEVEL! NEQ 0 goto error

call npm install %kuduscript_dir%
IF !ERRORLEVEL! NEQ 0 goto error

call node_modules\.bin\mocha.cmd -u tdd -R spec test\commands\cli.site-deploymentscript-tests.js
IF !ERRORLEVEL! NEQ 0 goto error

goto success

:error
popd
echo Failed
call :exitSetErrorLevel
call :exitFromFunction 2>nul

:exitSetErrorLevel
exit /b 1

:exitFromFunction
()


:success
popd
echo Success
