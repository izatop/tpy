import {IncomingMessage} from "http";
import {Socket} from "net";
import {URL} from "url";
import {IRoute, RegexpMatcher, Route, RouteNotFound, RouteRuleArg} from "@bunt/app";
import {
    ActionAny,
    ActionCtor,
    Context,
    ContextArg,
    Disposer,
    Heartbeat,
    IRunnable,
    Runtime,
    ShadowState,
    unit,
    Unit,
} from "@bunt/unit";
import {assert, Defer, isDefined, isString, logger, Logger, noop, resolveOrReject, toError} from "@bunt/util";
import {RequestMessage, WebServer} from "@bunt/web";
import * as ws from "ws";
import {WebSocketCloseReason} from "./const.js";
import {HandleProtoType, ProtoHandleAbstract} from "./Protocol/index.js";

export class WebSocketServer<C extends Context> extends Disposer implements IRunnable {
    @logger
    declare protected readonly logger: Logger;

    readonly #disposeAcceptor: () => void;
    readonly #servers = new Map<IRoute<ActionAny<C>>, ws.Server>();
    readonly #state = new Defer<void>();
    readonly #web: WebServer<C>;

    readonly #unit: Unit<C>;
    readonly #handles = new Map<string, Route<ProtoHandleAbstract<C, any>>>();
    readonly #limits = {
        maxConnections: 10240,
        pingsPerSecond: 512,
        pingTimeout: 60000,
    };

    protected constructor(unit: Unit<C>, server: WebServer<any>) {
        super();
        this.#web = server;
        this.#unit = unit;
        this.#disposeAcceptor = this.#web.setUpgradeProtocolAcceptor({
            protocol: "websocket",
            handle: this.handleUpgrade,
        });

        this.onDispose(server);
    }

    public static async attachTo<C extends Context>(server: WebServer<C>): Promise<WebSocketServer<C>>;
    public static async attachTo<C extends Context>(
        server: WebServer<any>,
        context: ContextArg<C>): Promise<WebSocketServer<C>>;

    public static async attachTo(
        server: WebServer<any>,
        context?: ContextArg<any>): Promise<WebSocketServer<any>> {
        if (context) {
            return new this(await unit(context), server);
        }

        return new this(Unit.from(server.context), server);
    }

    public route<A extends ProtoHandleAbstract<C, any>>(action: HandleProtoType<C, A>, rule: RouteRuleArg<A>): void {
        const route = new Route<A>((route) => RegexpMatcher.factory(route), action, rule);

        assert(!this.#handles.has(route.route), "Route must be unique");
        this.#handles.set(route.route, route);
    }

    public getHeartbeat(): Heartbeat {
        return Heartbeat.create(this)
            .enqueue(this.#state)
            .onDispose(this);
    }

    public async dispose(): Promise<void> {
        this.logger.info("destroy");

        try {
            this.#disposeAcceptor();

            const operations = [];
            for (const webSocket of this.#servers.values()) {
                try {
                    operations.push(new Promise<void>((resolve, reject) => {
                        webSocket.close(resolveOrReject(resolve, reject));
                    }));
                } catch (error) {
                    this.logger.error("Unexpected error", error);
                }
            }

            await Promise.allSettled(operations);
            await super.dispose();
        } finally {
            this.#state.resolve();
        }
    }

    protected resolveRoute(route: string): Route<ProtoHandleAbstract<C, any>> | undefined {
        for (const item of this.#handles.values()) {
            if (item.test(route)) {
                return item;
            }
        }
    }

    protected getWebSocketServer(route: IRoute<ActionAny<C>>): ws.Server {
        const webSocketServer = this.#servers.get(route) ?? this.factoryWebSocketServer();
        if (!this.#servers.has(route)) {
            this.#servers.set(route, webSocketServer);
        }

        return webSocketServer;
    }

    protected factoryWebSocketServer(): ws.Server {
        const webSocketServer = new ws.Server({noServer: true});
        const live = new WeakSet<ws>();
        const queue: {connection: ws; expire: number}[] = [];
        const getExpireTime = (): number => Date.now() + this.#limits.pingTimeout;

        webSocketServer.on("connection", (connection) => {
            live.add(connection);
            queue.unshift({connection, expire: getExpireTime()});
            connection.once("close", () => live.delete(connection));
            connection.on("pong", () => live.add(connection));
        });

        const test = (): void => {
            const now = Date.now();
            const restore = [];
            const nextExpireTime = getExpireTime();
            const range = queue.splice(-this.#limits.pingsPerSecond);
            for (const item of range) {
                if (item.expire > now) {
                    restore.push(item);
                    continue;
                }

                const {connection} = item;
                if (!live.has(connection)) {
                    connection.terminate();
                    continue;
                }

                item.expire = nextExpireTime;
                queue.unshift(item);
                live.delete(connection);
                connection.ping(noop);
            }

            restore.sort(({expire: a}, {expire: b}) => b - a);
            queue.push(...restore);

            if (Runtime.isDevelopment()) {
                const all = queue.length;
                const fast = restore.length;
                const slow = queue.filter(({expire}) => expire < now).length;
                this.logger.debug(`ping/pong { queue: ${all}, fast: ${fast}, slow: ${slow} }`);
            }
        };

        const intervalMs = this.#limits.pingTimeout / (this.#limits.maxConnections / this.#limits.pingsPerSecond);
        const timerInterval = setInterval(test, intervalMs);
        webSocketServer.on("close", () => clearInterval(timerInterval));

        return webSocketServer;
    }

    protected handleUpgrade = async (req: IncomingMessage, socket: Socket, head: Buffer): Promise<void> => {
        try {
            assert(isString(req.url), "Malformed URL");
            this.logger.info("handle", {url: req.url});
            const {pathname} = new URL(req.url, "http://localhost");
            const route = this.resolveRoute(pathname);

            assert(route, () => new RouteNotFound(pathname));
            this.logger.debug("match", route);

            const state: Record<string, any> = {};
            const request = new RequestMessage(req);
            const matches = route.match(request.route);
            const routeContext = {
                request,
                context: this.#unit.context,
                args: new Map<string, string>(Object.entries(matches)),
            };

            if (isDefined(route.payload)) {
                const {payload} = route;
                Object.assign(state, await payload.validate(routeContext));
            }

            const ws = this.getWebSocketServer(route);
            ws.handleUpgrade(req, socket, head, async (connection) => {
                const action = await Unit.getAction(route.action);
                if (!this.isHandleProto(action)) {
                    connection.close(WebSocketCloseReason.INTERNAL_ERROR);

                    return;
                }

                if (!action.isSupported(connection.protocol)) {
                    connection.close(WebSocketCloseReason.PROTOCOL_ERROR);

                    return;
                }

                if (ws.clients.size >= this.#limits.maxConnections) {
                    connection.close(WebSocketCloseReason.TRY_AGAIN_LATER);

                    return;
                }

                this.logger.debug("Accept connection");
                ws.emit("connection", connection, req);
                ShadowState.set(state, connection);

                // @todo
                this.handle(connection, () => this.#unit.run(route.action as any, state));
            });
        } catch (error) {
            this.logger.error(toError(error).message, error);
            socket.destroy(toError(error));
        }
    };

    protected async handle(connection: ws, action: () => Promise<unknown>): Promise<void> {
        try {
            await action();
            connection.close(WebSocketCloseReason.NORMAL_CLOSURE);
        } catch (error) {
            this.logger.error("Unexpected error", error);
            connection.close(WebSocketCloseReason.INTERNAL_ERROR);
        }
    }

    protected isHandleProto<A extends HandleProtoType<any, any>>(action: ActionCtor<any>): action is A {
        return "protocol" in action;
    }
}
