// Raw LZ4 block decoder (Unity bundles use raw LZ4 blocks, not the frame format).
// Implements the block format from the LZ4 spec: sequences of literals + matches.

export function lz4DecompressBlock(
  input: Uint8Array,
  uncompressedSize: number,
): Uint8Array {
  const output = new Uint8Array(uncompressedSize);
  let ip = 0; // input position
  let op = 0; // output position

  while (ip < input.length) {
    const token = input[ip++];

    // literals
    let literalLen = token >> 4;
    if (literalLen === 15) {
      let b: number;
      do {
        b = input[ip++];
        literalLen += b;
      } while (b === 255);
    }
    if (literalLen > 0) {
      output.set(input.subarray(ip, ip + literalLen), op);
      ip += literalLen;
      op += literalLen;
    }
    if (ip >= input.length) break; // last literals, no match

    // match
    const offset = input[ip] | (input[ip + 1] << 8);
    ip += 2;
    if (offset === 0 || offset > op) throw new Error(`LZ4: bad offset ${offset} at out ${op}`);

    let matchLen = (token & 0x0f) + 4;
    if ((token & 0x0f) === 15) {
      let b: number;
      do {
        b = input[ip++];
        matchLen += b;
      } while (b === 255);
    }

    // byte-by-byte copy handles overlapping matches correctly
    let src = op - offset;
    for (let i = 0; i < matchLen; i++) {
      output[op++] = output[src++];
    }
  }

  if (op !== uncompressedSize) {
    throw new Error(`LZ4: expected ${uncompressedSize} bytes, got ${op}`);
  }
  return output;
}
