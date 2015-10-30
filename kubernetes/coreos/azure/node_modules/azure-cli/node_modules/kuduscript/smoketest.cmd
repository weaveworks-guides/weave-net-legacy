@echo off

call npm install
call npm install mocha
call npm install should

call node_modules\.bin\mocha.cmd -u tdd -R spec test\smokeTest.js -s 10000 -t 60000
