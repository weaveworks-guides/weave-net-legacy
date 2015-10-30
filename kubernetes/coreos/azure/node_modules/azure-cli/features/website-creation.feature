Feature: Website creation

  Scenario: Non Coadmin git creation
    Given a not coadmin subscription publishsettings file
    And a clone of the git repo https://github.com/azuresdkci/azuresdkci-repo
    When I import the publishsettings file
    And I create a new website mytstsite with git integration using location West US
    And I setup the remote git credentials to username azuresdkci and password MyAwesomePassword!1
    Then current subscription is set correctly
    And the website mytstsite should be created in location West US
    And the local git repo should contain a remote called origin
    And the local git repo should contain a remote called azure with username azuresdkci

  Scenario: Coadmin git creation
    Given a coadmin subscription publishsettings file
    And a clone of the git repo https://github.com/azuresdkci/azuresdkci-repo
    When I import the publishsettings file
    And I create a new website myottstsite with git integration using location West US and git user azuresdkci
    Then current subscription is set correctly
    And the website myottstsite should be created in location West US
    And the local git repo should contain a remote called origin
    And the local git repo should contain a remote called azure with username azuresdkci