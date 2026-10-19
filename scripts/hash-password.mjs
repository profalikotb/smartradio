// Usage: npm run hash-password            (prompts, input hidden)
//        npm run hash-password -- "secret" (non-interactive; avoid: lands in shell history)
import { scrypt, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

const N = 2 ** 15, r = 8, p = 1;

function ask() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes("Password")) process.stdout.write(s); };
    rl.question("Password (min 12 chars): ", (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

const pw = process.argv[2] ?? (await ask());
if (!pw || pw.length < 12) { console.error("Password must be at least 12 characters."); process.exit(1); }
const salt = randomBytes(16);
scrypt(pw.normalize("NFKC"), salt, 32, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) => {
  if (err) throw err;
  console.log("\nAPP_PASSWORD_HASH=" + ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join(":"));
  console.log("SESSION_SECRET=" + randomBytes(48).toString("base64"));
  console.log("\nPaste both into Vercel → Settings → Environment Variables (Production + Preview).");
});
