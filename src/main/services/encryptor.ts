import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";

const ALGORITHM = "aes-256-cbc";

/**
 * Encryptor class is used to handle text encryption and decryption operations
 * Uses AES-256-CBC algorithm for symmetric encryption
 */
export class Encryptor {
  #environment = Container.inject(Environment);

  /**
   * Generate key for encryption/decryption based on the given key
   * Uses SHA-256 hash algorithm combining environment key and input key to generate final key
   * @param key String used to generate the key
   * @returns 32-byte key string
   */
  #makeKey(key: string) {
    return createHash("sha256").update(`${this.#environment.cryptoSecret}.${key}`).digest("base64").substring(0, 32);
  }

  /**
   * Encrypt text
   * Uses AES-256-CBC algorithm to encrypt text
   * @param text Plaintext to be encrypted
   * @param key Encryption key
   * @returns Object containing initialization vector and encryption result
   */
  encrypt(text: string, key: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, this.#makeKey(key), iv);

    return {
      iv: iv.toString("hex"),
      encrypted: cipher.update(text, "utf8", "base64") + cipher.final("base64"),
    };
  }

  /**
   * Decrypt text
   * Uses AES-256-CBC algorithm to decrypt encrypted text
   * @param encrypted Encrypted text
   * @param key Decryption key
   * @param iv Initialization vector (hexadecimal string)
   * @returns Decrypted plaintext
   */
  decrypt(encrypted: string, key: string, iv: string) {
    const decipher = createDecipheriv(ALGORITHM, this.#makeKey(key), Buffer.from(iv, "hex"));

    return decipher.update(encrypted, "base64", "utf8") + decipher.final("utf8");
  }
}
