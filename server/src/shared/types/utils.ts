export type NoOptionalField<T, P extends keyof T = keyof T> = Omit<T, P> & {
  [Q in keyof Pick<T, P>]-?: Exclude<T[P], null | undefined>;
};
