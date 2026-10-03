import { InpaintError } from './types'

type Pending<T, R> = { id: string; job: T; resolve: (r: R) => void; reject: (e: unknown) => void }

export class JobQueue<T, R> {
  #runningId: string | null = null
  #pending: Pending<T, R> | null = null

  constructor(private run: (job: T) => Promise<R>) {}

  get running(): string | null {
    return this.#runningId
  }

  get pending(): string | null {
    return this.#pending?.id ?? null
  }

  submit(id: string, job: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const entry: Pending<T, R> = { id, job, resolve, reject }
      if (this.#runningId === null) {
        this.#start(entry)
        return
      }
      this.#pending?.reject(new InpaintError('CANCELLED', `job ${this.#pending.id} was replaced by a newer job`))
      this.#pending = entry
    })
  }

  #start(entry: Pending<T, R>): void {
    this.#runningId = entry.id
    const finish = () => {
      this.#runningId = null
      const next = this.#pending
      this.#pending = null
      if (next) this.#start(next)
    }
    Promise.resolve()
      .then(() => this.run(entry.job))
      .then(
        (r) => {
          finish()
          entry.resolve(r)
        },
        (e) => {
          finish()
          entry.reject(e)
        },
      )
  }
}
