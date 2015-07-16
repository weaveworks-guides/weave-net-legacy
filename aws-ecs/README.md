
# Weaving together Amazon EC2 Container Service #

## What you will build ##

Weave allows you to focus on developing your application, rather than your infrastructure.

In this example you will be ...


## What you will use ##

* [Weave](http://weave.works)
* [Docker](http://docker.com)
* [Amazon ECS](http://aws.amazon.com/ecs/)

## What you will need to complete this guide ##

This getting started guide is self contained. You will use Weave, Docker, Ubuntu and Amazon ECS. We make use of the
[Amazon Web Services (AWS) CLI tool](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) to manage and access AWS.
You will need to have a valid [Amazon Web Services](http://aws.amazon.com) account, and the AWS CLI setup and configured before working
through this getting started guide. Amazon provide an extensive guide on how to setup the [AWS CLI](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-set-up.html).

* 15 minutes
* [Git](http://git-scm.com/downloads)
* [AWS CLI >= 1.7.35 ](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)

## Preamble ##

All of the code for this example is available on github, and you first clone the
guides repository.

```bash
git clone http://github.com/weaveworks/guides
```


## Automatic setup ##

TODO

### What has happened? ###

TODO

## Manual Install on AWS ##

Make sure to configure the AWS CLI with default zone where ECS is available
(`us-east-1`, `us-west-2`, `eu-west-1`, `ap-northeast-1` or `ap-southeast-2` at
the time of writing this)

```bash
aws configure
```

### Create ECS Cluster ###

```bash
aws ecs create-cluster --cluster-name weave-ecs-demo-cluster
```

### Create Security Group and Key Pair ###

Create security group `weave-ecs-demo`

```bash
aws ec2 create-security-group --group-name weave-ecs-demo --description "Weave ECS Demo"
```

The command will generate an output like the following
```json
{
    "GroupId": "sg-903004f8"
}
```

Please take note of the `GroupId` (`sg-903004f8` in the example above) since we
will need it later, when creating the launch configuration.


Add inbound rules to the group in order to allow:

* Public SSH access.
* Public HTTP access.
* Private Weave access between instances.

```bash
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol tcp --port 6783 --source-group weave-ecs-demo
aws ec2 authorize-security-group-ingress --group-name weave-ecs-demo --protocol udp --port 6783 --source-group weave-ecs-demo
```

Next you create a key pair which allows us to access any EC2 instances which are associated with this security group.

```bash
aws ec2 create-key-pair --key-name weave-ecs-demo-key --query 'KeyMaterial' --output text > weave-ecs-demo-key.pem
```

### IAM Role ###

Create a IAM role for the Weave ECS instances 

```bash
aws iam create-role --role-name weave-ecs-role --assume-role-policy-document file://weave-ecs-role.json
aws iam put-role-policy --role-name weave-ecs-role --policy-name weave-ecs-policy --policy-document file://weave-ecs-policy.json
aws iam create-instance-profile --instance-profile-name weave-ecs-instance-profile
aws iam add-role-to-instance-profile --instance-profile-name weave-ecs-instance-profile --role-name weave-ecs-role
```

## Create Launch Configuration ##

Choose an Weave ECS AMI depending on your availability zone:

* `us-east-1` -> `ami-c3ce18a8`
* `us-west-2` -> TODO
* `eu-west-1` -> TODO
* `ap-northeast-1` -> TODO
* `ap-southeast-2` -> TODO


and execute the command below replacing `XXXX` with the AMI of the availability zone and `YYYY` with the security group Id from step 

```bash
AMI=XXXX SECURITY_GROUP=YYYY aws autoscaling create-launch-configuration --image-id ${AMI} --launch-configuration-name weave-ecs-launch-configuration --key-name weave-ecs-demo-key --security-groups ${SECURITY_GROUP} --instance-type t2.micro --user-data file://set-ecs-cluster-name.sh  --iam-instance-profile weave-ecs-instance-profile --associate-public-ip-address --instance-monitoring Enabled=false  --block-device-mappings "$(cat block-device-mappings.json)"
```

## Create Auto Scaling Group ##

You are going an Auto Scaling Group with 3 instances.

Pick one of the VPC Subnet identifiers in your region (e.g. `subnet-d47826a3`).

You can print the subnets by typing

```bash
aws ec2 describe-subnets
```

Execute the command below replacing `XXXX` with the chosen subnet identifier.

```bash
SUBNET=XXXX aws autoscaling create-auto-scaling-group --auto-scaling-group-name weave-ecs-demo-group --launch-configuration-name weave-ecs-launch-configuration --min-size 3 --max-size 3 --desired-capacity 3 --vpc-zone-identifier ${SUBNET}
```

### Register Task Definition ###

```bash
aws ecs register-task-definition --family weave-ecs-demo-task --container-definitions "$(cat weave-ecs-demo-containers.json)"
```


### Launch Task ###

Before launching the demo task, confirm that the 3 instances from the Auto
Scaling Group have joined the cluster. This should should happen shortly after
creating the Auto Scaling Group.

To confirm it, run the following command. The output will show
`"registeredContainerInstancesCount": 3` once all the instances are part of the cluster.

```bash
aws ecs describe-clusters --clusters weave-ecs-demo-cluster
```

Now, launch the demo task. You will be launching 3 task instances, one per EC2
instance in the Auto Scaling Group.

```bash
aws ecs run-task --cluster weave-ecs-demo-cluster --task-definition weave-ecs-demo-task --count 3
```

## Summary ##

TODO

## Known issues/limitations ##

* Autoscaling Groups are required (individual instances cannot be created due to how Weave finds peers).
* Due to how ECS mangles container names at launch, Weave's service discovery is
  only supported in container names with alphanumeric characters
  (e.g. `httpserver` would be OK but `http-server` woudn't due to the hyphen)


## For the advanced user: Build your own Weave ECS AMI ##


Clone the guides repository if you haven't done so yet and go to the `packer`
directory.

```bash
git clone http://github.com/weaveworks/guides
cd guides/aws-ecs/packer
```

First, build special versions `ecs-init` and `weave`. You will need to have
Docker installed for this to work.

```bash
./build-ecs-init-weave.sh
```

Next, download a SFTP-enabled version of [Packer](https://www.packer.io/) to build
the AMI.

```bash
wget https://dl.bintray.com/2opremio/generic/packer-sftp_0.8.1_linux_amd64.zip
unzip packer-sftp_0.8.1_linux_amd64.zip -d ~/bin
```

Finally, invoke `./build-all-amis.sh` to build `Weave ECS` images for all
regions. This step installs (in the image) the version of ecs-init we just
built, awscli, jq, weave, init scripts for weave and updates the ECS agent to
use Weave proxy.

You can customize the image by modifying `template.json` to match your
requirements.

```bash
AWS_ACCSS_KEY_ID=XXXX AWS_SECRET_ACCESS_KEY=YYYY  ./build-all-amis.sh
```

This can be a lengthy process, so if you want to build an image just
for a specific region set the environment variable `ONLY_REGION` to the specific
region you want to build the image for. For instance `ONLY_REGION=us-east-1`
