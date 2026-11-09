/** A JSON value. Views produce these; `null` is always explicit, never `undefined`. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
