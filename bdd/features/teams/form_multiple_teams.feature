@e2e @regression @skip
Feature: Form multiple teams
  # Source: docs/bddbooks-discovery.pdf - Batch team creation mapping
  Scenario Outline: Build N teams from queue
    Given I have <players> players in queue
    When I request <teams> teams with size <teamSize>
    Then app should create <teams> teams in field

    Examples:
      | players | teams | teamSize |
      | 10      | 2     | 5        |
      | 18      | 3     | 6        |
