/**
 * Copyright (c) Microsoft.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var crypto = require('crypto');
var util = require('util');
var path = require('path');
var fs = require('fs');

var utils = require('./utils');
var utilsCore = require('./utilsCore');

// x509 PEM Cert header
var BEGIN_CERT = '-----BEGIN CERTIFICATE-----';
// x509 PEM Cert footer
var END_CERT = '-----END CERTIFICATE-----';
// SSH RSA Public Key header
var SSHDashRSA = 'ssh-rsa';

// input: Open SSH RSA PublicKey
//
// ssh-rsa {body} {info}
//
// output: PEM formatted PKCS#8 RSA Public Key
//
// -----BEGIN PUBLIC KEY-----
//  BASE64 ENCODED PUBLICKEYINFO
// -----END PUBLIC KEY-----
//
// PUBLICKEYINFO ::= SEQUENCE {
//   algorithm ::= SEQUENCE {
//     algorithm 1.2.840.113549.1.1.1
//   }
//   PublicKey ::= SEQUENCE {
//     modulus           INTEGER,  -- n
//     publicExponent    INTEGER   -- e
//   }
// }
//
// 1.2.840.113549.1.1.1 is the OID for RSA
//
exports.openSshRSAPubToPkcs8RsaPubPEM = function (sshRSAPubKey) {
  var sshKeyToPEM = require('ssh-key-to-pem');
  return sshKeyToPEM(sshRSAPubKey);
};

// input: PEM formatted PKCS#8 RSA Public Key
//
// -----BEGIN PUBLIC KEY-----
//  BASE64 ENCODED PUBLICKEYINFO
// -----END PUBLIC KEY-----
//
// PUBLICKEYINFO ::= SEQUENCE {
//   algorithm   ::= SEQUENCE {
//     algorithm 1.2.840.113549.1.1.1
//   }
//   PublicKey    ::= SEQUENCE {
//     modulus           INTEGER,  -- n
//     publicExponent    INTEGER   -- e
//   }
// }
//
// 1.2.840.113549.1.1.1 is the OID for RSA
//
// output: PEM formatted X509 Certificate
//
// -----BEGIN CERTIFICATE-----
// BASE64 ENCODED X509Certificate
// -----END CERTIFICATE-----
//
// X509Certificate ::= SEQUENCE  {
//     tbsCertificate         ::= SEQUENCE {
//       version [0]          v1,
//       serialNumber         1,
//       signature            ::=  SEQUENCE {
//         algorithm          1.2.840.113549.1.1.5
//       },
//       issuer               CN=Root Agency,
//       validity             ::=  SEQUENCE {
//         notBefore          Time,
//         notAfter           Time
//       },
//       subject              '/C=DE/O=dummy-subject/CN=dummy,
//       subjectPublicKeyInfo ::=  SEQUENCE  {
//         algorithm   ::= SEQUENCE {
//           algorithm 1.2.840.113549.1.1.1
//         },
//         subjectPublicKey   ::= SEQUENCE {
//           modulus          INTEGER,  -- n
//           publicExponent   INTEGER   -- e
//         }
//       }
//     },
//     signatureAlgorithm     ::=  SEQUENCE {
//       algorithm            1.2.840.113549.1.1.5
//     },
//     signature            00
// }
//
// 1.2.840.113549.1.1.5 is the OID 'SHA-1 with RSA Encryption'
// 1.2.840.113549.1.1.1 is the OID for RSA
//
// X509Certificate::signature represents the signature for the TBSCertificate
// creating signature requires private key, since we don't have access to
// private key we set X509Certificate::signature to 00.
//
exports.pkcs8RSAPubPEMToX509CertPEM = function (pkc8RSAPub) {
  require('jsrsasign');

  var certValidityRange = exports.getCertValidityRange();
  var x509CertPEM = KJUR.asn1.x509.X509Util.newCertPEM({
    serial: { int: 1 },
    sigalg: { name: 'SHA1withRSA', paramempty: true },
    issuer: { str: 'CN=Root Agency' },
    notbefore: { 'str': certValidityRange.start },
    notafter: { 'str':  certValidityRange.end },
    subject: { str: '/C=DE/O=dummy-subject/CN=dummy' },
    sbjpubkey: pkc8RSAPub,
    sighex: '00'
  });

  var certEnd = x509CertPEM.indexOf(END_CERT);
  // Bug: jsrsasign module seems inserting an extra CRLF, remove it
  if (x509CertPEM[certEnd - 2] === '\r' && x509CertPEM[certEnd - 1] === '\n') {
    if (x509CertPEM[certEnd - 4] === '\r' && x509CertPEM[certEnd - 3] === '\n') {
     x509CertPEM = x509CertPEM.replace(new RegExp('\r\n' + END_CERT + '(\r\n)?' + '$'), END_CERT);
    }
  } else if (x509CertPEM[certEnd - 2] === '\n' && x509CertPEM[certEnd - 1] === '\n') {
    x509CertPEM = x509CertPEM.replace(new RegExp('\n' + END_CERT + '\n?' + '$'), END_CERT);
  }

  return x509CertPEM;
};

exports.openSshRSAPubToX509CertPEM = function (openSShRSAPub) {
  var pkcs8RsaPubKey = exports.openSshRSAPubToPkcs8RsaPubPEM(openSShRSAPub);
  return exports.pkcs8RSAPubPEMToX509CertPEM(pkcs8RsaPubKey);
};

exports.isX509CertPEM = function (data) {
  return (data && data.indexOf(BEGIN_CERT) !== -1 && data.indexOf(END_CERT) !== -1);
};

exports.isOpenSshRSAPub = function (data) {
  if (data) {
    // should be in format 'ssh-rsa {body} {info}'
    var tokens = data.split([' ']);
    return (tokens.length >= 2 && tokens[0] === SSHDashRSA);
  }

  return false;
};

exports.getFingerprintFromX509CertPEM = function (x509CertPEM) {
  var certBase64 = exports.extractBase64X509CertFromPEM(x509CertPEM);
  // Calculate sha1 hash of the cert
  var cert = new Buffer(certBase64, 'base64');
  var sha1 = crypto.createHash('sha1');
  sha1.update(cert);
  return sha1.digest('hex');
};

exports.extractBase64X509CertFromPEM = function (x509CertPEM) {
  // Extract the base64 encoded X509 cert out of PEM file
  var beginCert = x509CertPEM.indexOf(BEGIN_CERT) + BEGIN_CERT.length;
  if (x509CertPEM[beginCert] === '\n') {
    beginCert = beginCert + 1;
  } else if (x509CertPEM[beginCert] === '\r' && x509CertPEM[beginCert + 1] === '\n') {
    beginCert = beginCert + 2;
  }

  var endCert = '\n' + x509CertPEM.indexOf(END_CERT);
  if (endCert === -1) {
    endCert = '\r\n' + x509CertPEM.indexOf(END_CERT);
  }

  return x509CertPEM.substring(beginCert, endCert);
};

exports.generatePemKeyPair = function () {
  var jsrsasign = require('jsrsasign');

  var keys = jsrsasign.KEYUTIL.generateKeypair('RSA', 2048);
  var pub = jsrsasign.KEYUTIL.getPEM(keys.pubKeyObj);
  var pvt = jsrsasign.KEYUTIL.getPEM(keys.prvKeyObj, 'PKCS8PRV');

  return { public: pub, private: pvt };
};

exports.generateX509PemCert = function (publicKey, privateKey, password) {
  var jsrsasign = require('jsrsasign');

  var certValidityRange = exports.getCertValidityRange();
  var certParams = {
    serial: { int: 1 },
    sigalg: { name: 'SHA1withECDSA', paramempty: true },
    issuer: { str: 'CN=Root Agency' },
    notbefore: { 'str': certValidityRange.start },
    notafter: { 'str': certValidityRange.end },
    subject: { str: '/C=US/O=b' },
    sbjpubkey: publicKey
  };

  if(privateKey) {
    certParams.cakey = [ privateKey, password ];
  }

  var certPEM = jsrsasign.asn1.x509.X509Util.newCertPEM(certParams);
  return certPEM;
};

exports.checkSSHKeys = function (azureSshDir, keyPaths, callback) {
  utils.fileExists(azureSshDir, function(error, exists) {
    if (error) {
      return callback(error);
    }

    if (!exists) {
      fs.mkdir(azureSshDir, function(error) {
        if (error) {
          return callback(error);
        }

        return callback(null, false);
      });
    } else {
      utils.fileExists(keyPaths.privateKeyPath, function(error, exists) {
        if (error) {
          return callback(error);
        }

        if (exists) {
          utils.fileExists(keyPaths.certPath, function(error, exists) {
            if (error) {
              return callback(error);
            }

            return callback(null, exists);
          });
        } else {
          return callback(null, false);
        }
      });
    }
  });
};

exports.generateSSHKeysIfNeeded = function (vmName, callback) {
  var azureSshDir = path.join(utilsCore.azureDir(), 'ssh');
  var keyPaths = {
    certPath: path.join(azureSshDir, vmName + '-cert.pem'),
    privateKeyPath: path.join(azureSshDir, vmName + '-key.pem')
  };

  exports.checkSSHKeys(azureSshDir, keyPaths, function(error, exists) {
    if (!exists) {
      exports.generateAndSaveSSHKeys(keyPaths.privateKeyPath, keyPaths.certPath);
    }

    return callback(null, keyPaths);
  });
};

exports.generateAndSaveSSHKeys = function (privateKeyPath, certPath) {
  var keys = exports.generatePemKeyPair();
  var cert = exports.generateX509PemCert(keys.public, keys.private, '');
  fs.writeFileSync(privateKeyPath, keys.private);
  fs.writeFileSync(certPath, cert);
  fs.chmodSync(privateKeyPath, 0600);
};

exports.getCertValidityRange = function () {
  function pad(n) {
    return n < 10 ? '0' + n : n;
  }

  function toUTCString(d) {
    return util.format('%s%s%s%s%s%sZ', d.getUTCFullYear(),
        pad(d.getUTCMonth() + 1),
        pad(d.getUTCDate()),
        pad(d.getUTCHours()),
        pad(d.getUTCMinutes()),
        pad(d.getUTCSeconds()));
  }

  var startDateTime = new Date();
  startDateTime.setMinutes(startDateTime.getMinutes() - 10);
  var endDateTime = new Date(startDateTime);
  endDateTime.setFullYear(endDateTime.getFullYear() + 10);

  return {
    start: toUTCString(startDateTime),
    end: toUTCString(endDateTime)
  };
};