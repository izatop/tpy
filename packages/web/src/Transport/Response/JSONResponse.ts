import {ResponseAbstract} from "./ResponseAbstract.js";

export class JSONResponse<T> extends ResponseAbstract<T> {
    public readonly type = "application/json";

    public stringify(data: T): string {
        return JSON.stringify(data);
    }
}
