/**
 * Creates a new VNetUtil object.
 *
 * @constructor
 */
var azureCommon = require('azure-common');
var xml = azureCommon.xml2js;
var builder = require('xmlbuilder');
var Constants = azureCommon.Constants;

var jsonTransformer = require('./../commands/asm/network/jsontransform/jsontransformer');
var networkManagementMeta = require('./../commands/asm/network/jsontransform/networkmanagementmeta.json');

function VNetUtil() {
  this.defaultCidrRange = {
    start: 0,
    end: 32
  };

  this.ipv4Pattern = new RegExp(/^([01]?\d\d?|2[0-4]\d|25[0-5])\.([01]?\d\d?|2[0-4]\d|25[0-5])\.([01]?\d\d?|2[0-4]\d|25[0-5])\.([01]?\d\d?|2[0-4]\d|25[0-5])$/);
  this.dnsPattern = new RegExp(/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/);
  this.privateAddressSpacesInfo = {
    '10.0.0.0/8': {},
    '172.16.0.0/12': {},
    '192.168.0.0/16': {}
  };

  for (var key in this.privateAddressSpacesInfo) {
    var addressSpaceInfo = this.privateAddressSpacesInfo[key];
    var parsedIpv4Cidr = this.parseIPv4Cidr(key);

    addressSpaceInfo.ipv4Cidr = parsedIpv4Cidr.ipv4Cidr;
    addressSpaceInfo.ipv4Octects = parsedIpv4Cidr.octects;
    addressSpaceInfo.startCidr = parsedIpv4Cidr.cidr;
    addressSpaceInfo.endCidr = this.defaultCidrRange.end;

    var networkMaskOctects = this.getNetworkMaskFromCIDR(addressSpaceInfo.startCidr).octects;
    var addressSpaceRange = this.getIPRange(addressSpaceInfo.ipv4Octects, networkMaskOctects);
    addressSpaceInfo.ipv4StartOctects = addressSpaceRange.start;
    addressSpaceInfo.ipv4EndOctects = addressSpaceRange.end;
    addressSpaceInfo.ipv4Start = this.octectsToString(addressSpaceInfo.ipv4StartOctects);
    addressSpaceInfo.ipv4End = this.octectsToString(addressSpaceInfo.ipv4EndOctects);
  }
}

VNetUtil.prototype.setError = function(error) {
  return {
    error: error
  };
};

VNetUtil.prototype.formatName = function(name) {
  var fname = '';
  if (name) {
    fname = '(' + name + ') ';
  }

  return fname;
};

/**
 * Given ip in octects format get the corresponding string format
 *
 * @return string
 */
VNetUtil.prototype.octectsToString = function(octects) {
  return octects.octect0 + '.' + octects.octect1 + '.' +
    octects.octect2 + '.' + octects.octect3;
};

/**
 * Gets the default address space.
 *
 * @return object
 */
VNetUtil.prototype.defaultAddressSpaceInfo = function() {
  return this.privateAddressSpacesInfo['10.0.0.0/8'];
};

/**
 * Given an address space returns the corresponding private address space.
 *
 * @param object addressSpaceOctects The addressspace as octects
 *
 * @return object
 */
VNetUtil.prototype.getPrivateAddressSpaceInfo = function(addressSpaceOctects) {
  var privateAddressSpaceInfo = null;
  for (var key in this.privateAddressSpacesInfo) {
    var addressSpaceInfo = this.privateAddressSpacesInfo[key];
    if (this.isIPInRange(
        addressSpaceInfo.ipv4StartOctects,
        addressSpaceInfo.ipv4EndOctects,
        addressSpaceOctects)) {
      privateAddressSpaceInfo = addressSpaceInfo;
      break;
    }
  }

  return privateAddressSpaceInfo;
};

/**
 * Parse the given ipv4 address and return it in octet format
 *
 * @param string address The IPv4 address
 * @param string name    A name to be included in the error message
 *
 * @return object
 */
VNetUtil.prototype.parseIPv4 = function(address, name) {
  var octects = {
    octect0: null,
    octect1: null,
    octect2: null,
    octect3: null
  };

  var patternMatch = address.match(this.ipv4Pattern);
  if (!patternMatch) {
    var fname = this.formatName(name);
    return this.setError('The IP address ' + fname + address + ' is invalid. ');
  }

  for (var i = 0; i < 4; i++) {
    octects['octect' + i] = parseInt(patternMatch[i + 1], 10);
  }

  return {
    error: null,
    octects: octects
  };
};

