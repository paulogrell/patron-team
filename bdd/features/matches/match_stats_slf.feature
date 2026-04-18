@e2e @regression @skip
Feature: Match stats SLF rules
  # Source: docs/bddbooks-discovery.pdf - Per-match stats validation mapping
  Scenario: Register goals and assists in match stats modal
    Given I have a scheduled or finalized match
    When I edit player stats in match modal
    Then goals and assists should follow SLF validations
