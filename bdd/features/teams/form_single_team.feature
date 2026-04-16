@e2e @smoke
Feature: Form one team
  # Source: docs/bddbooks-discovery.pdf - Team formation behaviour mapping
  Scenario: Form one team from queue
    Given I open Arjen application
    And I am authenticated in app
    And I add these players:
      | name   |
      | Carlos |
      | Ana    |
      | Bruno  |
      | Diana  |
      | Edu    |
    When I set team size to 5
    And I click form one team
    Then teams in field panel should show 1 team