/**
 * Parse the given ipv4 address in cidr form and return
 * cidr and ipv4 in octet format
 *
 * @param string address The IPv4 address in cidr format (---.---.---.---/cidr)
 * @param string name    A name to be included in the error message
 *
 * @return object
 */
VNetUtil.prototype.parseIPv4Cidr = function(addressSpace, name) {
  var cidr = null;
  var fname = this.formatName(name);

  var invalidIpErr = 'The address space ' + fname + addressSpace + ' is invalid. ';
  var parts = addressSpace.split('/');
  if (parts.length > 2) {
    return this.setError(invalidIpErr);
  }

  if (parts.length == 2) {
    cidr = parseInt(parts[1], 10);
    var cidrResult = this.verfiyCIDR(cidr);
    if (cidrResult.error) {
      return this.setError(invalidIpErr + cidrResult.error);
    }
  }

  var parsedIpResult = this.parseIPv4(parts[0], name);
  if (parsedIpResult.error) {
    return this.setError(parsedIpResult.error);
  }

  return {
    error: null,
    cidr: cidr,
    octects: parsedIpResult.octects,
    ipv4Cidr: addressSpace
  };
};

/**
 * Checks the given cidr is correct
 *
 * @param int    value Possible cidr to validate
 * @param string name  Optional, a name to be included in the error message
 * @param object range Optional, range for cidr
 *
 * @return object
 */
VNetUtil.prototype.verfiyCIDR = function(value, range, name) {
  var fname = this.formatName(name);

  if (!range) {
    range = {
      start: this.defaultCidrRange.start,
      end: this.defaultCidrRange.end
    };
  }

  if (isNaN(value) || value < range.start || value > range.end) {
    return this.setError('cidr ' + fname + 'should be a number in the range [' + range.start + ', ' + range.end + '] ');
  }

  return {
    error: null
  };
};

/**
 * Given cidr calculate number of hosts
 *
 * @param int cidr The cidr value
 *
 * @return object
 */
VNetUtil.prototype.getHostsCountForCIDR = function(cidr) {
  var cidrResult = this.verfiyCIDR(cidr);
  if (cidrResult.error) {
    return this.setError(cidrResult.error);
  }

  return {
    error: null,
    hostsCount: Math.pow(2, (32 - cidr))
  };
};

/**
 * Given number of hosts calculate the appropriate cidr.
 *
 * @param int hostsCount Number of hosts
 *
 * @return object
 */
VNetUtil.prototype.getCIDRFromHostsCount = function(hostsCount) {
  var _log2 = function(number) {
    return Math.log(number) / Math.log(2);
  };

  var cidr = 32 - Math.ceil(_log2(hostsCount));
  if (cidr > this.defaultCidrRange.end) {
    cidr = this.defaultCidrRange.end;
  }

  return cidr;
};

/**
 * Calculate the default subnet cidr for the given address space cidr
 *
 * @param int addressSpaceCidr The address space cidr
 *
 * @return object
 */
VNetUtil.prototype.getDefaultSubnetCIDRFromAddressSpaceCIDR = function(addressSpaceCidr) {
  if (addressSpaceCidr >= 27) {
    return this.defaultCidrRange.end;
  }

  return addressSpaceCidr + 3;
};

/**
 * Checks the given ip address is in range
 *
 * @param object lower  The lower bound IP
 * @param object upper  The upper bound IP
 * @param object target The ip to check
 *
 * @return boolean
 */
VNetUtil.prototype.isIPInRange = function(lower, upper, target) {
  return (target.octect0 >= lower.octect0 && target.octect0 <= upper.octect0 &&
    target.octect1 >= lower.octect1 && target.octect1 <= upper.octect1 &&
    target.octect2 >= lower.octect2 && target.octect2 <= upper.octect2 &&
    target.octect3 >= lower.octect3 && target.octect3 <= upper.octect3);
};

/**
 * Given CIDR calculate the network mask
 *
 * @param int cidr The cidr
 *
 * @return object
 */
