@e2e @regression @skip
Feature: Export and import data
  # Source: docs/bddbooks-discovery.pdf - Backup and restore mapping
  Scenario: Export then import round data
    Given I have players, teams, and matches in current round
    When I export data and import same file
    Then app should restore equivalent state with schema version 3
