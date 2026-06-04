// Pure body-shape discriminator for /api/analyze v0.4 dispatcher.
// Lives outside the route file so it stays importable from vitest without
// dragging next-auth + KV side effects into the test bundle.

export function isV3Shape(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false;
  const inputs = (json as Record<string, unknown>).inputs;
  if (!inputs || typeof inputs !== 'object') return false;
  const i = inputs as Record<string, unknown>;
  // v3 has no jdText; v2 always has jdText. Treat absence of jdText as v3.
  return typeof i.jdText !== 'string';
}
