import {IRequest} from "../../interfaces";

export const JSONTransform = async <T extends object = object>(request: IRequest): Promise<T> => {
    request.headers.assert("content-type", ["application/json"]);
    const buffer = await request.getBuffer();
    return JSON.parse(buffer.toString("utf-8"));
};
