// Simple in-memory queue system for development
// TODO: Replace with Redis + BullMQ in production

export interface QueueJob {
  id: string
  data: any
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  maxAttempts: number
}

class InMemoryQueue {
  private jobs: Map<string, QueueJob> = new Map()
  private processing: Set<string> = new Set()

  async add(name: string, data: any): Promise<string> {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const job: QueueJob = {
      id,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3
    }
    
    this.jobs.set(id, job)
    console.log(`[QUEUE] Added job ${id} to ${name} queue`)
    return id
  }

  async process(name: string, processor: (job: QueueJob) => Promise<void>): Promise<void> {
    const pendingJobs = Array.from(this.jobs.values()).filter(
      job => job.status === 'pending' && !this.processing.has(job.id)
    )

    for (const job of pendingJobs) {
      this.processing.add(job.id)
      job.status = 'processing'
      job.attempts++

      try {
        await processor(job)
        job.status = 'completed'
        console.log(`[QUEUE] Job ${job.id} completed successfully`)
      } catch (error) {
        console.error(`[QUEUE] Job ${job.id} failed:`, error)
        if (job.attempts < job.maxAttempts) {
          job.status = 'pending'
        } else {
          job.status = 'failed'
        }
      } finally {
        this.processing.delete(job.id)
      }
    }
  }

  async getJob(id: string): Promise<QueueJob | null> {
    return this.jobs.get(id) || null
  }

  async getJobs(status?: string): Promise<QueueJob[]> {
    if (status) {
      return Array.from(this.jobs.values()).filter(job => job.status === status)
    }
    return Array.from(this.jobs.values())
  }
}

// Create queues
export const optimizeQueue = new InMemoryQueue()
export const translateQueue = new InMemoryQueue()
export const exportQueue = new InMemoryQueue()

// Queue names
export const QUEUE_NAMES = {
  OPTIMIZE: 'optimize',
  TRANSLATE: 'translate',
  EXPORT: 'export'
} as const

// Job options
export const JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: 100,
  removeOnFail: 50
} as const

// Mock Redis client for compatibility
export const redis = {
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  get: () => Promise.resolve(null),
  set: () => Promise.resolve('OK')
} as any

export const scheduler = {
  close: () => Promise.resolve()
} as any
