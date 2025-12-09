import { useEffect, useRef } from "react";
import { useUnhandledDeepLinksWithSelector } from "@/renderer/next/hooks/remote/use-unhandled-deep-links";
import { ServerInstaller, type ServerInstallerInstance } from "@/renderer/pages/tool/ServerInstaller";

export const DeepLinkHandler = () => {
  const refServerInstaller = useRef<ServerInstallerInstance | null>(null);

  const unhandledServerInstall = useUnhandledDeepLinksWithSelector((raw) => {
    return raw.find((item) => item.link.type === "install-server");
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: x
  useEffect(() => {
    if (unhandledServerInstall) {
      const id = unhandledServerInstall.id;
      const link = unhandledServerInstall.link;

      if (link.type === "install-server") {
        refServerInstaller.current?.install(link.server, () => {
          window.bridge.deepLinkHandler.handled(id).catch(() => {});
        });
      }
    }
  }, [unhandledServerInstall?.id]);

  return <ServerInstaller ref={refServerInstaller} />;
};
