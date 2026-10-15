// Hand-crafted LZ4 block vectors (literal-only and single-match sequences)
import { lz4DecompressBlock } from "../src/lz4.ts";

const enc = new TextEncoder();
let failures = 0;

function check(name: string, input: number[], expected: string) {
  try {
    const out = lz4DecompressBlock(new Uint8Array(input), expected.length);
    const got = new TextDecoder().decode(out);
    if (got === expected) {
      console.log(`PASS ${name}`);
    } else {
      failures++;
      console.log(`FAIL ${name}: got ${JSON.stringify(got)}`);
    }
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}: threw ${e}`);
  }
}

// 4 literals, no match (last sequence)
check("literals-only", [0x40, ...enc.encode("test")], "test");

// "abc" + match(offset=3, len=6) -> abcabcabc
check("simple-match", [0x32, ...enc.encode("abc"), 0x03, 0x00], "abcabcabc");

// overlapping match: "aaaaa" = literal 'a' + match(offset=1, len=4)
check("overlap-rle", [0x10, 0x61, 0x01, 0x00], "aaaaa");

// long literal length extension: 15+255+1 = 271 'x'
const long: number[] = [0xf0, 0xff, 0x01];
for (let i = 0; i < 271; i++) long.push(0x78);
check("literal-extension", long, "x".repeat(271));

// long match extension: 15+255+1+4 = 275 bytes from 'a'
const longMatch: number[] = [0x1f, 0x61, 0x01, 0x00, 0xff, 0x01];
check("match-extension", longMatch, "a".repeat(276));

process.exit(failures === 0 ? 0 : 1);
