@e2e @regression
Feature: Global player stats tab
  # Source: docs/bddbooks-discovery.pdf - Global statistics mapping
  Scenario: Open global stats tab
    Given I open Arjen application
    And I am authenticated in app
    When I open global stats tab
    Then I should see player stats table
