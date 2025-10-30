import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";

const ALGORITHM = "aes-256-cbc";

export class Encryptor {
  #environment = Container.inject(Environment);

  #makeKey(key: string) {
    return createHash("sha256").update(`${this.#environment.cryptoSecret}.${key}`).digest("base64").substring(0, 32);
  }

  encrypt(text: string, key: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, this.#makeKey(key), iv);

    return {
      iv: iv.toString("hex"),
      encrypted: cipher.update(text, "utf8", "base64") + cipher.final("base64"),
    };
  }

  decrypt(encrypted: string, key: string, iv: string) {
    const decipher = createDecipheriv(ALGORITHM, this.#makeKey(key), Buffer.from(iv, "hex"));

    return decipher.update(encrypted, "base64", "utf8") + decipher.final("utf8");
  }
}
