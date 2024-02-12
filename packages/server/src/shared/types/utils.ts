export type NoOptionalField<T, P extends keyof T = keyof T> = Omit<T, P> & {
  [Q in keyof Pick<T, P>]-?: Exclude<T[P], null | undefined>;
};

export type OptionalToNullable<O> = {
  [K in keyof O]: undefined extends O[K] ? O[K] | null : O[K];
};

export type Optional<T, Keys extends keyof T> = Omit<T, Keys> &
  OptionalToNullable<Partial<Pick<T, Keys>>>;
