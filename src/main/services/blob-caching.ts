import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { ensureDir, ensureDirSync, writeFile, writeFileSync } from "fs-extra";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";

export class BlobCaching {
  #environment = Container.inject(Environment);

  async save(space: string, content: Uint8Array) {
    const hash = createHash("sha256").update(content).digest().toString("hex");
    const dir = resolve(this.#environment.blobsDataFolder, space, hash.substring(0, 2));
    const path = resolve(dir, hash);

    await ensureDir(dir);
    await writeFile(path, content);

    return path;
  }

  saveSync(space: string, content: Uint8Array) {
    const hash = createHash("sha256").update(content).digest().toString("hex");
    const dir = resolve(this.#environment.blobsDataFolder, space, hash.substring(0, 2));
    const path = resolve(dir, hash);

    ensureDirSync(dir);
    writeFileSync(path, content);

    return path;
  }
}
