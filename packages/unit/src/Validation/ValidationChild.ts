import {ValidationSchema} from "./ValidationSchema";

export class ValidationChild<T extends Record<any, any>, K extends keyof T>
    extends ValidationSchema<Exclude<T[K], null | undefined>> {
}
