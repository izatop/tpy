import {Disposable, IDisposable} from "@bunt/unit";
import {isArray} from "@bunt/util";
import {IPubSubTransport, PubSubChannel} from "./interfaces";
import {Subscription} from "./Subscription";

export abstract class PubSubAbstract<S extends Record<string, any>>
implements IDisposable {
    readonly #transport: IPubSubTransport;

    public constructor(transport: IPubSubTransport) {
        this.#transport = transport;

        Disposable.attach(this, transport);
    }

    public key<K extends keyof S>(channel: PubSubChannel<K>): string {
        return isArray(channel) ? channel.join("/") : channel;
    }

    public async publish<K extends keyof S>(channel: PubSubChannel<K>, message: S[K]): Promise<void> {
        await this.#transport.publish(this.key(channel), this.serialize(message));
    }

    public async subscribe<K extends keyof S>(channel: PubSubChannel<K>): Promise<Subscription<S[K]>> {
        return new Subscription<S[K]>(
            this.key(channel),
            await this.#transport.getSubscriptionManager(),
            (message) => this.parse<K>(message),
        );
    }

    public async dispose(): Promise<void> {
        return;
    }

    protected abstract serialize<K extends keyof S>(message: S[K]): string;

    protected abstract parse<K extends keyof S>(message: string): S[K];
}
