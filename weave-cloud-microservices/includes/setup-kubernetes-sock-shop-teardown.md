Unless you are continuing onto another guide, or going to use the cluster for your own app, you may want to tear down the Sock Shop and also the Kubernetes cluster you created.

If you made an error during the install instructions, it is recommended that you delete the entire cluster and begin again.

* To uninstall the socks shop, run `kubectl delete namespace sock-shop` on the master.

* To uninstall Kubernetes on the machines, simply delete the machines you created for this tutorial, or run the script below and then start over or uninstall the packages.

* To uninstall a daemon set run `kubectl delete ds <agent-name>`.

* To reset to the local state:

~~~
kubeadm reset
~~~

## Recreating the Cluster: Starting Over

If you wish to start over, run `systemctl start kubelet` on each of the nodes, followed by `kubeadm init` on the master and `kubeadm join` on any of the nodes.
