import {IDisposable} from "@typesafeunit/unit";
import {Promisify} from "@typesafeunit/util";
import {MessageAbstract, TaskAbstract} from "./Message";

export interface IReadOperationState<M extends Message> {
    error?: Error;
    status: boolean;
    message: M;
    finishAt: Date;
    runAt: Date;
}

export interface IReadOperationSuccess<M extends Message> extends IReadOperationState<M> {
    status: true;
    error?: never;
}

export interface IReadOperationFail<M extends Message> extends IReadOperationState<M> {
    status: false;
    error: Error;
}

export type OperationReleaseState<M extends Message> = IReadOperationSuccess<M> | IReadOperationFail<M>;

export interface IReadOperation<M extends Message> {
    readonly message: M;
    readonly channel: string;

    commit(): Promise<OperationReleaseState<M>>;

    rollback(reason?: Error): Promise<IReadOperationFail<M>>;
}

export interface ITransport extends IDisposable {
    send<M extends Message>(message: M): Promisify<void>;

    subscribe<M extends Message>(type: MessageCtor<M>, handler: MessageHandler<M>): ISubscription<M>;

    reader<M extends Message>(type: MessageCtor<M>): IQueueReader<M>;
}

export interface IQueueReader<M extends Message, RO extends IReadOperation<M> = IReadOperation<M>>
    extends IDisposable {
    readonly channel: string;

    read(): Promise<RO | undefined>;

    cancel(): Promise<void>;
}

export interface IMessageHandler<M extends MessageAbstract<any>> {
    (message: M): unknown;
}

export interface ITaskHandler<M extends TaskAbstract<any, any>> {
    (message: M): TaskReply<M>;
}

export type MessageHandler<M> = M extends TaskAbstract<any, any>
    ? ITaskHandler<M>
    : M extends MessageAbstract<any>
        ? IMessageHandler<M>
        : never;

export type QueueKeys<T> = Extract<keyof T, string>;

export interface IHandleReleaseFactory<M extends Message> {
    (): IReadOperationSuccess<M>;

    (error: Error): IReadOperationFail<M>;
}

export interface ISubscriptionResultHandler<M extends Message> {
    (result: OperationReleaseState<M>): unknown;
}

export interface ISubscription<M extends Message> extends IDisposable {
    readonly subscribed: boolean;

    unsubscribe(): Promise<void>;

    subscribe(): Promise<void>;

    watch(fn: ISubscriptionResultHandler<M>): void;
}

export type MessagePayload<T extends MessageAbstract<any>> = T extends MessageAbstract<infer P> ? P : never;
export type TaskReply<T extends TaskAbstract<any, any>> = T extends TaskAbstract<any, infer P> ? P : never;

export interface MessageCtor<M extends Message> {
    prototype: M;

    readonly channel: string;

    new(message: MessagePayload<M>): M;
}

export interface ITransactionType {
    getBackupKey(): string;

    getFallbackKey(): string;
}

export type Task<T extends TaskAbstract<any, any> = TaskAbstract<any, any>> = T;
export type Message<T extends MessageAbstract<any> = MessageAbstract<any>> = T;
