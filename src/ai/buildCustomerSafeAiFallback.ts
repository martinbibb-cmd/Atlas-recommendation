export interface CustomerSafeAiFallback {
  headline: string;
  supportingText: string;
}

const CUSTOMER_SAFE_AI_FALLBACK: CustomerSafeAiFallback = {
  headline: 'AI-enhanced summary temporarily unavailable.',
  supportingText: 'Your recommendation and supporting evidence remain available.',
};

export function buildCustomerSafeAiFallback(): CustomerSafeAiFallback {
  return CUSTOMER_SAFE_AI_FALLBACK;
}