VNetUtil.prototype.getNetworkMaskFromCIDR = function(cidr) {
  var cidrResult = this.verfiyCIDR(cidr);
  if (cidrResult.error) {
    return this.setError(cidrResult.error);
  }

  var octects = {
    'octect0': 0xff,
    'octect1': 0xff,
    'octect2': 0xff,
    'octect3': 0xff
  };

  var i = Math.floor(cidr / 8);
  octects['octect' + i] = (0xff << (8 - cidr % 8)) & 0xff;

  for (var j = i + 1; j < 4; j++) {
    octects['octect' + j] = 0;
  }

  return {
    error: cidrResult.error,
    octects: octects
  };
};

/**
 * Given address space and cidr calculate the range
 *
 * @param object addressSpace The start ip of address space
 * @param object mask         The network mask
 *
 * @return object
 */
VNetUtil.prototype.getIPRange = function(addressSpace, mask) {
  return {
    'start': {
      'octect0': addressSpace.octect0 & mask.octect0,
      'octect1': addressSpace.octect1 & mask.octect1,
      'octect2': addressSpace.octect2 & mask.octect2,
      'octect3': addressSpace.octect3 & mask.octect3
    },
    'end': {
      'octect0': addressSpace.octect0 | (~(mask.octect0) & 0xff),
      'octect1': addressSpace.octect1 | (~(mask.octect1) & 0xff),
      'octect2': addressSpace.octect2 | (~(mask.octect2) & 0xff),
      'octect3': addressSpace.octect3 | (~(mask.octect3) & 0xff)
    }
  };
};

/**
 * Gets a new network configuration.
 *
 * @return object
 */
VNetUtil.prototype.getNewNetworkConfigObj = function() {
  return {
    VirtualNetworkConfiguration: {
      VirtualNetworkSites: [],
      Dns: {
        DnsServers: []
      }
    }
  };
};

/**
 * Parse given xml configuration to json object
 *
 * @param string configuration The configuration xml string
 *
 * @return object
 */
VNetUtil.prototype.getNetworkConfigObj = function(configuration) {
  function stripBOM(content) {
    if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
      content = content.slice(1);
    }
    return content;
  }

  function attributeToKeyValue(object) {
    for (var key in object) {
      if (key === Constants.XML_METADATA_MARKER) {
        for (var atrKey in object[key]) {
          if (object[key].hasOwnProperty(atrKey)) {
            var newKey = atrKey[0].toUpperCase() + atrKey.substr(1);
            object[newKey] = object[key][atrKey];
          }
        }

        delete object[key];
      } else if (typeof(object[key]) == 'object') {
        attributeToKeyValue(object[key]);
      }
    }
  }

  var networkConfig = {};
  // xml2js parser options
  var options = {
    'explicitCharkey': false,
    'trim': false,
    'normalize': false,
    'normalizeTags': false,
    'attrkey': '$',
    'charkey': '_',
    'explicitArray': false,
    'ignoreAttrs': false,
    'mergeAttrs': false,
    'explicitRoot': false,
    'validator': null,
    'xmlns': false,
    'explicitChildren': false,
    'childkey': '$$',
    'charsAsChildren': false,
    'async': false,
    'strict': true
  };
  var transformer = new jsonTransformer();

  xml.parseString(stripBOM(configuration), options, function(err, result) {
    transformer.transform(result, networkManagementMeta.getNetworkConfig);
    attributeToKeyValue(result.VirtualNetworkConfiguration);

    networkConfig = result;
  });

  return networkConfig;
};

/**
 * Checks if cidrs ovelaps
 *
 * @param string cidr1 cidr in format _._._._/__
 *
 * @param string cidr2 cidr in format _._._._/__
 *
 * @return boolean
 */
