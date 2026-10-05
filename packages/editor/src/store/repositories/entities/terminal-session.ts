import type { EntityBase, Repository } from "../../repository";

export const TERMINAL_SESSION_ENTITY_TYPE = "terminal-session";

export class TerminalSession implements EntityBase {
    public constructor(
        public id: string,
        public title: string,
        public project: string,
        public createdAt: Date,
        public updatedAt: Date,
        public type: string = TERMINAL_SESSION_ENTITY_TYPE,
    ) {}
}

export interface ITerminalSessionRepository extends Repository<TerminalSession> {}
