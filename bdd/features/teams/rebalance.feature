@e2e @regression @skip
Feature: Rebalance in-field teams
  # Source: docs/bddbooks-discovery.pdf - Rebalance behaviour mapping
  Scenario: Rebalance redistributes only in-field unlocked teams
    Given I have multiple unlocked teams in field
    When I rebalance teams
    Then players should be redistributed round-robin across unlocked in-field teams
