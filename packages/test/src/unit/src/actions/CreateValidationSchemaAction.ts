import {Action, ValidationSchema} from "@typesafeunit/unit";
import {assert, isNumber} from "@typesafeunit/util";
import {IBaseContext} from "../interfaces";

interface ICreateValidationSchemaState {
    id: number;
}

export class CreateValidationSchemaAction extends Action<IBaseContext, ICreateValidationSchemaState> {
    public createValidationSchema() {
        return new ValidationSchema<ICreateValidationSchemaState>()
            .add("id", (v) => assert(isNumber(v)));
    }

    public run() {
        return this.state.id.toString(32);
    }

}
