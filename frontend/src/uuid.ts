// Safe UUID generator that works in both secure and non-secure contexts
export function generateId(): string {
  // crypto.randomUUID() only works in secure contexts (HTTPS, localhost)
  // In non-secure contexts (HTTP on IP addresses), it throws an error
  try {
    if (typeof crypto?.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch (e) {
    // crypto.randomUUID may not be available in all environments
  }
  
  // Fallback for non-secure contexts or environments without crypto.randomUUID
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
