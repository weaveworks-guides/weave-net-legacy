var j = require('./jsrsasign');

var o1 = j.asn1.ASN1Util.newObject({int: {int: 1234567}});
console.log(o1.getEncodedHex());

