/**
 * Struct-of-arrays pool with swap-remove compaction.
 *
 * Bullets and particles live here rather than in the ECS: they are thousands
 * of identical records touched every step, and typed arrays keep the fixed
 * step allocation-free (spec §4).
 */
export class SoaPool {
  readonly capacity: number
  count = 0

  constructor(capacity: number) {
    this.capacity = capacity
  }

  /** Returns the new slot index, or -1 when the pool is full. */
  alloc(): number {
    if (this.count >= this.capacity) return -1
    return this.count++
  }

  /** Swap-remove: the last live record moves into `i`. */
  free(i: number, move: (from: number, to: number) => void): number {
    const last = --this.count
    if (i !== last) move(last, i)
    return last
  }

  reset(): void {
    this.count = 0
  }
}

/** Free-list pool for entity objects, so spawning never allocates. */
export class ObjectPool<T> {
  private readonly free: T[] = []
  private readonly make: () => T

  constructor(make: () => T, prime: number) {
    this.make = make
    for (let i = 0; i < prime; i++) this.free.push(make())
  }

  get(): T {
    return this.free.pop() ?? this.make()
  }

  put(item: T): void {
    this.free.push(item)
  }

  get available(): number {
    return this.free.length
  }
}
