@e2e @regression @skip
Feature: Active round
  # Source: docs/bddbooks-discovery.pdf - Round management behaviour mapping
  Scenario: Switch active round when legacy import has multiple rounds
    Given I have imported dataset with multiple rounds
    When I switch active round
    Then app should scope teams and matches to selected round
