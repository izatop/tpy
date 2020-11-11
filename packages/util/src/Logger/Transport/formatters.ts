import {isDefined} from "../../is";
import {LogFormat, LogMessage, SeverityLevel} from "../interfaces";

export const defaultLogFormat: LogFormat<string> = (log) => JSON.stringify(log);
export const readableJSONLogFormat: LogFormat<string> = (log) => JSON.stringify(log, null, 2);

export const debugLogFormat: LogFormat<string> = (log: LogMessage) => {
    const {pid, label, message, timestamp, host, severity, groupId, system, args} = log;

    const info: (string | undefined)[] = [
        new Date(timestamp).toISOString(),
        SeverityLevel[severity],
        `host=${host}`,
        `pid=${pid.toString()}`,
        `label=${label}`,
        groupId ? `group=${groupId}` : void 0,
    ];

    const debug = [info.filter(isDefined).join(" "), message];
    isDefined(system) && debug.push(JSON.stringify(system, null, 2));
    isDefined(args) && debug.push(JSON.stringify(args, null, 2));

    return debug.join("\n") + "\n";
};
