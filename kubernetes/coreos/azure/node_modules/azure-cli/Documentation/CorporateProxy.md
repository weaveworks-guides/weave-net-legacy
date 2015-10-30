# Supporting Corporate Proxy
## Issue
For now due to the authentication schematics of Azure Service, the cross-platform CLI needs to pass an authentication payload through the HTTPS request, which will be denied at authentication time at your corporate proxy.
Original customer complaint is here: https://github.com/Azure/azure-xplat-cli/issues/1163. 

So by executing
`azure login`
you will receive a TIMEOUT message. By checking the HTTP traffic in [Wireshark](http://www.wireshark.org/), you can find a 403 forbidden - this is expected.

## Solution
For now we don't have a universal solution towards this problem. We may consider adding proxy configuration into `azure config` in the future.

For now, a good solution is to set up a public proxy of your own and connect to that before using Azure service. Your HTTPS request will have no problem going through your own public proxy and being authenticated.

## Others
Interestingly, there was a similar issue reported in `npm` project. You can find many solutions from the community here: https://github.com/npm/npm/issues/2866. For more questions, please feel free to contact us.