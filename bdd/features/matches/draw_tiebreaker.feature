@e2e @regression @skip
Feature: Draw tie-breaker flow
  # Source: docs/bddbooks-discovery.pdf - Draw tiebreaker mapping
  Scenario: Draw with constrained queue requires tie-breaker winner
    Given I have draw scenario that requires tie-breaker
    When I pick tie-breaker winner
    Then next match should respect chosen winner
