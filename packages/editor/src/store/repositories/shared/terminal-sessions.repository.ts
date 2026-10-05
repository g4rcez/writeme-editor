import type { StorageAdapter } from "../adapters/types";
import type { ITerminalSessionRepository, TerminalSession } from "../entities/terminal-session";
import { BaseRepository } from "../base.repository";

const getCreatedTime = (session: TerminalSession): number =>
    session.createdAt instanceof Date ? session.createdAt.getTime() : new Date(session.createdAt).getTime();

export class TerminalSessionsRepository extends BaseRepository<TerminalSession> implements ITerminalSessionRepository {
    constructor(adapter: StorageAdapter) {
        super(adapter, "terminalSessions", (a, b) => getCreatedTime(a) - getCreatedTime(b));
    }
}
