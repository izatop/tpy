import {RequestValidatorAbstract} from "@typesafeunit/app";
import {Request} from "./Request";

export type ServerHeadersResolver = (request: Request) => { [key: string]: string };

export type ServerRequestHandler<T = void> = (request: Request) => T;

export interface ICorsOptions {
    origin: string | ServerRequestHandler<string>;
}

export interface IServerOptions {
    headers?: { [key: string]: string } | ServerHeadersResolver;
    validators?: RequestValidatorAbstract<any> | RequestValidatorAbstract<any>[];
}

export interface IRequestSendOptions {
    code: number;
    status?: string;
    headers?: { [key: string]: string };
}
