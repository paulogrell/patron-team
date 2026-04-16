@e2e @regression @skip
Feature: Injury, tired, and substitution
  # Source: docs/bddbooks-discovery.pdf - Player status transitions mapping
  Scenario: Mark in-field player injured and replace from queue
    Given I have one in-field player and available bench queue
    When I mark player as injured and request substitute
    Then player status should change and substitute should join team
