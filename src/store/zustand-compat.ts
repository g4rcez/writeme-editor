import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";

type ReducerContext<State> = {
    state: () => State;
    props: () => {};
    initialState: State;
    previousState: () => State;
};

type ReducerFactories = Record<string, (...args: any[]) => any>;

type ReducerDispatchers<T extends ReducerFactories> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
        ? R extends Promise<any>
            ? (...args: A) => Promise<void>
            : (...args: A) => void
        : never;
};

type StoreHook<State, Factories extends ReducerFactories> = {
    (): [State, ReducerDispatchers<Factories>];
    <Slice>(
        selector: (state: State) => Slice,
        comparator?: (left: Slice, right: Slice) => boolean,
        options?: any,
    ): [Slice, ReducerDispatchers<Factories>];
    dispatchers: ReducerDispatchers<Factories>;
    getState: () => State;
};

type Interceptor<State> = Array<(state: State) => any>;

type CreateCompatOptions<State> = {
    interceptor?: Interceptor<State>;
};

export function createZustandCompatStore<State extends object, Factories extends ReducerFactories>(
    initialState: State,
    reducerFactory: (context: ReducerContext<State>) => Factories,
    options: CreateCompatOptions<State> = {},
): StoreHook<State, Factories> {
    const interceptor = options.interceptor ?? [];

    const useStore = createWithEqualityFn<State>(() => initialState, shallow);

    const context: ReducerContext<State> = {
        state: () => useStore.getState(),
        props: () => ({}),
        initialState,
        previousState: () => useStore.getState(),
    };

    const rawFactories = reducerFactory(context);

    const applyPatch = (patch: unknown): void => {
        if (!patch) {
            return;
        }
        const nextPatch = patch as Partial<State>;
        if (typeof nextPatch === "object" && !Array.isArray(nextPatch)) {
            useStore.setState((state) => ({ ...state, ...nextPatch }));
        } else {
            useStore.setState(() => nextPatch as State, true);
        }
        const state = useStore.getState();
        for (const entry of interceptor) {
            entry(state);
        }
    };

    const dispatchers = {} as ReducerDispatchers<Factories>;
    for (const [method, dispatch] of Object.entries(rawFactories) as [
        keyof Factories & string,
        (...args: any[]) => any,
    ][]) {
        dispatchers[method as keyof Factories] = ((...args: any[]): any => {
            const result = dispatch(...args);
            if (result && typeof (result as PromiseLike<unknown>).then === "function") {
                return (result as Promise<unknown>).then((nextState) => {
                    applyPatch(nextState);
                });
            }
            applyPatch(result);
            return;
        }) as Factories[typeof method] extends (...args: infer A) => infer R
            ? R extends Promise<any>
                ? (...args: A) => Promise<void>
                : (...args: A) => void
            : never;
    }

    const hook = ((
        selector?: any,
        comparator?: (left: any, right: any) => boolean,
    ): [any, ReducerDispatchers<Factories>] => [
        useStore(selector ?? ((state: State) => state), comparator),
        dispatchers,
    ]) as StoreHook<State, Factories>;
    hook.dispatchers = dispatchers;
    hook.getState = () => useStore.getState();
    return hook;
}