VNetUtil.prototype.isCidrsOverlapping = function(cidr1, cidr2) {
  var parsedCidr1 = this.parseIPv4Cidr(cidr1);
  if (parsedCidr1.error) {
    throw new Error(parsedCidr1.error);
  }

  var parsedCidr2 = this.parseIPv4Cidr(cidr2);
  if (parsedCidr2.error) {
    throw new Error(parsedCidr2.error);
  }

  var maskObj1 = this.getNetworkMaskFromCIDR(parsedCidr1.cidr);
  if (maskObj1.error) {
    throw new Error(maskObj1.error);
  }

  var maskObj2 = this.getNetworkMaskFromCIDR(parsedCidr2.cidr);
  if (maskObj2.error) {
    throw new Error(maskObj2.error);
  }

  var ipRangeObj1 = this.getIPRange(parsedCidr1.octects, maskObj1.octects);
  var ipRangeObj2 = this.getIPRange(parsedCidr2.octects, maskObj2.octects);

  var startIp1 = ipRangeObj1.start;
  var startIp2 = ipRangeObj2.start;
  var endIp1 = ipRangeObj1.end;
  var endIp2 = ipRangeObj2.end;

  var overlap1 = false;
  var overlap2 = false;

  for (var i = 0; i < 4; i++) {
    if (startIp1['octect'+i] < endIp2['octect'+i]) {
      overlap1 = true;
      break;
    } else if (startIp1['octect'+i] > endIp2['octect'+i]) {
      overlap1 = false;
      break;
    }
  }

  for (var j = 0; j < 4; j++) {
    if (endIp1['octect'+j] > startIp2['octect'+j]) {
      overlap2 = true;
      break;
    } else if (endIp1['octect'+j] < startIp2['octect'+j]) {
      overlap2 = false;
      break;
    }
  }

  if (overlap1 && overlap2) {
    return true;
  } else {
    return false;
  }
};

/**
 * Check if given string is valid domain name
 *
 * @param string domain The full DNS address
 *
 * @return object
 */
VNetUtil.prototype.isValidDns = function(domain) {
  return this.dnsPattern.test(domain);
};

/**
 * Parse given json object to xml configuration string
 *
 * @param string configuration The configuration json object
 *
 * @return xml string
 */
VNetUtil.prototype.getNetworkConfigXml = function(configurationObj) {
  var root = builder.create('NetworkConfiguration');
  root.att('xmlns:xsd', 'http://www.w3.org/2001/XMLSchema');
  root.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
  root.att('xmlns', 'http://schemas.microsoft.com/ServiceHosting/2011/07/NetworkConfiguration');

  var eleVNet = root.ele('VirtualNetworkConfiguration');
  var eleDns = eleVNet.ele('Dns');
  var eleDnsServers = eleDns.ele('DnsServers');

  if (configurationObj.VirtualNetworkConfiguration.Dns.DnsServers instanceof Array) {
    for (var i = 0; i < configurationObj.VirtualNetworkConfiguration.Dns.DnsServers.length; i++) {
      var dnsServer = configurationObj.VirtualNetworkConfiguration.Dns.DnsServers[i];
      var eleServer = eleDnsServers.ele('DnsServer');
      eleServer.att('name', dnsServer.Name);
      eleServer.att('IPAddress', dnsServer.IPAddress);
    }
  }

  var eleLocalSites = eleDns.insertAfter('LocalNetworkSites');

  if (configurationObj.VirtualNetworkConfiguration.LocalNetworkSites instanceof Array) {
    for (var l = 0; l < configurationObj.VirtualNetworkConfiguration.LocalNetworkSites.length; l++) {
      var localSite = configurationObj.VirtualNetworkConfiguration.LocalNetworkSites[l];
      var eleLocalSite = eleLocalSites.ele('LocalNetworkSite');
      eleLocalSite.att('name', localSite.Name);
      if (localSite.VPNGatewayAddress) {
        eleLocalSite.ele('VPNGatewayAddress').text(localSite.VPNGatewayAddress);
      }

      // AddressSpace
      var eleAddressSpace = eleLocalSite.ele('AddressSpace');
      for (var m = 0; m < localSite.AddressSpace.length; m++) {
        var elePrefix = eleAddressSpace.ele('AddressPrefix');
        elePrefix.text(localSite.AddressSpace[m]);
      }
    }
  }

  var eleSites = eleLocalSites.insertAfter('VirtualNetworkSites');

  for (var k = 0; k < configurationObj.VirtualNetworkConfiguration.VirtualNetworkSites.length; k++) {
    var site = configurationObj.VirtualNetworkConfiguration.VirtualNetworkSites[k];
    var eleSite = eleSites.ele('VirtualNetworkSite');
    eleSite.att('name', site.Name);
    if (site.AffinityGroup) {
      eleSite.att('AffinityGroup', site.AffinityGroup);
    }
    if (site.Location) {
      eleSite.att('Location', site.Location);
    }

    // AddressSpace
    var eleSiteAddressSpace = eleSite.ele('AddressSpace');
    for (var j = 0; j < site.AddressSpace.length; j++) {
      var eleAdrPrefix = eleSiteAddressSpace.ele('AddressPrefix');
      eleAdrPrefix.text(site.AddressSpace[j]);
    }

    // Subnets
    if (site.Subnets && site.Subnets.length > 0) {
      var eleSubnets = eleSite.ele('Subnets');
      for (var p = 0; p < site.Subnets.length; p++) {
        var subnet = site.Subnets[p];
        var eleSubnet = eleSubnets.ele('Subnet');
        eleSubnet.att('name', subnet.Name);
        var eleSubnetAddrPrefix = eleSubnet.ele('AddressPrefix');
        eleSubnetAddrPrefix.text(subnet.AddressPrefix);
      }
    }

    // DnsServersRef
    if (site.DnsServersRef && site.DnsServersRef.length > 0) {
      var eleDnsServersRef = eleSite.ele('DnsServersRef');
      for (var n = 0; n < site.DnsServersRef.length; n++) {
        var serverRef = site.DnsServersRef[n];
        var eleServerRef = eleDnsServersRef.ele('DnsServerRef');
        eleServerRef.att('name', serverRef.Name);
      }
    }

    // Gateway
    if (site.Gateway) {
      var eleGateway = eleSite.ele('Gateway');
      if (site.Gateway.ConnectionsToLocalNetwork && site.Gateway.ConnectionsToLocalNetwork.length > 0) {
        var eleConnectionsToLocalNetwork = eleGateway.ele('ConnectionsToLocalNetwork');
        for (var a = 0; a < site.Gateway.ConnectionsToLocalNetwork.length; a++) {
          var localNetworkSiteRef = site.Gateway.ConnectionsToLocalNetwork[a];
          var eleLocalNetworkSiteRef = eleConnectionsToLocalNetwork.ele('LocalNetworkSiteRef');
          eleLocalNetworkSiteRef.att('name', localNetworkSiteRef.Name);
          eleLocalNetworkSiteRef.ele('Connection').att('type', localNetworkSiteRef.Connection.Type);
        }
      }
    }

  }

  var xmlString = root.end({
    pretty: true,
    indent: '  ',
    newline: '\n'
  });

  return xmlString;
};

