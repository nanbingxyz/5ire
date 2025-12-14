import { join } from "node:path";
import { dataUriToBuffer } from "data-uri-to-buffer";
import { writeFile } from "fs-extra";
import type { TurnPrompt, TurnReply } from "@/main/database/types";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { URLParser } from "@/main/services/url-parser";

export class LegacyMessageConverter {
  #environment = Container.inject(Environment);
  #urlParser = Container.inject(URLParser);

  #split(text: string) {
    return text
      .split(/(<img\s+src="[^"]+"\s*.*\/?>)/g)
      .map((chunk) => {
        return chunk.trim();
      })
      .map((chunk) => {
        const match = chunk.match(/<img\s+src="([^"]+)"\s*.*\/?>/g);

        if (match) {
          return {
            type: "image",
            src: match[0],
          } as const;
        }

        return {
          type: "text",
          text: chunk,
        } as const;
      });
  }

  async convertLegacyUserPrompt(text: string) {
    const prompt: TurnPrompt.UserInput = {
      type: "user-input",
      content: [],
    };

    for (const chunk of this.#split(text)) {
      if (chunk.type === "image") {
        if (chunk.src.startsWith("data:")) {
          const data = dataUriToBuffer(chunk.src);
          const id = crypto.randomUUID();
          const path = join(this.#environment.blobsDataFolder, id);

          await writeFile(path, data.buffer).then(() => {
            prompt.content.push({
              type: "reference",
              url: this.#urlParser.formatFile(path),
              mimetype: data.type,
            });
          });
        }

        if (chunk.src.startsWith("http:") || chunk.src.startsWith("https:")) {
          await fetch(chunk.src, { method: "head", signal: AbortSignal.timeout(5000) })
            .then((res) => {
              return res.headers.get("content-type");
            })
            .catch(() => {
              return null;
            })
            .then((mimeType) => {
              prompt.content.push({
                type: "reference",
                url: chunk.src,
                mimetype: mimeType ?? "image/jpeg",
              });
            });
        }
      } else {
        prompt.content.push({
          type: "text",
          text: chunk.text,
        });
      }
    }

    return prompt;
  }

  async convertLegacyAssistantReply(text: string, reasoning?: string) {
    const reply: TurnReply = [];

    for (const chunk of this.#split(reasoning || "")) {
      if (chunk.type === "text" && chunk.text.trim()) {
        reply.push({
          type: "reasoning",
          text: chunk.text,
        });
      }
    }

    for (const chunk of this.#split(text)) {
      if (chunk.type === "image") {
        if (chunk.src.startsWith("data:")) {
          const data = dataUriToBuffer(chunk.src);
          const id = crypto.randomUUID();
          const path = join(this.#environment.blobsDataFolder, id);

          await writeFile(path, data.buffer).then(() => {
            reply.push({
              type: "reference",
              url: this.#urlParser.formatFile(path),
              mimetype: data.type,
            });
          });
        }

        if (chunk.src.startsWith("http:") || chunk.src.startsWith("https:")) {
          await fetch(chunk.src, { method: "head", signal: AbortSignal.timeout(5000) })
            .then((res) => {
              return res.headers.get("content-type");
            })
            .catch(() => {
              return null;
            })
            .then((mimeType) => {
              reply.push({
                type: "reference",
                url: chunk.src,
                mimetype: mimeType ?? "image/jpeg",
              });
            });
        }
      } else {
        reply.push({
          type: "text",
          text: chunk.text,
        });
      }
    }

    return reply;
  }
}
