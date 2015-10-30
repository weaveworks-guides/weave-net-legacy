[node-openssl-wrapper](http://mgcrea.github.com/node-openssl-wrapper) [![Build Status](https://secure.travis-ci.org/mgcrea/node-openssl-wrapper.png?branch=master)](http://travis-ci.org/#!/mgcrea/node-openssl-wrapper)
=================

Buffer-ready OpenSSL CLI wrapper for Node.js

Quick start
-----------

Generate an RSA key
``` javascript
var openssl = require('openssl-wrapper');
var password = 'github';

return openssl.exec('genrsa', {des3: true, passout: 'pass:' + password, '2048': false}, function(err, buffer) {
	console.log(buffer.toString());
});
```

Verify a CMS/SMIME signature & decrypt the CMS/SMIME enveloped data using promises
``` javascript
var Q = require('q');
var openssl = require('openssl-wrapper');

Q.fcall(function extractEnvelopedData() {
	return openssl.qExec('cms.verify', signedData, {inform: 'DER', noverify: true});
})
.then(function decryptEnvelopedData() {
	return openssl.qExec('cms.decrypt', envelopedData, {inform: 'DER', recip: __dirname + '/myCertificate.crt', inkey: __dirname + '/myCertificate.key'})
})
.then(function debugOutput(data) {
	console.log(data);
})

```

Testing
-------

node-plist-native is tested with `nodeunit`.

>
	npm install --dev
	npm test

Contributing
------------

Please submit all pull requests the against master branch. If your unit test contains javascript patches or features, you should include relevant unit tests. Thanks!

Authors
-------

**Olivier Louvignes**

+ http://olouv.com
+ http://github.com/mgcrea

Copyright and license
---------------------

	The MIT License

	Copyright (c) 2013 Olivier Louvignes

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in
	all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	THE SOFTWARE.
