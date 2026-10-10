export class ConcurrencyLimiter {
  private activeCount = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number,
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new RangeError('maxConcurrent must be a positive integer.');
    }
    if (!Number.isInteger(maxQueued) || maxQueued < 0) {
      throw new RangeError('maxQueued must be a non-negative integer.');
    }
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.activeCount += 1;
        void Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            this.activeCount -= 1;
            this.drain();
          });
      };

      if (this.activeCount < this.maxConcurrent) {
        start();
        return;
      }

      if (this.queue.length >= this.maxQueued) {
        reject(new Error('The video classification queue is full.'));
        return;
      }

      this.queue.push(start);
    });
  }

  private drain() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      this.queue.shift()?.();
    }
  }
}
