@e2e @regression
Feature: Round statistics tab
  # Source: docs/bddbooks-discovery.pdf - Round statistics mapping
  Scenario: Open round stats tab
    Given I open Arjen application
    And I am authenticated in app
    When I open round stats tab
    Then I should see round statistics panel
