// Minimal ambient declarations for @testing-library/dom.
// @testing-library/dom is a peer dependency not installed with --legacy-peer-deps.
// This file provides just enough type information for the test files and
// @testing-library/react's own type declarations to compile.

declare module '@testing-library/dom' {
  export interface Config {
    asyncUtilTimeout: number
    asyncWrapper(cb: () => unknown): Promise<unknown>
    eventWrapper(cb: () => unknown): void
    defaultHidden: boolean
    defaultIgnore: string
    showOriginalStackTrace: boolean
    throwSuggestions: boolean
    getElementError(message: string | null, container: Element): Error
    computedStyleSupportsPseudoElements: boolean
  }

  export type ConfigFn = (existingConfig: Config) => Partial<Config>

  export interface prettyFormat {
    OptionsReceived: object
  }
  export namespace prettyFormat {
    interface OptionsReceived {
      [key: string]: unknown
    }
  }

  // Minimal query types
  export type BoundFunction<T> = T extends (
    container: Element,
    ...args: infer P
  ) => infer R
    ? (...args: P) => R
    : never

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Queries = Record<string, (...args: any[]) => any>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const queries: Queries

  // screen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const screen: Record<string, (...args: any[]) => any> & {
    getByText(text: string | RegExp, options?: object): HTMLElement
    getByRole(role: string, options?: object): HTMLElement
    getByPlaceholderText(text: string | RegExp, options?: object): HTMLElement
    queryByText(text: string | RegExp, options?: object): HTMLElement | null
    queryByRole(role: string, options?: object): HTMLElement | null
    queryByPlaceholderText(text: string | RegExp, options?: object): HTMLElement | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAllByRole(role: string, options?: object): HTMLElement[]
    getAllByText(text: string | RegExp, options?: object): HTMLElement[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findByText(text: string | RegExp, options?: object): Promise<HTMLElement>
    findByRole(role: string, options?: object): Promise<HTMLElement>
    debug(element?: HTMLElement | HTMLElement[]): void
  }

  // waitFor
  export function waitFor<T>(callback: () => T | Promise<T>, options?: object): Promise<T>

  // fireEvent
  export namespace fireEvent {
    function click(element: Element, eventInit?: object): boolean
    function change(element: Element, eventInit?: object): boolean
    function submit(element: Element, eventInit?: object): boolean
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function fireEvent(element: Element, event: Event): boolean

  export function configure(config: Partial<Config> | ConfigFn): void
  export function getConfig(): Config
  export function getDefaultNormalizer(options?: object): (text: string) => string
  export function getNodeText(node: Element): string
  export function getQueriesForElement<T extends Queries>(element: Element, queriesToBind?: T): { [P in keyof T]: BoundFunction<T[P]> }
  export function getRoles(element: Element): Record<string, Element[]>
  export function isInaccessible(element: Element): boolean
  export function logDOM(htmlElement?: Element): void
  export function logRoles(element: Element): void
  export function prettyDOM(htmlElement?: Element, maxLength?: number, options?: object): string | false
  export function within(element: Element): { [key: string]: (...args: unknown[]) => unknown }
}
