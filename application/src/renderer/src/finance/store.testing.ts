// renderToString gives a zustand hook the initial state of its store; a test that renders a component lets the hook read the current state
export function liveStore<State, Store extends { getState: () => State }>(
  store: Store
): Store & (<Result>(selector: (state: State) => Result) => Result) {
  const hook = <Result>(selector: (state: State) => Result): Result => selector(store.getState())
  return Object.assign(hook, store)
}
