@e2e @regression @skip
Feature: Locked teams
  # Source: docs/bddbooks-discovery.pdf - Locked team rules mapping
  Scenario: Locked teams are ignored by simple next-match suggestion
    Given I have at least two teams in field and one is locked
    When I ask for next match suggestion
    Then suggested match should not include locked team
