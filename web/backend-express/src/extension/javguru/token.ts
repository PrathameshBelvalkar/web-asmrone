/**
 * A STREAM SB gateway token is the embed's file id written in hex and then reversed:
 * `77c6…47a6` → reversed `6a74…6c77` → hex of `jt0slmiufqlw`. The reversed form is what the
 * gateway's `?xr=` takes.
 */

const FILE_ID = /^[a-z0-9]{8,16}$/i;

/** The token reversed: the value of the gateway's `?xr=`. */
export function gatewayValue(token: string): string {
  let out = '';
  for (let i = token.length - 1; i >= 0; i--) out += token.charAt(i);
  return out;
}

/** The embed file id a token stands for, or null when the token isn't one. */
export function fileIdOf(token: string): string | null {
  const hex = gatewayValue(token);
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return null;
  const id = Buffer.from(hex, 'hex').toString('latin1');
  return FILE_ID.test(id) ? id : null;
}
