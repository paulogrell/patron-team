@e2e @regression @slow @skip
Feature: Multi-tab sync
  # Source: docs/bddbooks-discovery.pdf - BroadcastChannel sync mapping
  Scenario: Player added in first tab appears in second tab
    Given I have app open in two tabs
    When I add player in first tab
    Then second tab should refresh queue automatically
