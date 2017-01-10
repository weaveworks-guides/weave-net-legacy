---
title: Top Level Page
menu_order: 1
---

<!--
This is content for the guides homepage.
It should be manually pasted in to the correct cells of
https://www.weave.works/wp-admin/admin.php?page=dd_layouts_edit&action=edit&layout_id=2129
-->

<h2>Getting Started Guides</h2>
<hr>

<!-- NEXT CELL -->

<h3>Test Drive Weave</h3>
<p>These "Test Drive" scenarios run entirely in your browser, but allow you to remotely control real servers dedicated to you for the duration of the test drive. You don't have to download anything. Learn about Weave by trying a scenario!</p>

<img src="cloud/images/katas.png" />

<p>**Note:** These these examples use Kubernetes, but Weave Cloud and most of the Weave open source projects work with other container orchestrators too. See the tags on the left to see guides for DC/OS, ECS, Docker Swarm and more.</p>

<!--
<section id="course-pathway" class="weave color-bar-layout">
  <section class="x row">
    <div class="panels col s12 center">
        <div class="panel weave  col s3">
          <div class="content">
            <h4>Troubleshooting Dashboard</h4>
            <p>Verify and troubleshoot your app after deploying it</p>
          </div>
            <a class="action start" href="https://www.weave.works/guides/test-drive-weave-scope-kubernetes/" title="Test Drive Weave Scope On Kubernetes" target="_parent">Start Scenario</a>
        </div>
        <div class="panel weave  col s3">
          <div class="content">
            <h4>Continuous Delivery</h4>
            <p class="">Connect the output of your CI system into your container orchestrator to automate or gate deploys</p>
          </div>
            <a class="action start" href="https://www.weave.works/guides/test-drive-weave-net/" title="Test Drive Weave Net" target="_parent">Start Scenario</a>
        </div>
        <div class="panel weave  col s3">
          <div class="content">
            <h4>Prometheus Monitoring</h4>
            <p>Collect metrics that matter to you from your application, network, and orchestrator</p>
          </div>
            <a class="action start" href="https://www.weave.works/guides/test-drive-weave-scope/" title="Test Drive Weave Scope" target="_parent">Start Scenario</a>
        </div>
        <div class="panel weave  col s3">
          <div class="content">
            <h4>Container Networks &amp; Firewalls</h4>
            <p>Define network policy to secure your app</p>
          </div>
            <a class="action start" href="https://www.weave.works/guides/test-drive-weave-demo/" title="Test Drive Weave Demo" target="_parent">Start Scenario</a>
        </div>
    </div>
  </section>
</section>

<div id="katacoda-terminal" data-katacoda-id="weave/dashboard" data-katacoda-color="32324B" data-katacoda-secondary="#4ec6fa" data-katacoda-background="#fff" data-katacoda-hideprogress="true" style="height:450px"></div>
-->


<!-- NEXT CELL -->

<hr>

<h3>Getting Started with Weave</h3>
These guides show you how to get started with all the Weave tools on your own infrastructure, from Docker on your laptop to a production cluster that we'll show you how to set up.

<img src="cloud/images/all-diagrams.png" style="width:100%; border:1em solid #32324b;" />

We'll cover getting started with Weave Cloud and show how to use it together with our open source projects: Scope for troubleshooting, Flux for deployment, Cortex for monitoring and Net for container networks & firewalls.

<h4><a href="/site/cloud/part-1-setup-troubleshooting.md">Part 1 &ndash; Setup: Troubleshooting Dashboard</a></h4>
<p>How to set up, verify and troubleshoot your app with Weave Cloud and Weave Scope in development and production. This example uses Docker Compose in development and Kubernetes with Weave Net for production.</p>

<h4><a href="/site/cloud/part-2-deploy-continuous-delivery.md">Part 2 &ndash; Deploy: Continuous Delivery</a></h4>
<p>How to achieve fast iteration and Continuous Delivery with Weave Cloud and Weave Flux, which connects the output of your CI system into your container orchestrator. This example uses Kubernetes.</p>

<h4><a href="/site/cloud/part-3-monitor-prometheus-monitoring.md">Part 3 &ndash; Monitor: Prometheus Monitoring</a></h4>
<p>How to configure Cloud Native Monitoring with Weave Cloud and Weave Cortex, and view your app's metrics in the Weave Cloud monitoring dashboard. This example uses Kubernetes.</p>

<h4><a href="/site/cloud/part-4-secure-container-firewalls.md">Part 4 &ndash; Secure: Container Firewalls</a></h4>
<p>How to secure your app by defining Kubernetes Network Policy and having it enforced by Weave Net. Also, how to monitor your Weave Net network in Weave Cloud with Weave Cortex.</p>

[P1](/site/cloud/part-1-setup-Troubleshooting.md)
