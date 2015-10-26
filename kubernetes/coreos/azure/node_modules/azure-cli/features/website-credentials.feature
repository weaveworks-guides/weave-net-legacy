Feature: Website credential

  Scenario: basic import
    Given a one subscription publishsettings file
    When I import the publishsettings file
    Then current subscription is set correctly
    And management endpoint is set correctly
    When I list Websites
    Then the command succeeds