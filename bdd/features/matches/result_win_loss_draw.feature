@e2e @regression @skip
Feature: Scheduled match result handling
  # Source: docs/bddbooks-discovery.pdf - Win/loss/draw outcomes mapping
  Scenario Outline: Finalize match with result
    Given I have a scheduled match
    When I finalize scheduled match with "<result>"
    Then teams and queue should follow "<result>" post-match rules

    Examples:
      | result |
      | A_win  |
      | B_win  |
      | draw   |
