// copiado de srtm-ui@a1df33a (src/kit/ui/errorMessage.ts): sube a wasichai-ui en la fase 2 (wasichai-ui#14)
// what a failure says, or the fallback when it says nothing usable (no Error, or a blank message)
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback
}
