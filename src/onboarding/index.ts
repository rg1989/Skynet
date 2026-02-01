/**
 * Onboarding utilities - detection and management of first-run setup
 */

import { getMemoryStore } from '../skills/memory.js';

/**
 * List of fact keys used during onboarding
 */
export const ONBOARDING_FACT_KEYS = [
  'skynet_setup_complete',
  'user_name',
  'assistant_name',
  'personality_tone',
  'personality_style',
  'special_rules',
];

/**
 * Check if the onboarding process has been completed
 */
export function isOnboardingComplete(): boolean {
  const store = getMemoryStore();
  if (!store) return false;
  
  const fact = store.getFact('skynet_setup_complete');
  return fact?.value === 'true';
}

/**
 * Get all onboarding-related facts for personalization
 */
export function getOnboardingFacts(): Record<string, string> {
  const store = getMemoryStore();
  if (!store) return {};
  
  const facts: Record<string, string> = {};
  
  for (const key of ONBOARDING_FACT_KEYS) {
    const fact = store.getFact(key);
    if (fact) {
      facts[key] = fact.value;
    }
  }
  
  return facts;
}

/**
 * Reset all onboarding data to trigger fresh setup
 * Returns true if successful, false if memory store not available
 */
export function resetOnboarding(): boolean {
  const store = getMemoryStore();
  if (!store) return false;
  
  for (const key of ONBOARDING_FACT_KEYS) {
    store.deleteFact(key);
  }
  
  return true;
}

/**
 * Build personalization prefix from onboarding facts
 * This is prepended to the system prompt
 */
export function buildPersonalizationPrefix(): string {
  const facts = getOnboardingFacts();
  
  const parts: string[] = [];
  
  if (facts.assistant_name) {
    parts.push(`Your name is ${facts.assistant_name}.`);
  }
  
  if (facts.user_name) {
    parts.push(`The user's name is ${facts.user_name}.`);
  }
  
  if (facts.personality_tone) {
    parts.push(`Communication style: ${facts.personality_tone}.`);
  }
  
  if (facts.personality_style) {
    parts.push(`Behavior: ${facts.personality_style}.`);
  }
  
  if (facts.special_rules) {
    parts.push(`Special rules: ${facts.special_rules}.`);
  }
  
  if (parts.length === 0) {
    return '';
  }
  
  return parts.join(' ') + '\n\n';
}
