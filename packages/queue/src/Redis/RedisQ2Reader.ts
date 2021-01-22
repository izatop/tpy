import {ITransactionType, Message, MessageCtor} from "../Queue";
import {RedisQ2ReadOperation} from "./RedisQ2ReadOperation";
import {RedisQueueReader} from "./RedisQueueReader";
import {RedisTransport} from "./RedisTransport";

export class RedisQ2Reader<M extends Message,
    MC extends MessageCtor<M> & ITransactionType> extends RedisQueueReader<M, MC> {
    constructor(transport: RedisTransport, type: MC) {
        super(transport, type);
    }

    public get backup(): string {
        return this.type.getBackupKey();
    }

    public get fallback(): string {
        return this.type.getFallbackKey();
    }

    protected next(): Promise<string | undefined> {
        return this.wrap(this.connection.brpoplpush(this.channel, this.backup, this.timeout));
    }

    protected createReadOperation(message: M): RedisQ2ReadOperation<M> {
        return new RedisQ2ReadOperation(message, this.commit, this.rollback);
    }

    private commit = async () => {
        await this.connection.lpop(this.backup);
    };

    private rollback = async () => {
        await this.connection.rpoplpush(this.backup, this.fallback);
    };
}
