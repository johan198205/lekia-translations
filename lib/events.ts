import { EventEmitter } from 'events'

// Singleton EventEmitter for batch progress events
class BatchProgressEmitter extends EventEmitter {
  private static instance: BatchProgressEmitter

  static getInstance(): BatchProgressEmitter {
    if (!BatchProgressEmitter.instance) {
      BatchProgressEmitter.instance = new BatchProgressEmitter()
    }
    return BatchProgressEmitter.instance
  }

  emitProgress(batchId: string, data: { 
    done: number; 
    total: number; 
    percent: number;
    selectedIndices?: number[];
    productId?: string;
  }) {
    this.emit(`progress:${batchId}`, data)
  }
}

export const batchProgressEmitter = BatchProgressEmitter.getInstance()
