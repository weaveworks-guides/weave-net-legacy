# Some notes on using AWS #

We make use of the [Amazon Web Services (AWS) CLI
tool](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html)
to manage and access AWS.  You will need to have a valid [Amazon Web
Services](http://aws.amazon.com) account, and the AWS CLI setup and
configured before working through this getting started guide. Amazon
provide an extensive guide on how to setup the [AWS
CLI](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-set-up.html).

To get the correct spelling of your Amazon region, check [the
list](http://docs.aws.amazon.com/general/latest/gr/rande.html#ec2_region).

If you aren't already using the AWS CLI, you will want to [create a
user](http://docs.aws.amazon.com/IAM/latest/UserGuide/Using_WorkingWithGroupsAndUsers.html)
to run it.

Then, you have to give permissions to the AWS user - this is done by
[creating a
group](http://docs.aws.amazon.com/IAM/latest/UserGuide/Using_CreatingAndListingGroups.html),
then assigning the user to that group, then assigning a Permission
Policy to the group. AWS provide [pre-defined
policies](http://docs.aws.amazon.com/IAM/latest/UserGuide/policies_managed-vs-inline.html)
such as `PowerUserAccess` that will work for these guides.
