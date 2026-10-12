/** Thin Claude client for Amorlay v2 server routes. */

export const MODEL_DEEP = 'claude-sonnet-4-6' // intake, video, coach: quality matters
export const MODEL_FAST = 'claude-haiku-4-5-20251001' // pair evaluation at volume

type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string | Block[]
}

export class AiError extends Error {
  status: number
  constructor(msg: string, status = 503) {
    super(msg)
    this.status = status
  }
}

export async function callClaude(opts: {
  system: string
  messages: ChatMsg[]
  model?: string
  maxTokens?: number
  timeoutMs?: number
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AiError('AI service not configured', 503)
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opts.model || MODEL_DEEP,
      max_tokens: opts.maxTokens || 2000,
      system: opts.system,
      messages: opts.messages,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs || 55000),
  })
  if (!r.ok) throw new AiError('AI service busy (' + r.status + ')', 503)
  const d = await r.json()
  const text = Array.isArray(d?.content) ? d.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('') : ''
  return text
}

/** Pull the first JSON object out of a model reply, tolerating code fences and stray prose. */
export function parseJsonObject<T = any>(text: string): T | null {
  if (!text) return null
  let t = text.trim()
  const fence = String.fromCharCode(96, 96, 96)
  if (t.includes(fence)) {
    const start = t.indexOf(fence)
    let inner = t.slice(start + 3)
    if (inner.toLowerCase().startsWith('json')) inner = inner.slice(4)
    const end = inner.indexOf(fence)
    if (end !== -1) t = inner.slice(0, end).trim()
  }
  const first = t.indexOf('{')
  if (first === -1) return null
  // Walk to the matching closing brace, respecting strings.
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = first; i < t.length; i++) {
    const ch = t[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(t.slice(first, i + 1)) as T
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Call the model and parse its JSON reply. If the reply is not valid JSON, ask once more
 * for the JSON object only. Returns the parsed object (or null) and the last raw reply.
 */
export async function callClaudeJson<T = any>(opts: Parameters<typeof callClaude>[0]): Promise<{ out: T | null; raw: string }> {
  const raw = await callClaude(opts)
  const out = parseJsonObject<T>(raw)
  if (out) return { out, raw }
  const retryMessages: ChatMsg[] = [
    ...opts.messages,
    { role: 'assistant', content: raw || '(no reply)' },
    { role: 'user', content: 'Reply again with only the JSON object described in your instructions, and nothing else.' },
  ]
  const raw2 = await callClaude({ ...opts, messages: retryMessages })
  return { out: parseJsonObject<T>(raw2), raw: raw2 }
}