VNetUtil.prototype.ensureRequiredParams = function (param, paramName, dependentParams) {
    var result = {
        error: null,
        emptyParams: null,
        requiredParams: null,
        allEmpty: false
    };

    var arrayToString = function(array, combine) {
        var arrayAsString = null;
        if (array.length == 1) {
            arrayAsString = array[0];
        } else if (array.length > 1) {
            var last = ' ' + combine + ' ' + array.pop();
            arrayAsString = array.join(',');
            arrayAsString += last;
        }

        return arrayAsString;
    };

    var emptyParams = [];
    var requiresParams = [];
    if (typeof param != 'undefined') {
        for (var key in dependentParams) {
            if (typeof dependentParams[key] == 'undefined') {
                emptyParams.push(key);
                requiresParams.push(key);
            } else if (typeof dependentParams[key] == 'object') {
                var emptyParams2 = [];
                var requiresParams2 = [];
                for (var key2 in dependentParams[key]) {
                    requiresParams2.push(key2);
                    if (typeof dependentParams[key][key2] == 'undefined') {
                        emptyParams2.push(key2);
                    }
                }

                if (emptyParams2.length == requiresParams2.length) {
                    emptyParams.push('"' + arrayToString(emptyParams2, 'or') + '"');
                }

                requiresParams.push('"' + arrayToString(requiresParams2, 'or') + '"');
            } else {
                requiresParams.push(key);
            }
        }
    }

    if (emptyParams.length > 0) {
        var singleEmpty = emptyParams.length == 1;
        var singleRequired = requiresParams.length == 1;
        result.allEmpty = (emptyParams.length == requiresParams.length);
        result.emptyParams = arrayToString(emptyParams, 'and');
        result.requiredParams = arrayToString(requiresParams, 'and');

        result.error = 'The parameter(s) ' + result.requiredParams +
        (singleRequired ? ' is' : ' are') +
        ' required when ' + paramName + ' is specified but ' +
        (result.allEmpty ? 'none of them present' :
            ('the parameter(s) ' + result.emptyParams + (singleEmpty ? ' is' : ' are') + ' not present'));
    }

    return result;
};

module.exports = VNetUtil;
