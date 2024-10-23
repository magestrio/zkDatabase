import * as redis from "redis";

export class RedisQueueService<T> {
  private redisClient: redis.RedisClientType;
  constructor(private readonly queueName: string) {
    this.redisClient = redis.createClient();
    this.redisClient.on("error", (err) =>
      console.log("Redis Client Error:", err)
    );
    this.redisClient.connect();
  }
  async enqueue(data: T): Promise<void> {
    await this.redisClient.rPush(this.queueName, JSON.stringify(data));
  }

  async dequeue(): Promise<T | null> {
    const message = await this.redisClient.blPop(this.queueName, 0);
    return message ? JSON.parse(JSON.parse(message?.element || "{}")) : null;
  }
}
