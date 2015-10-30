# ssh-key-to-pem

convert an ssh key to PEM format.

## Usage

read a ssh key and convert it to PEM format.


    var fs = require('fs');
    var sshKeyToPEM = require('ssh-key-to-pem');

    var sshKey = fs.readFileSync('./id_rsa.pub', 'ascii')
    var key = sshKeyToPEM(sshKey);

    console.log(key)

Alternatively, convert a PEM format public key into an `ssh-rsa` key

    var fs = require('fs');
    var pemToRsaSSHKey = require('ssh-key-to-pem').pemToRsaSSHKey;

    var key = fs.readFileSync('./pub_key.pem', 'ascii')
    var sshKey = pemToRsaSSHKey(key);

    console.log(sshKey)

## Installation

    npm install ssh-key-to-pem

## License

MIT.

