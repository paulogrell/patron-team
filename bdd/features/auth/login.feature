@e2e @smoke
Feature: Login
  # Source: docs/bddbooks-discovery.pdf - Authentication behaviour mapping
  As organizer
  I want authenticate before using app
  So only authorized users access queue controls

  Scenario: Login gate is enforced when credentials configured
    Given I open Arjen application
    Then authentication should be resolved for current environment
