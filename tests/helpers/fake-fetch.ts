export type FakeRoute = { status?: number; bytes?: Uint8Array; throws?: boolean; contentLength?: boolean }

export function fakeFetch(routes: Record<string, FakeRoute>) {
  const calls: string[] = []
  const fn = async (url: string): Promise<Response> => {
    calls.push(url)
    const r = routes[url]
    if (!r || r.throws) throw new TypeError('network down')
    const status = r.status ?? 200
    if (status < 200 || status >= 300) return new Response('nope', { status })
    const bytes = r.bytes ?? new Uint8Array()
    const third = Math.ceil(bytes.length / 3)
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += third) c.enqueue(bytes.slice(i, i + third))
        c.close()
      },
    })
    const headers: Record<string, string> = r.contentLength === false ? {} : { 'content-length': String(bytes.length) }
    return new Response(stream, { status, headers })
  }
  return { fetch: fn, calls }
}
