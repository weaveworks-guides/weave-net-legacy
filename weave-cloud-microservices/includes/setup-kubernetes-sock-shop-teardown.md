Unless you are continuing onto another guide, or you are using the cluster for your own app, you may want to tear down the Sock Shop and the Kubernetes cluster you created.

* To uninstall the socks shop, run `kubectl delete namespace sock-shop` on the master.

* To uninstall Kubernetes on the machines, you can delete the machines you created for this tutorial, and then start over

* To uninstall a daemon set run `kubectl delete ds <agent-name>`.

## Recreating the Cluster: Starting Over

**Note:** If you made an error during the install instructions, it is recommended that you delete the entire cluster and begin again.


**1.** Reset the cluster to the local state:

~~~
kubeadm reset
~~~

**2.** Run `systemctl start kubelet` on each of the nodes.  

**3.** Re-initialize the master by `kubeadm init` on the master.

**4.** Then join the nodes to the master with:

~~~
kubeadm join --token <token> <master-ip>
~~~
