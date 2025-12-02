import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Encryptor } from "@/main/services/encryptor";

export class EncryptorBridge extends Bridge.define("encryptor", () => {
  const service = Container.inject(Encryptor);

  return {
    encrypt: async (...args: Parameters<(typeof service)["encrypt"]>) => {
      return service.encrypt(...args);
    },
    decrypt: async (...args: Parameters<(typeof service)["decrypt"]>) => {
      return service.decrypt(...args);
    },
  };
}) {}
