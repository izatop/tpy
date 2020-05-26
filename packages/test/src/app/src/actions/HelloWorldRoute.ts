import {JSONTransform, PathRoute} from "@typesafeunit/app";
import {isNumber, pass} from "@typesafeunit/util";
import {HelloWorldAction} from "./HelloWorldAction";

export default new PathRoute(
    HelloWorldAction,
    {
        route: "/u/:id",
        state: {
            id: ({args}): number => pass(args.get("id"), (v) => parseInt(v, 10), isNumber),
            payload: ({request}): any => JSONTransform(request),
            option: (): boolean => true,
        },
    },
);
